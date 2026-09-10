const jwt = require('jsonwebtoken');
const env = require('../config/env');

const COOKIE_NAME = 'access_token';

function signToken(user) {
  // Only the id goes in the token. Role and permissions are re-read from the
  // database on every request so a revoked permission takes effect immediately.
  return jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

/**
 * A short-lived token for the websocket handshake.
 *
 * When the site and the API sit on different domains the browser will not send
 * the auth cookie to the socket, so the page fetches this over the normal API
 * call and hands it to Socket.IO instead. It expires in minutes and carries
 * nothing but the user id.
 */
function signSocketToken(user) {
  return jwt.sign({ sub: user._id.toString(), scope: 'socket' }, env.JWT_SECRET, {
    expiresIn: '5m',
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

module.exports = {
  signToken,
  signSocketToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
};
