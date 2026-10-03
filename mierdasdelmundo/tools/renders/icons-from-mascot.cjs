// The app icons are just the 3D poop mascot. Usage: node icons-from-mascot.cjs <appDir>
//   icon-192.png, icon-512.png   the poop alone on a transparent background (manifest "any")
//   icon-maskable-512.png        the poop inside the safe zone on white (manifest "maskable")
//   apple-touch-icon.png         the poop on white (iOS does not support transparent home-screen icons)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const dir = process.argv[2]; const b64 = fs.readFileSync(path.join(dir, 'assets/mascot.png')).toString('base64');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const render = async (file, size, scale, background) => {
    await page.setViewportSize({ width: size, height: size }); const inner = Math.round(size * scale);
    await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:${background};display:flex;align-items:center;justify-content:center"><img src="data:image/png;base64,${b64}" style="width:${inner}px;height:${inner}px;object-fit:contain"></div></body></html>`);
    await page.screenshot({ path: path.join(dir, file), omitBackground: background === 'transparent', clip: { x: 0, y: 0, width: size, height: size } }); console.log('wrote', file);
  };
  await render('icon-192.png', 192, 0.96, 'transparent'); await render('icon-512.png', 512, 0.96, 'transparent');
  await render('icon-maskable-512.png', 512, 0.66, '#FFFFFF'); await render('apple-touch-icon.png', 180, 0.86, '#FFFFFF');
  await browser.close();
})();
