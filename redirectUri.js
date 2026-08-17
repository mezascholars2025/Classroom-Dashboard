// Works out the correct OAuth redirect URI for whatever environment we're in,
// so the same code works locally (localhost:3000) and deployed (Vercel).
export function getRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host || 'localhost:3000';
  const proto =
    req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https');

  return `${proto}://${host}/api/auth/callback/google`;
}
