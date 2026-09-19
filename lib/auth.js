'use strict';
/**
 * Session handling for the training portal.
 *
 * Deliberately simple, but NOT deliberately broken: the token is a signed
 * HMAC so that participants cannot mint an admin session without cracking a
 * password. The three vulnerabilities in this app are the ones the workshop
 * teaches (leaked .env, guessable paths, weak hashes) — token forgery is not
 * one of them, and a forgeable token would let people skip straight to the
 * end.
 */
const crypto = require('crypto');
const { MITARBEITER } = require('./data');

const SECRET = process.env.SESSION_SECRET || 'velorapid-workshop-signing-key';
const TTL_SECONDS = 60 * 60 * 4; // a session comfortably outlives a workshop

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

/** md5(cleartext) — the app's (bad) password scheme, kept in one place. */
function md5(value) {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

/**
 * Verify credentials against the staff table.
 * @returns the matching user record, or null.
 */
function authenticate(benutzername, passwort) {
  if (typeof benutzername !== 'string' || typeof passwort !== 'string') return null;
  const user = MITARBEITER.find(
    (m) => m.benutzername.toLowerCase() === benutzername.trim().toLowerCase()
  );
  if (!user) return null;
  const given = Buffer.from(md5(passwort));
  const stored = Buffer.from(user.passwort_md5);
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) return null;
  return user;
}

function issueToken(user) {
  const body = b64url(
    JSON.stringify({
      sub: user.benutzername,
      rolle: user.rolle,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    })
  );
  return `${body}.${sign(body)}`;
}

/**
 * @returns the token payload, or null if absent/tampered/expired.
 */
function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.', 2);
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac || '');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Pull the bearer token out of an incoming request's headers. */
function tokenFromHeaders(headers = {}) {
  const raw = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match ? match[1] : null;
}

module.exports = { authenticate, issueToken, verifyToken, tokenFromHeaders, md5 };
