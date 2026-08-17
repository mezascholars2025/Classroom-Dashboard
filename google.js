import { getRedirectUri } from '../../../../lib/redirectUri';
import { buildSessionCookie } from '../../../../lib/session';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    res.redirect('/?error=' + encodeURIComponent(error));
    return;
  }

  if (!code) {
    res.redirect('/?error=' + encodeURIComponent('Missing authorization code from Google.'));
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: getRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok) {
      const msg = tokens.error_description || tokens.error || 'Token exchange failed';
      res.redirect('/?error=' + encodeURIComponent(msg));
      return;
    }

    res.setHeader(
      'Set-Cookie',
      buildSessionCookie({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + tokens.expires_in * 1000,
      })
    );

    res.redirect('/');
  } catch (err) {
    res.redirect('/?error=' + encodeURIComponent(err.message || 'Server error'));
  }
}
