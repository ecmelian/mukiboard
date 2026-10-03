// Compose the app icons: green rounded square + the 3D mascot. Usage: node icons-from-mascot.cjs <appDir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const dir = process.argv[2]; const b64 = fs.readFileSync(path.join(dir, 'assets/mascot.png')).toString('base64');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const render = async (file, size, maskable) => {
    await page.setViewportSize({ width: size, height: size }); const inner = Math.round(size * (maskable ? 0.62 : 0.78)); const r = maskable ? 0 : Math.round(size * 0.22);
    await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:#16A34A;border-radius:${r}px;display:flex;align-items:center;justify-content:center"><img src="data:image/png;base64,${b64}" style="width:${inner}px;height:${inner}px;object-fit:contain"></div></body></html>`);
    await page.screenshot({ path: path.join(dir, file), omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } }); console.log('wrote', file);
  };
  await render('icon-192.png', 192, false); await render('icon-512.png', 512, false); await render('icon-maskable-512.png', 512, true); await render('apple-touch-icon.png', 180, false);
  await browser.close();
})();
