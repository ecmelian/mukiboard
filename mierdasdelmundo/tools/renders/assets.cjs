// Usage: node assets.cjs manifest.json outDir
// manifest: [{name, file (downloaded source), size (px), pad (0-0.3), key (true: remove white bg)}]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [,, manifestPath, outDir] = process.argv; const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  for (const it of items) {
    const b64 = fs.readFileSync(it.file).toString('base64'); const mime = it.file.endsWith('.png') ? 'image/png' : it.file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const out = await page.evaluate(async ({ b64, mime, size, pad, key }) => {
      const img = new Image(); img.src = `data:${mime};base64,${b64}`; await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const id = x.getImageData(0, 0, W, H); const d = id.data;
      if (key) {
        // 1) flood fill near-white from the borders → background mask
        const bg = new Uint8Array(W * H); const stack = []; const isWhite = i => d[i * 4] > 238 && d[i * 4 + 1] > 238 && d[i * 4 + 2] > 238;
        const push = i => { if (!bg[i] && isWhite(i)) { bg[i] = 1; stack.push(i); } };
        for (let xx = 0; xx < W; xx++) { push(xx); push((H - 1) * W + xx); } for (let yy = 0; yy < H; yy++) { push(yy * W); push(yy * W + W - 1); }
        while (stack.length) { const i = stack.pop(); const xx = i % W, yy = (i / W) | 0; if (xx > 0) push(i - 1); if (xx < W - 1) push(i + 1); if (yy > 0) push(i - W); if (yy < H - 1) push(i + W); }
        // 2) alpha: background → 0; pixels touching background → soft alpha from whiteness
        for (let i = 0; i < W * H; i++) {
          if (bg[i]) { d[i * 4 + 3] = 0; continue; }
          const xx = i % W, yy = (i / W) | 0; let nb = 0;
          if (xx > 0 && bg[i - 1]) nb++; if (xx < W - 1 && bg[i + 1]) nb++; if (yy > 0 && bg[i - W]) nb++; if (yy < H - 1 && bg[i + W]) nb++;
          if (nb) { const w = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); const a = Math.max(0, Math.min(1, (250 - w) / 60)); d[i * 4 + 3] = Math.round(255 * Math.max(a, 0.35)); }
        }
      }
      // 3) trim to content bbox
      let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let i = 0; i < W * H; i++) { if (d[i * 4 + 3] > 8) { const xx = i % W, yy = (i / W) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
      x.putImageData(id, 0, 0);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh) * (1 + 2 * pad); const o = document.createElement('canvas'); o.width = size; o.height = size; const ox = o.getContext('2d');
      ox.imageSmoothingQuality = 'high'; const s = size / side; ox.drawImage(c, x0, y0, bw, bh, (size - bw * s) / 2, (size - bh * s) / 2, bw * s, bh * s);
      return { png: o.toDataURL('image/png').split(',')[1], bbox: [x0, y0, bw, bh], src: [W, H] };
    }, { b64, mime, size: it.size || 256, pad: it.pad ?? 0.04, key: it.key !== false });
    const outFile = path.join(outDir, it.name + '.png'); fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, Buffer.from(out.png, 'base64'));
    console.log(it.name, out.src.join('x'), 'bbox', out.bbox.join(','), '->', fs.statSync(outFile).size, 'bytes');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
