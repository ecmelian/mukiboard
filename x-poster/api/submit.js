'use strict';
// POST /api/submit — the app sends a capture (faces blurred on the phone, rounded coordinates).
// It only ever lands in the review queue: a person approves or rejects it on /api/review.
const { cors, send, readJson, httpError, ipHash } = require('../lib/http');
const store = require('../lib/store');
const x = require('../lib/x');

const MAX_IMAGE = 1.5 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

function clean(b) {
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi) ? v : null;
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  return {
    id: str(b.id, 64),
    ts: num(b.ts, 0, 4102444800000) || Date.now(),
    lat: num(b.lat, -90, 90),
    lng: num(b.lng, -180, 180),
    city: str(b.city, 60) || null,
    cc: str(b.cc, 2).toUpperCase() || null,
    species: str(b.species, 40) || 'A poop',
    speciesId: str(b.speciesId, 40) || null,
    rarity: str(b.rarity, 12) || 'common',
    shiny: b.shiny === true,
    cp: num(b.cp, 0, 99999),
    size: str(b.size, 2) || null,
    fresh: str(b.fresh, 8) || null,
    trainer: str(b.trainer, 24) || 'Anonymous',
    tid: str(b.tid, 40) || null,
    faces: Number.isInteger(b.faces) ? b.faces : null,
    blurred: b.blurred === true,
  };
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const body = (await readJson(req)) || {};
    const item = clean(body);
    if (!ID_RE.test(item.id)) throw httpError(400, 'bad id');
    if (item.lat == null || item.lng == null) throw httpError(400, 'a location is required');
    if (!item.blurred || item.faces == null) throw httpError(400, 'the photo must be face-checked and blurred on the phone first');
    const { buf, mime } = x.decodeDataUrl(body.image);
    if (buf.length > MAX_IMAGE) throw httpError(413, 'image too large');

    const existing = await store.get(`xqueue/${item.id}`);
    if (existing && existing.status) return send(res, 200, { id: item.id, status: existing.status, url: existing.url || '' });

    const max = parseInt(process.env.MAX_PER_HOUR || '5', 10);
    const ip = ipHash(req, process.env.ADMIN_KEY);
    if (!(await store.bumpRate(ip, max))) throw httpError(429, 'too many submissions, try again later');

    const rec = { ...item, lat: +item.lat.toFixed(3), lng: +item.lng.toFixed(3), status: 'pending', submitted: Date.now(), ip, mime, bytes: buf.length };
    await store.put(`ximg/${item.id}`, body.image);
    await store.put(`xqueue/${item.id}`, rec);
    return send(res, 202, { id: item.id, status: 'pending' });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
};
module.exports.ID_RE = ID_RE;
