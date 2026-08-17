himport { useState } from 'react';
import { readSession, buildSessionCookie } from '../lib/session';
import {
  getCourses,
  getStudents,
  getCourseWork,
  getSubmissions,
} from '../lib/googleClassroom';

export async function getServerSideProps(context) {
  const queryError = context.query.error || null;
  const tokens = readSession(context.req);

  if (!tokens) {
    return { props: { connected: false, queryError } };
  }

  const selectedCourseId = context.query.course || null;

  try {
    const courses = await getCourses(tokens);

    let students = [];
    let courseWork = [];
    let submissionsByWork = {};
    let activeCourseId = selectedCourseId;

    // Default to the first class so the dashboard isn't empty on first load.
    if (!activeCourseId && courses.length > 0) {
      activeCourseId = courses[0].id;
    }

    if (activeCourseId) {
      students = await getStudents(activeCourseId, tokens);
      courseWork = await getCourseWork(activeCourseId, tokens);

      const results = await Promise.all(
        courseWork.map((w) =>
          getSubmissions(activeCourseId, w.id, tokens).then((subs) => [w.id, subs])
        )
      );
      submissionsByWork = Object.fromEntries(results);
    }

    // If the access token was refreshed mid-request, persist the new one.
    if (tokens._refreshed) {
      context.res.setHeader(
        'Set-Cookie',
        buildSessionCookie({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
        })
      );
    }

    return {
      props: {
        connected: true,
        queryError,
        courses: courses.map((c) => ({ id: c.id, name: c.name || 'Untitled class' })),
        activeCourseId: activeCourseId || null,
        students: students.map((s) => ({
          userId: s.userId,
          name: s.profile?.name?.fullName || s.profile?.emailAddress || 'Unknown student',
        })),
        courseWork: courseWork.map((w) => ({
          id: w.id,
          title: w.title || 'Untitled assignment',
          dueDate: w.dueDate || null,
        })),
        submissionsByWork,
      },
    };
  } catch (err) {
    return {
      props: {
        connected: true,
        queryError,
        error: err.message || 'Something went wrong.',
        needsReauth: Boolean(err.needsReauth),
        courses: [],
      },
    };
  }
}

const NAVY = '#0a1f44';
const GOLD = '#f2c14e';

function statusFor(submissionsByWork, courseWorkId, userId) {
  const subs = submissionsByWork[courseWorkId] || [];
  const sub = subs.find((s) => s.userId === userId);
  if (!sub) return { key: 'nodata', label: '—', color: '#9aa0a6' };
  if (sub.state === 'TURNED_IN' || sub.state === 'RETURNED') {
    return sub.late
      ? { key: 'late', label: 'Late', color: '#b26a00' }
      : { key: 'in', label: 'Turned in', color: '#1a7f37' };
  }
  return { key: 'missing', label: 'Missing', color: '#c62828' };
}

