'use strict';
// Runs the API functions against an in-memory database and a fake X, through a real HTTP server.
const http = require('http');
const assert = require('assert');
const x = require('../lib/x');
const caption = require('../lib/caption');

process.env.ADMIN_KEY = 'test-admin-key';
process.env.X_API_KEY = 'ck'; process.env.X_API_SECRET = 'cs'; process.env.X_ACCESS_TOKEN = 'tk'; process.env.X_ACCESS_SECRET = 'ts';
process.env.X_HANDLE = 'mierdasdelmundo'; process.env.MAX_PER_HOUR = '3';
process.env.FIREBASE_URL = 'https://fake-db.test'; process.env.FIREBASE_ROOT = 'mdm';

// ---- OAuth 1.0a against the worked example in the X docs ----
{
  const c = { key: 'xvz1evFS4wEEPTGEFPHBog', secret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE' };
  const { baseStr, signature } = x.oauthHeader('POST', 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true',
    { status: 'Hello Ladies + Gentlemen, a signed OAuth request!' }, c, { oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', oauth_timestamp: '1318622958' });
  assert.strictEqual(baseStr, 'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521');
  assert.strictEqual(signature, 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
  console.log('PASS oauth signature base string and HMAC match the documented example');
}

// ---- caption ----
{
  const txt = caption.render({ species: 'Metro Mouth', shiny: true, city: 'São Paulo', cc: 'BR', ts: Date.UTC(2026, 9, 3, 14, 5), lat: -23.5506, lng: -46.6333 });
  assert(txt.startsWith('💩 Metro Mouth ✨ spotted in São Paulo · 2026-10-03 14:05 UTC'), txt);
  assert(txt.includes('https://www.openstreetmap.org/?mlat=-23.551&mlon=-46.633#map=17/-23.551/-46.633'), txt);
  assert(txt.includes('#mierdasdelmundo #SaoPaulo'), txt);
  const long = caption.render({ species: 'X'.repeat(400), city: 'Madrid', ts: 0, lat: 40.4, lng: -3.7 });
  assert(long.replace(/https?:\/\/\S+/g, '').length <= 280 - 23, 'long caption trimmed: ' + long.length);
  const car = caption.render({ kind: 'car', species: 'Double Parker', city: 'Madrid', ts: 0, lat: 40.4, lng: -3.7 });
  assert(car.startsWith('🚗 Double Parker spotted in Madrid'), car);
  assert.strictEqual(caption.render({ kind: 'cone', species: 'Cone Wall', city: 'Lisboa', ts: 0, lat: 38.7, lng: -9.1 }, '{icon} {kind}: {species}'), '🚧 cone holding public parking: Cone Wall');
  console.log('PASS caption rendering, kinds and trimming');
}

// ---- fake database + fake X behind global fetch ----
const db = {}; const realFetch = globalThis.fetch; const xCalls = [];
function dbGet(path) { let n = db; for (const k of path) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; }
function dbSet(path, v) { let n = db; for (const k of path.slice(0, -1)) { if (n[k] == null || typeof n[k] !== 'object') n[k] = {}; n = n[k]; } if (v === null) delete n[path[path.length - 1]]; else n[path[path.length - 1]] = v; }
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname === '127.0.0.1') return realFetch(url, opts);
  if (u.hostname === 'fake-db.test') {
    const path = u.pathname.replace(/\.json$/, '').split('/').filter(Boolean);
    const m = (opts.method || 'GET').toUpperCase();
    if (m === 'GET') {
      let v = dbGet(path);
      if (u.searchParams.get('orderBy') && v && typeof v === 'object') { const f = JSON.parse(u.searchParams.get('orderBy')); const eq = JSON.parse(u.searchParams.get('equalTo')); v = Object.fromEntries(Object.entries(v).filter(([, it]) => it && it[f] === eq)); }
      return json(200, v);
    }
    if (m === 'PUT') { dbSet(path, JSON.parse(opts.body)); return json(200, JSON.parse(opts.body)); }
    if (m === 'PATCH') { const cur = dbGet(path) || {}; dbSet(path, Object.assign({}, cur, JSON.parse(opts.body))); return json(200, {}); }
    if (m === 'DELETE') { dbSet(path, null); return json(200, null); }
  }
  if (u.hostname === 'api.x.com' || u.hostname === 'upload.twitter.com') {
    xCalls.push({ url: url, auth: opts.headers && opts.headers.Authorization, body: opts.body });
    assert(/^OAuth oauth_consumer_key="ck", oauth_nonce="[0-9a-f]{32}", oauth_signature=".+", oauth_signature_method="HMAC-SHA1", oauth_timestamp="\d+", oauth_token="tk", oauth_version="1.0"$/.test(opts.headers.Authorization), 'signed: ' + opts.headers.Authorization);
    if (u.pathname === '/2/media/upload') { assert(opts.body instanceof FormData && opts.body.get('media') instanceof Blob && opts.body.get('media_category') === 'tweet_image'); return json(200, { data: { id: '711', media_key: '3_711' } }); }
    if (u.pathname === '/2/tweets') { const b = JSON.parse(opts.body); assert.deepStrictEqual(b.media, { media_ids: ['711'] }); assert(b.text.length > 0); return json(201, { data: { id: '1234567890', text: b.text } }); }
  }
  throw new Error('unexpected fetch ' + url);
};

const handlers = { '/api/submit': require('../api/submit'), '/api/status': require('../api/status'), '/api/review': require('../api/review') };
const server = http.createServer((req, res) => { const h = handlers[req.url.split('?')[0]]; if (!h) { res.statusCode = 404; return res.end(); } h(req, res); });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = 'GET', body, headers = {}) => { const r = await realFetch(base + path, { method, headers: Object.assign(body ? { 'Content-Type': 'application/json' } : {}, headers), body: body ? JSON.stringify(body) : undefined }); const txt = await r.text(); let data; try { data = JSON.parse(txt); } catch (e) { data = txt; } return { status: r.status, data, headers: r.headers }; };
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xFF, 0xD9]).toString('base64');
  const good = (id) => ({ id, ts: Date.UTC(2026, 9, 3, 9, 30), lat: 40.41679, lng: -3.70379, city: 'Madrid', cc: 'ES', species: 'Metro Mouth', speciesId: 'metro', rarity: 'rare', shiny: false, cp: 321, kind: 'car', size: 'M', fresh: 'fresh', trainer: 'Ana', tid: 't_1', faces: 1, blurred: true, image: jpeg });

  let r = await call('/api/submit', 'OPTIONS'); assert.strictEqual(r.status, 204); assert.strictEqual(r.headers.get('access-control-allow-origin'), '*'); console.log('PASS CORS preflight');
  r = await call('/api/submit', 'POST', Object.assign(good('c_nolur'), { blurred: false })); assert.strictEqual(r.status, 400); assert(/blurred/.test(r.data.error)); console.log('PASS unblurred photo refused');
  r = await call('/api/submit', 'POST', Object.assign(good('c_noface'), { faces: null })); assert.strictEqual(r.status, 400); console.log('PASS photo without a face check refused');
  r = await call('/api/submit', 'POST', Object.assign(good('c_noloc'), { lat: null })); assert.strictEqual(r.status, 400); assert(/location/.test(r.data.error)); console.log('PASS capture without location refused');
  r = await call('/api/submit', 'POST', Object.assign(good('c_badimg'), { image: 'data:text/plain;base64,aGk=' })); assert.strictEqual(r.status, 400); console.log('PASS non-image refused');
  r = await call('/api/submit', 'POST', good('c_one')); assert.strictEqual(r.status, 202); assert.deepStrictEqual(r.data, { id: 'c_one', status: 'pending' }); console.log('PASS valid capture queued (202 pending)');
  assert.strictEqual(dbGet(['mdm', 'xqueue', 'c_one']).lat, 40.417); assert.strictEqual(dbGet(['mdm', 'xqueue', 'c_one']).status, 'pending'); assert.strictEqual(dbGet(['mdm', 'xqueue', 'c_one']).kind, 'car'); assert.strictEqual(dbGet(['mdm', 'ximg', 'c_one']), jpeg); assert(!('image' in dbGet(['mdm', 'xqueue', 'c_one']))); console.log('PASS stored with 3-decimal coordinates, photo in its own node');
  r = await call('/api/submit', 'POST', good('c_one')); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.status, 'pending'); console.log('PASS resubmitting the same capture returns its status without a new entry');
  r = await call('/api/status?id=c_one'); assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.data, { id: 'c_one', status: 'pending', url: '' }); console.log('PASS status endpoint');
  r = await call('/api/status?id=c_nope'); assert.strictEqual(r.status, 404); r = await call('/api/status?id=../x'); assert.strictEqual(r.status, 400); console.log('PASS status rejects unknown and malformed ids');
  assert.strictEqual(xCalls.length, 0, 'nothing posted to X without a review');

  r = await call('/api/review'); assert.strictEqual(r.status, 401); r = await call('/api/review?key=wrong&list=1'); assert.strictEqual(r.status, 401); r = await call('/api/review', 'POST', { id: 'c_one', action: 'approve' }); assert.strictEqual(r.status, 401); console.log('PASS review page and actions need the admin key');
  r = await call('/api/review?key=test-admin-key'); assert.strictEqual(r.status, 200); assert(/X review/.test(r.data) && /Approve and post/.test(r.data)); console.log('PASS review page served');
  r = await call('/api/review?key=test-admin-key&list=1'); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.items.length, 1); assert.strictEqual(r.data.items[0].id, 'c_one'); assert(r.data.items[0].caption.startsWith('🚗 Metro Mouth')); assert(!('ip' in r.data.items[0]) || r.data.items[0].ip === undefined); console.log('PASS pending list with caption, no IP hash');
  r = await call('/api/review?key=test-admin-key&img=c_one'); assert.strictEqual(r.status, 200); assert.strictEqual(r.headers.get('content-type'), 'image/jpeg'); console.log('PASS queued photo served to the reviewer');
  r = await call('/api/review', 'POST', { key: 'test-admin-key', id: 'c_one', action: 'approve', text: 'Custom text from the reviewer' }); assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.data, { id: 'c_one', status: 'posted', url: 'https://x.com/mierdasdelmundo/status/1234567890' }); console.log('PASS approve uploads the photo and posts');
  assert.strictEqual(xCalls.length, 2); assert(xCalls[0].url.endsWith('/2/media/upload')); assert(JSON.parse(xCalls[1].body).text === 'Custom text from the reviewer'); assert.strictEqual(dbGet(['mdm', 'ximg', 'c_one']), null); assert.strictEqual(dbGet(['mdm', 'xqueue', 'c_one']).postId, '1234567890'); console.log('PASS media upload then post with the edited text; photo removed from the queue');
  r = await call('/api/status?id=c_one'); assert.strictEqual(r.data.status, 'posted'); assert(/status\/1234567890/.test(r.data.url)); console.log('PASS status now posted with the link');
  r = await call('/api/review', 'POST', { key: 'test-admin-key', id: 'c_one', action: 'approve' }); assert.strictEqual(r.status, 409); console.log('PASS approving twice is refused');

  r = await call('/api/submit', 'POST', good('c_two')); assert.strictEqual(r.status, 202);
  r = await call('/api/review', 'POST', { key: 'test-admin-key', id: 'c_two', action: 'reject' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.status, 'rejected'); assert.strictEqual(dbGet(['mdm', 'ximg', 'c_two']), null); assert.strictEqual(dbGet(['mdm', 'xqueue', 'c_two']).trainer, undefined); console.log('PASS reject drops the photo and the details, keeps a tombstone');
  r = await call('/api/submit', 'POST', good('c_two')); assert.strictEqual(r.status, 200); assert.strictEqual(r.data.status, 'rejected'); console.log('PASS a rejected capture cannot be resubmitted');
  r = await call('/api/status?id=c_two'); assert.strictEqual(r.data.status, 'rejected');

  r = await call('/api/submit', 'POST', good('c_three')); assert.strictEqual(r.status, 202);
  r = await call('/api/submit', 'POST', good('c_four')); assert.strictEqual(r.status, 429); assert(/too many/.test(r.data.error)); console.log('PASS per-IP rate limit (3 per hour in this test)');
  r = await call('/api/submit', 'POST', good('c_five'), { 'x-forwarded-for': '203.0.113.9' }); assert.strictEqual(r.status, 202); console.log('PASS another address is not affected');
  r = await call('/api/review?key=test-admin-key&list=1'); assert.deepStrictEqual(r.data.items.map(i => i.id).sort(), ['c_five', 'c_three']); console.log('PASS pending list shows only the pending ones');

  // media upload falls back to the v1.1 endpoint when v2 is not available to the app
  const v2 = globalThis.fetch; let v1Used = false;
  globalThis.fetch = async (url, opts) => { const u = new URL(url); if (u.pathname === '/2/media/upload') return json(404, { title: 'Not Found' }); if (u.hostname === 'upload.twitter.com') { v1Used = true; xCalls.push({ url }); return json(200, { media_id_string: '42' }); } if (u.pathname === '/2/tweets') { assert.deepStrictEqual(JSON.parse(opts.body).media, { media_ids: ['42'] }); xCalls.push({ url }); return json(201, { data: { id: '77' } }); } return v2(url, opts); };
  r = await call('/api/review', 'POST', { key: 'test-admin-key', id: 'c_three', action: 'approve' }); assert.strictEqual(r.status, 200); assert(v1Used); assert(/status\/77$/.test(r.data.url)); console.log('PASS v1.1 media upload fallback');
  globalThis.fetch = v2;

  server.close(); console.log('\nALL PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
