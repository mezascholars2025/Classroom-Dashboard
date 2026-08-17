import { getRedirectUri } from '../../../lib/redirectUri';

export default function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.redirect(
      '/?error=' +
        encodeURIComponent(
          'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Check your .env.local file.'
        )
    );
    return;
  }

  const scopes = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
    'https://www.googleapis.com/auth/classroom.profile.emails',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: scopes,
    access_type: 'offline', // needed so Google returns a refresh token
    prompt: 'consent',      // forces consent so we reliably get that refresh token
    include_granted_scopes: 'true',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
