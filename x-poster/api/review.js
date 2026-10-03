'use strict';
// The review page. Nothing reaches X unless the account owner approves it here, photo in view.
//   GET  /api/review?key=…          the page
//   GET  /api/review?key=…&list=1   pending items as JSON (no images)
//   GET  /api/review?key=…&img=ID   one queued photo
//   POST /api/review  {key, id, action: 'approve' | 'reject', text?}
const { send, query, readJson, httpError, safeEqual } = require('../lib/http');
const store = require('../lib/store');
const x = require('../lib/x');
const caption = require('../lib/caption');
const { ID_RE } = require('./submit');

function authed(req, body) {
  const key = query(req).get('key') || req.headers['x-admin-key'] || (body && body.key) || '';
  return !!process.env.ADMIN_KEY && safeEqual(key, process.env.ADMIN_KEY);
}

async function approve(id, text) {
  const rec = await store.get(`xqueue/${id}`);
  if (!rec || rec.status !== 'pending') throw httpError(409, 'not pending');
  const image = await store.get(`ximg/${id}`);
  if (!image) throw httpError(410, 'the photo is gone');
  const posted = await x.postPhoto((text && text.trim()) || caption.render(rec), image);
  Object.assign(rec, { status: 'posted', url: posted.url, postId: posted.id, posted: Date.now() });
  await store.put(`xqueue/${id}`, rec);
  await store.del(`ximg/${id}`);
  return { id, status: 'posted', url: posted.url };
}

async function reject(id) {
  const rec = await store.get(`xqueue/${id}`);
  if (!rec) throw httpError(404, 'unknown');
  await store.put(`xqueue/${id}`, { id, status: 'rejected', submitted: rec.submitted || null, reviewed: Date.now() });
  await store.del(`ximg/${id}`);
  return { id, status: 'rejected' };
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const body = (await readJson(req)) || {};
      if (!authed(req, body)) throw httpError(401, 'bad key');
      if (!ID_RE.test(body.id || '')) throw httpError(400, 'bad id');
      if (body.action === 'approve') return send(res, 200, await approve(body.id, body.text));
      if (body.action === 'reject') return send(res, 200, await reject(body.id));
      throw httpError(400, 'action must be approve or reject');
    }
    if (req.method !== 'GET') throw httpError(405, 'GET or POST');
    if (!authed(req)) return send(res, 401, PAGE_NOKEY);
    const q = query(req);
    if (q.get('img')) {
      const id = q.get('img');
      if (!ID_RE.test(id)) throw httpError(400, 'bad id');
      const du = await store.get(`ximg/${id}`);
      if (!du) throw httpError(404, 'no photo');
      const { buf, mime } = x.decodeDataUrl(du);
      res.statusCode = 200;
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.end(buf);
    }
    if (q.get('list')) {
      const items = await store.listPending(50);
      return send(res, 200, { items: items.map(it => ({ ...it, ip: undefined, caption: caption.render(it) })) });
    }
    return send(res, 200, PAGE);
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
};

const PAGE_NOKEY = '<!doctype html><meta charset="utf-8"><title>mierdasdelmundo</title><p style="font-family:Helvetica,Arial,sans-serif;padding:24px">Add <code>?key=…</code> (the ADMIN_KEY) to the URL.</p>';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>mierdasdelmundo · X review</title>
<style>
:root{--ink:#000;--soft:#666;--line:#E3E3E3;--surface:#F4F4F4;--green:#16A34A}
*{box-sizing:border-box}body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;background:#fff;color:var(--ink)}
header{padding:16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
h1{font-size:16px;margin:0}#count{color:var(--soft);font-size:13px}
main{max-width:560px;margin:0 auto;padding:12px}
.card{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:14px}
.card img{display:block;width:100%;background:var(--surface)}
.body{padding:12px}.meta{font-size:13px;color:var(--soft);margin-bottom:8px;line-height:1.4}
textarea{width:100%;min-height:96px;border:1px solid var(--line);border-radius:10px;padding:10px;font:14px "Helvetica Neue",Helvetica,Arial,sans-serif}
.row{display:flex;gap:8px;margin-top:10px}
button{flex:1;border:1.5px solid var(--ink);background:#fff;color:var(--ink);padding:12px;border-radius:12px;font-weight:700;font-size:15px;font-family:inherit}
button.ok{background:var(--green);border-color:var(--green);color:#fff}button[disabled]{opacity:.5}
.warn{background:var(--surface);border-radius:10px;padding:10px;font-size:13px;margin-bottom:12px}
.empty{color:var(--soft);text-align:center;padding:40px 0}
#toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#000;color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;display:none;max-width:90vw}
</style></head><body>
<header><h1>mierdasdelmundo · X review</h1><span id="count"></span></header>
<main>
<div class="warn">Faces were blurred on the phone. Before approving, check that nobody is identifiable and that the photo shows a poop, not a person. Edit the text if you like.</div>
<div id="list"></div>
</main>
<div id="toast"></div>
<script>
var key=new URLSearchParams(location.search).get('key')||'';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var toastT;function toast(m){var t=document.getElementById('toast');t.textContent=m;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(function(){t.style.display='none';},3000);}
function setCount(n){document.getElementById('count').textContent=n+' pending';}
function card(it){
  var when=new Date(it.ts).toISOString().replace('T',' ').slice(0,16)+' UTC';
  return '<div class="card" data-id="'+esc(it.id)+'"><img src="?img='+encodeURIComponent(it.id)+'&key='+encodeURIComponent(key)+'" alt="">'
    +'<div class="body"><div class="meta">'+esc(it.species)+(it.shiny?' ✨':'')+' · '+esc(it.rarity)+' · '+esc(it.city||'no city')+(it.cc?' ('+esc(it.cc)+')':'')+' · '+esc(when)
    +'<br>by '+esc(it.trainer)+' · faces blurred on the phone: '+esc(it.faces)+'</div>'
    +'<textarea>'+esc(it.caption)+'</textarea>'
    +'<div class="row"><button data-act="reject">Reject</button><button class="ok" data-act="approve">Approve and post</button></div></div></div>';
}
function load(){
  return fetch('?list=1&key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    var items=d.items||[]; setCount(items.length);
    document.getElementById('list').innerHTML=items.length?items.map(card).join(''):'<div class="empty">Nothing to review 💩</div>';
  });
}
document.getElementById('list').addEventListener('click',function(e){
  var b=e.target.closest('button[data-act]'); if(!b) return;
  var c=b.closest('.card'), id=c.dataset.id, text=c.querySelector('textarea').value, btns=c.querySelectorAll('button');
  btns.forEach(function(x){x.disabled=true;});
  fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key,id:id,action:b.dataset.act,text:text})})
    .then(function(r){return r.json().then(function(d){if(!r.ok) throw new Error(d.error||r.status);return d;});})
    .then(function(d){toast(d.status==='posted'?'Posted: '+d.url:'Rejected');c.remove();setCount(document.querySelectorAll('.card').length);})
    .catch(function(err){toast('Error: '+err.message);btns.forEach(function(x){x.disabled=false;});});
});
load().catch(function(e){toast('Error: '+e.message);});
</script></body></html>`;
