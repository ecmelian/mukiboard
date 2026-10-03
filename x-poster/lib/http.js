'use strict';
// Small helpers shared by the API functions. Plain Node APIs only, so the
// handlers run unchanged on Vercel, on any Node http server, and in the tests.
const crypto = require('crypto');

const MAX_BODY = 4 * 1024 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, body, type) {
  res.statusCode = status;
  if (typeof body === 'string') {
    res.setHeader('Content-Type', type || 'text/html; charset=utf-8');
    res.end(body);
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }
}

function query(req) {
  return new URL(req.url || '/', 'http://localhost').searchParams;
}

// Vercel parses JSON bodies into req.body; a bare Node server leaves the
// stream untouched. Handle both.
async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const txt = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    return txt ? JSON.parse(txt) : {};
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw httpError(413, 'Body too large');
    chunks.push(chunk);
  }
  const txt = Buffer.concat(chunks).toString('utf8');
  return txt ? JSON.parse(txt) : {};
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '0.0.0.0';
}

// Hashed so the database never holds raw addresses.
function ipHash(req, salt) {
  return crypto.createHash('sha256').update(clientIp(req) + '|' + (salt || 'mdm')).digest('hex').slice(0, 16);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { cors, send, query, readJson, httpError, clientIp, ipHash, safeEqual, escapeHtml };
