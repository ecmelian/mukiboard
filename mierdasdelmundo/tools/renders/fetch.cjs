// Download the 3D renders listed in urls.json (asset name → image URL), trim and resize them into
// <appDir>/assets, and rebuild the app icons from the mascot.
//   node fetch.cjs <appDir> [urls.json]      (URLS env var with the same JSON overrides the file)
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const [, , appDir, urlsFile] = process.argv;
if (!appDir) { console.error('usage: node fetch.cjs <appDir> [urls.json]'); process.exit(1); }
const urls = JSON.parse(process.env.URLS && process.env.URLS.trim() ? process.env.URLS : fs.readFileSync(urlsFile || path.join(__dirname, 'urls.json'), 'utf8'));
const sizeFor = name => name === 'mascot' ? 512 : name.startsWith('av/') ? 320 : 256;

(async () => {
  const raw = path.join(__dirname, 'raw'); fs.mkdirSync(raw, { recursive: true });
  const manifest = []; const fails = [];
  for (const [name, url] of Object.entries(urls)) {
    try {
      const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 1000) throw new Error('too small (' + buf.length + ' bytes)');
      const f = path.join(raw, name.replace(/\//g, '_') + '.png'); fs.writeFileSync(f, buf);
      manifest.push({ name, file: f, size: sizeFor(name), pad: 0.02, key: false });
      console.log('downloaded', name, buf.length, 'bytes');
    } catch (e) { fails.push(name + ': ' + e.message); }
  }
  if (fails.length) console.error('FAILED:\n  ' + fails.join('\n  '));
  if (!manifest.length) process.exit(1);
  const mf = path.join(raw, 'manifest.json'); fs.writeFileSync(mf, JSON.stringify(manifest));
  execFileSync(process.execPath, [path.join(__dirname, 'assets.cjs'), mf, path.join(appDir, 'assets')], { stdio: 'inherit' });
  if (manifest.some(m => m.name === 'mascot')) execFileSync(process.execPath, [path.join(__dirname, 'icons-from-mascot.cjs'), appDir], { stdio: 'inherit' });
  if (fails.length) process.exit(2);
})().catch(e => { console.error(e); process.exit(1); });
