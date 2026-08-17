import { clearSessionCookie } from '../../../lib/session';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.redirect('/');
}
