import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Anonymous, signed session identity – no login required, but every browser
 * only ever sees its own conversations. The cookie is `id.signature`; the
 * HMAC signature stops anyone forging another visitor's id.
 *
 * To upgrade to real accounts later, replace `req.sessionId` with the
 * authenticated user id – nothing else in the codebase needs to change.
 */
const COOKIE = 'vc_sid';
const ONE_YEAR = 60 * 60 * 24 * 365;

const sign = (id) => crypto.createHmac('sha256', env.sessionSecret).update(id).digest('base64url');

const parseCookies = (header = '') =>
  Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k, v]) => k && v !== undefined)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
  );

const verify = (raw) => {
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig || !/^[a-f0-9]{32}$/.test(id)) return null;
  const expected = sign(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? id : null;
};

export const session = (req, res, next) => {
  let id = verify(parseCookies(req.headers.cookie)[COOKIE]);
  if (!id) {
    id = crypto.randomBytes(16).toString('hex');
    const attrs = [`${COOKIE}=${id}.${sign(id)}`, 'Path=/', `Max-Age=${ONE_YEAR}`, 'HttpOnly', 'SameSite=Lax'];
    if (env.isProduction) attrs.push('Secure');
    res.setHeader('Set-Cookie', attrs.join('; '));
  }
  req.sessionId = id;
  next();
};
