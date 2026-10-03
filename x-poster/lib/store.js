'use strict';
// Firebase Realtime Database over plain REST (same approach as the app and MukiBoard: no SDK).
// Everything lives under `${FIREBASE_ROOT}/`:
//   xqueue/{id}        submission metadata + status (pending | posted | rejected)
//   ximg/{id}          the photo as a data URL, removed once posted or rejected
//   xrate/{ip}/{hour}  per-IP submission counters

function cfg() {
  const url = (process.env.FIREBASE_URL || 'https://mukiboard-default-rtdb.firebaseio.com').replace(/\/+$/, '');
  const root = (process.env.FIREBASE_ROOT || 'mierdasdelmundo').replace(/^\/+|\/+$/g, '');
  const secret = process.env.FIREBASE_SECRET || '';
  return { url, root, secret };
}

async function rtdb(path, method = 'GET', body, params) {
  const { url, root, secret } = cfg();
  const qs = new URLSearchParams(params || {});
  if (secret) qs.set('auth', secret);
  const q = qs.toString();
  const full = `${url}/${root}/${path.replace(/^\/+/, '')}.json${q ? '?' + q : ''}`;
  const r = await fetch(full, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    const e = new Error(`Database ${method} ${path} failed: ${r.status} ${txt.slice(0, 200)}`);
    e.status = 502;
    throw e;
  }
  if (method === 'DELETE') return null;
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

const get = (path, params) => rtdb(path, 'GET', undefined, params);
const put = (path, body) => rtdb(path, 'PUT', body);
const patch = (path, body) => rtdb(path, 'PATCH', body);
const del = (path) => rtdb(path, 'DELETE');

// Pending items, newest first. Uses the `status` index when the rules define it and falls back to a
// full read otherwise (fine for a small queue; the images live in a separate node).
async function listPending(limit = 50) {
  let all;
  try {
    all = await get('xqueue', { orderBy: '"status"', equalTo: '"pending"', limitToLast: String(limit) });
  } catch (e) {
    all = await get('xqueue');
  }
  const items = Object.values(all || {}).filter(x => x && x.status === 'pending');
  items.sort((a, b) => (b.submitted || 0) - (a.submitted || 0));
  return items.slice(0, limit);
}

// Count submissions from one hashed IP in the current hour (not atomic; enough to stop a script
// from flooding the queue). Returns false when the limit is reached.
async function bumpRate(ipHash, max) {
  const hour = Math.floor(Date.now() / 3600000);
  const path = `xrate/${ipHash}/${hour}`;
  const n = (await get(path)) || 0;
  if (n >= max) return false;
  await put(path, n + 1);
  return true;
}

module.exports = { cfg, get, put, patch, del, listPending, bumpRate };
