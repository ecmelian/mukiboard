'use strict';
// GET /api/status?id=… — lets the app show "sent for review", "posted" (with the link) or "not posted".
const { cors, send, query } = require('../lib/http');
const store = require('../lib/store');
const { ID_RE } = require('./submit');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const id = query(req).get('id') || '';
  if (!ID_RE.test(id)) return send(res, 400, { error: 'bad id' });
  try {
    const it = await store.get(`xqueue/${id}`);
    if (!it || !it.status) return send(res, 404, { error: 'unknown' });
    return send(res, 200, { id, status: it.status, url: it.url || '' });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
};
