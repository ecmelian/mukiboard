'use strict';
// Posting to X with the official account's own credentials (OAuth 1.0a user
// context). Keys come from environment variables only; nothing here is ever
// shipped to the phone app.
const crypto = require('crypto');

function creds() {
  const c = {
    key: process.env.X_API_KEY || '',
    secret: process.env.X_API_SECRET || '',
    token: process.env.X_ACCESS_TOKEN || '',
    tokenSecret: process.env.X_ACCESS_SECRET || '',
  };
  if (!c.key || !c.secret || !c.token || !c.tokenSecret) {
    const e = new Error('X credentials are not configured (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)');
    e.status = 503;
    throw e;
  }
  return c;
}

// RFC 3986 percent-encoding, as OAuth 1.0a requires.
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Build the Authorization header. `params` are the query-string and
// form-urlencoded body parameters that must be signed; multipart bodies are
// not part of the signature.
function oauthHeader(method, url, params, c, extra) {
  const o = Object.assign({
    oauth_consumer_key: c.key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: c.token,
    oauth_version: '1.0',
  }, extra || {});
  const u = new URL(url);
  const base = `${u.protocol}//${u.host}${u.pathname}`;
  const all = [];
  u.searchParams.forEach((v, k) => all.push([enc(k), enc(v)]));
  for (const [k, v] of Object.entries(params || {})) all.push([enc(k), enc(v)]);
  for (const [k, v] of Object.entries(o)) all.push([enc(k), enc(v)]);
  all.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const paramStr = all.map(([k, v]) => `${k}=${v}`).join('&');
  const baseStr = `${method.toUpperCase()}&${enc(base)}&${enc(paramStr)}`;
  const signingKey = `${enc(c.secret)}&${enc(c.tokenSecret)}`;
  const sig = crypto.createHmac('sha1', signingKey).update(baseStr).digest('base64');
  o.oauth_signature = sig;
  const header = 'OAuth ' + Object.keys(o).sort().map(k => `${enc(k)}="${enc(o[k])}"`).join(', ');
  return { header, baseStr, signature: sig };
}

async function signedFetch(method, url, { params, form, json, c } = {}) {
  const { header } = oauthHeader(method, url, params, c || creds());
  const headers = { Authorization: header };
  let body;
  if (form) body = form;
  else if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const r = await fetch(url, { method, headers, body });
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { raw: txt.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, data };
}

function mediaForm(buf, mime, category) {
  const fd = new FormData();
  fd.append('media', new Blob([buf], { type: mime }), 'photo' + (mime === 'image/png' ? '.png' : '.jpg'));
  if (category) fd.append('media_category', category);
  return fd;
}

// v2 media upload first; the v1.1 endpoint as a fallback for apps that are
// still on it. Returns the media id string.
async function uploadMedia(buf, mime, c) {
  const v2 = await signedFetch('POST', 'https://api.x.com/2/media/upload', { form: mediaForm(buf, mime, 'tweet_image'), c });
  if (v2.ok && v2.data && v2.data.data && v2.data.data.id) return String(v2.data.data.id);
  const v1 = await signedFetch('POST', 'https://upload.twitter.com/1.1/media/upload.json', { form: mediaForm(buf, mime), c });
  if (v1.ok && v1.data && v1.data.media_id_string) return String(v1.data.media_id_string);
  const e = new Error(`Media upload failed: v2 ${v2.status} ${JSON.stringify(v2.data).slice(0, 200)} / v1.1 ${v1.status} ${JSON.stringify(v1.data).slice(0, 200)}`);
  e.status = 502;
  throw e;
}

async function createPost(text, mediaId, c) {
  const body = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };
  const r = await signedFetch('POST', 'https://api.x.com/2/tweets', { json: body, c });
  if (!r.ok || !r.data || !r.data.data || !r.data.data.id) {
    const e = new Error(`Post failed: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    e.status = 502;
    throw e;
  }
  const id = String(r.data.data.id);
  const handle = (process.env.X_HANDLE || '').replace(/^@/, '');
  return { id, url: handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/web/status/${id}` };
}

function decodeDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!m) throw Object.assign(new Error('image must be a JPEG, PNG or WebP data URL'), { status: 400 });
  return { mime: m[1], buf: Buffer.from(m[2].replace(/\s+/g, ''), 'base64') };
}

// Upload the photo and publish the post. Returns { id, url }.
async function postPhoto(text, dataUrl) {
  const c = creds();
  const { mime, buf } = decodeDataUrl(dataUrl);
  const mediaId = await uploadMedia(buf, mime, c);
  return createPost(text, mediaId, c);
}

module.exports = { creds, enc, oauthHeader, signedFetch, uploadMedia, createPost, decodeDataUrl, postPhoto };
