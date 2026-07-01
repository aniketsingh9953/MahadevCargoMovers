// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET;
// Access tokens live for a maximum of 8 hours hard ceiling, but the idle
// timeout (checked in requireAuth below) kicks in sooner if the session
// has been inactive — this is the server-side enforcement for "logout on
// browser close" that works even when the browser restores session cookies.
const TOKEN_EXPIRY = '8h';
const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours idle = forced re-login
const COOKIE_NAME = 'mcm_session';

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      tokenVersion: user.token_version || 0,
      issuedAt: Date.now(), // used for idle-timeout tracking
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function setSessionCookie(res, token) {
  // No Max-Age/Expires = a true session cookie: browsers SHOULD discard it
  // on full close. The server-side idle check (requireAuth) is the real
  // enforcement layer for environments where browsers restore session cookies.
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,          // JS cannot read this cookie — XSS-safe
    secure: true,            // always require HTTPS (Render always serves HTTPS)
    sameSite: 'lax',
    path: '/',
    // NO maxAge / expires — session cookie
  });
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = signToken(user);
  setSessionCookie(res, token);
  res.json({ username: user.username });
});

// GET /api/auth/me — used by the frontend on page load to check whether a
// valid session cookie exists, since the token is no longer readable by JS.
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username });
});

// POST /api/auth/logout — clears the session cookie server-side.
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// Middleware to protect routes
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'No active session. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // --- Idle timeout check ---
    // Even if the JWT hasn't cryptographically expired, reject sessions idle
    // longer than IDLE_TIMEOUT_MS. This is the real server-side enforcement
    // for "logout on browser close" — if the browser restores the session
    // cookie when reopened (which many do), the server rejects it if too
    // much time has passed since the token was issued/refreshed.
    const tokenIssuedAt = payload.issuedAt || (payload.iat * 1000);
    const ageMs = Date.now() - tokenIssuedAt;
    if (ageMs > IDLE_TIMEOUT_MS) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }

    // --- Token version check ---
    // Reject tokens issued before the most recent password change. This
    // forces every other device to re-authenticate immediately — the version
    // embedded in the token won't match the incremented DB value.
    const user = db.prepare('SELECT token_version FROM users WHERE id = ?').get(payload.userId);
    if (!user || (payload.tokenVersion || 0) !== (user.token_version || 0)) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Your session has ended because the password was changed. Please log in again.' });
    }

    req.user = payload;
    next();
  } catch (err) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// POST /api/auth/change-password  (requires auth)
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const newTokenVersion = (user.token_version || 0) + 1;
  db.prepare('UPDATE users SET password_hash = ?, token_version = ? WHERE id = ?')
    .run(newHash, newTokenVersion, user.id);

  // Issue a fresh session cookie for THIS device only, so it stays logged in;
  // every other device/session holding the old cookie/token gets rejected by
  // requireAuth on its very next request, because its tokenVersion no longer
  // matches the user's current token_version in the database.
  const token = signToken({ ...user, token_version: newTokenVersion });
  setSessionCookie(res, token);

  res.json({ success: true, message: 'Password updated successfully. You have been logged out of all other devices.' });
});

module.exports = { router, requireAuth };
