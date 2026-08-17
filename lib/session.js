// Minimal cookie helpers. Next.js already parses incoming cookies for us
// (req.cookies), so we only need to build the Set-Cookie header ourselves.

export const COOKIE_NAME = 'gc_tokens';

export function buildSessionCookie(tokens) {
  const value = encodeURIComponent(JSON.stringify(tokens));
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`, // 30 days
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSession(req) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}
