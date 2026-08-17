// Helper library for talking to the Google Classroom API.
// Handles automatic access-token refresh and paginated results.

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Token refresh failed');
    err.needsReauth = true;
    throw err;
  }
  return data;
}

async function classroomFetch(path, tokens) {
  const doFetch = (token) =>
    fetch(`https://classroom.googleapis.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(tokens.access_token);

  // Access token expired -> refresh once and retry.
  if (res.status === 401) {
    if (!tokens.refresh_token) {
      const err = new Error('Session expired. Please reconnect Google Classroom.');
      err.needsReauth = true;
      throw err;
    }
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    tokens.access_token = refreshed.access_token;
    tokens.expiry_date = Date.now() + refreshed.expires_in * 1000;
    tokens._refreshed = true; // tells the page to re-save the cookie
    res = await doFetch(tokens.access_token);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || '';
    } catch {
      /* ignore parse failure */
    }

    if (res.status === 403) {
      const err = new Error(
        detail ||
          'Google denied access. Make sure the Classroom API is enabled and your account is listed as a Test User.'
      );
      err.needsReauth = true;
      throw err;
    }
    throw new Error(`Classroom API error (${res.status})${detail ? ': ' + detail : ''}`);
  }

  return res.json();
}

// Follows nextPageToken until all results are collected.
async function fetchAllPages(basePath, key, tokens) {
  const results = [];
  let pageToken = '';

  do {
    const sep = basePath.includes('?') ? '&' : '?';
    const path = pageToken
      ? `${basePath}${sep}pageToken=${encodeURIComponent(pageToken)}`
      : basePath;
    const data = await classroomFetch(path, tokens);
    if (Array.isArray(data[key])) results.push(...data[key]);
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return results;
}

export async function getCourses(tokens) {
  return fetchAllPages('/courses?teacherId=me&courseStates=ACTIVE', 'courses', tokens);
}

export async function getStudents(courseId, tokens) {
  return fetchAllPages(`/courses/${courseId}/students?pageSize=100`, 'students', tokens);
}

export async function getCourseWork(courseId, tokens) {
  const work = await fetchAllPages(
    `/courses/${courseId}/courseWork?courseWorkStates=PUBLISHED`,
    'courseWork',
    tokens
  );

  // Sort newest-due first; undated assignments go last.
  const toTime = (w) => {
    if (!w.dueDate) return -Infinity;
    const { year, month, day } = w.dueDate;
    const t = w.dueTime || {};
    return new Date(year, (month || 1) - 1, day || 1, t.hours || 23, t.minutes || 59).getTime();
  };

  return work.sort((a, b) => toTime(b) - toTime(a));
}

export async function getSubmissions(courseId, courseWorkId, tokens) {
  return fetchAllPages(
    `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?pageSize=100`,
    'studentSubmissions',
    tokens
  );
}