function formatDue(dueDate) {
  if (!dueDate) return 'No due date';
  const { year, month, day } = dueDate;
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function Home(props) {
  const {
    connected,
    queryError,
    courses = [],
    activeCourseId,
    students = [],
    courseWork = [],
    submissionsByWork = {},
    error,
    needsReauth,
  } = props;

  const [view, setView] = useState('grid');

  if (!connected) {
    return (
      <Shell>
        <div style={s.card}>
          <h1 style={s.h1}>Classroom Dashboard</h1>
          <p style={s.sub}>
            See at a glance which students have turned in their homework.
          </p>
          {queryError && <div style={s.errorBox}>{queryError}</div>}
          <a href="/api/auth/login" style={s.button}>
            Connect Google Classroom
          </a>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div style={s.card}>
          <h1 style={s.h1}>Couldn&apos;t load your classes</h1>
          <div style={s.errorBox}>{error}</div>
          <a href="/api/auth/login" style={s.button}>
            {needsReauth ? 'Reconnect Google Classroom' : 'Try again'}
          </a>
        </div>
      </Shell>
    );
  }

  // ---- summary numbers ----
  let missingCount = 0;
  let lateCount = 0;
  let turnedInCount = 0;
  const missingByStudent = {};

  students.forEach((st) => (missingByStudent[st.userId] = []));

  courseWork.forEach((w) => {
    students.forEach((st) => {
      const status = statusFor(submissionsByWork, w.id, st.userId);
      if (status.key === 'missing') {
        missingCount += 1;
        missingByStudent[st.userId].push(w);
      } else if (status.key === 'late') {
        lateCount += 1;
      } else if (status.key === 'in') {
        turnedInCount += 1;
      }
    });
  });

  const studentsWithMissing = students
    .filter((st) => missingByStudent[st.userId].length > 0)
    .sort((a, b) => missingByStudent[b.userId].length - missingByStudent[a.userId].length);

  return (
    <Shell wide>
      <div style={{ ...s.card, maxWidth: '100%' }}>
        <div style={s.headerRow}>
          <h1 style={{ ...s.h1, marginBottom: 0 }}>Classroom Dashboard</h1>
          <a href="/api/auth/logout" style={s.linkSmall}>
            Disconnect
          </a>
        </div>

        {courses.length === 0 ? (
          <p style={{ color: '#555', marginTop: 20 }}>
            No active classes found on this Google account. If you expected to see classes
            here, make sure you&apos;re signed in with the account that owns them.
          </p>
        ) : (
          <>
            <div style={s.controls}>
              <label style={s.label}>Class</label>
              <select
                defaultValue={activeCourseId || ''}
                onChange={(e) => {
                  window.location.href = `/?course=${e.target.value}`;
                }}
                style={s.select}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div style={s.toggleGroup}>
                <button
                  onClick={() => setView('grid')}
                  style={view === 'grid' ? s.toggleActive : s.toggle}
                >
                  Full grid
                </button>
                <button
                  onClick={() => setView('missing')}
                  style={view === 'missing' ? s.toggleActive : s.toggle}
                >
                  Needs follow-up
                </button>
              </div>
            </div>

            <div style={s.statRow}>
              <Stat label="Students" value={students.length} />
              <Stat label="Assignments" value={courseWork.length} />
              <Stat label="Turned in" value={turnedInCount} color="#1a7f37" />
              <Stat label="Late" value={lateCount} color="#b26a00" />
              <Stat label="Missing" value={missingCount} color="#c62828" />
            </div>

            {courseWork.length === 0 && (
              <p style={{ color: '#555' }}>
                This class has no published assignments yet.
              </p>
            )}

            {view === 'grid' && courseWork.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, ...s.stickyCol }}>Student</th>
                      {courseWork.map((w) => (
                        <th style={s.th} key={w.id}>
                          <div>{w.title}</div>
                          <div style={s.thSub}>{formatDue(w.dueDate)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => (
                      <tr key={st.userId}>
                        <td style={{ ...s.td, ...s.stickyCol, fontWeight: 600 }}>{st.name}</td>
                        {courseWork.map((w) => {
                          const status = statusFor(submissionsByWork, w.id, st.userId);
                          return (
                            <td key={w.id} style={s.td}>
                              <span style={{ ...s.pill, color: status.color }}>
                                {status.label}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {view === 'missing' && (
              <div style={{ marginTop: 8 }}>
                {studentsWithMissing.length === 0 ? (
                  <p style={{ color: '#1a7f37', fontWeight: 600 }}>
                    Nobody has missing work right now.
                  </p>
                ) : (
                  studentsWithMissing.map((st) => (
                    <div key={st.userId} style={s.followUpCard}>
                      <div style={s.followUpName}>
                        {st.name}
                        <span style={s.badge}>
                          {missingByStudent[st.userId].length} missing
                        </span>
                      </div>
                      <ul style={s.missingList}>
                        {missingByStudent[st.userId].map((w) => (
                          <li key={w.id} style={s.missingItem}>
                            {w.title}{' '}
                            <span style={{ color: '#777' }}>· due {formatDue(w.dueDate)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={s.stat}>
      <div style={{ ...s.statValue, color: color || NAVY }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function Shell({ children, wide }) {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <div style={{ ...s.page, alignItems: wide ? 'flex-start' : 'center' }}>
        <div style={{ width: '100%', maxWidth: wide ? 1200 : 460 }}>{children}</div>
      </div>
    </>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: NAVY,
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: 28,
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  h1: { color: NAVY, fontSize: 22, margin: '0 0 8px 0' },
  sub: { color: '#555', marginBottom: 22, lineHeight: 1.5 },
  button: {
    display: 'inline-block',
    background: NAVY,
    color: GOLD,
    padding: '13px 24px',
    borderRadius: 9,
    textDecoration: 'none',
    fontWeight: 700,
  },
  linkSmall: { color: '#777', fontSize: 13, textDecoration: 'none' },
  errorBox: {
    background: '#fdecea',
    border: '1px solid #f5c2c0',
    color: '#8a1c17',
    padding: '12px 14px',
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 1.5,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  label: { fontWeight: 700, color: NAVY, fontSize: 14 },
  select: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #ccd',
    fontSize: 14,
    minWidth: 200,
  },
  toggleGroup: { display: 'flex', gap: 6, marginLeft: 'auto' },
  toggle: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #ccd',
    background: '#fff',
    color: '#444',
    cursor: 'pointer',
    fontSize: 14,
  },
  toggleActive: {
    padding: '8px 14px',
    borderRadius: 8,
    border: `1px solid ${NAVY}`,
    background: NAVY,
    color: GOLD,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 },
  stat: {
    background: '#f5f7fb',
    borderRadius: 10,
    padding: '12px 18px',
    minWidth: 92,
  },
  statValue: { fontSize: 24, fontWeight: 800, lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2, textTransform: 'uppercase' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 14 },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#f5f7fb',
    color: NAVY,
    borderBottom: '2px solid #e2e6ef',
    whiteSpace: 'nowrap',
    fontSize: 13,
  },
  thSub: { fontWeight: 400, color: '#888', fontSize: 11, marginTop: 2 },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #eef0f5',
    whiteSpace: 'nowrap',
  },
  stickyCol: { position: 'sticky', left: 0, background: '#fff', zIndex: 1 },
  pill: { fontWeight: 700, fontSize: 13 },
  followUpCard: {
    border: '1px solid #eef0f5',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  followUpName: {
    fontWeight: 700,
    color: NAVY,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    background: '#fdecea',
    color: '#c62828',
    fontSize: 12,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 20,
  },
  missingList: { margin: '10px 0 0 0', paddingLeft: 20 },
  missingItem: { fontSize: 14, marginBottom: 4, color: '#333' },
};
