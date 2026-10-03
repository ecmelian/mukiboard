# 3D renders

The characters, badges and tab icons of the app are 3D renders generated with Higgsfield (clay/Pixar look, transparent background). `urls.json` lists them by asset name. The scripts here download them, trim them to their content, resize them to the sizes the app uses (mascot 512 px, avatars 320 px, everything else 256 px) and rebuild the PWA icons from the mascot.

```bash
cd mierdasdelmundo/tools/renders
npm i playwright && npx playwright install --with-deps chromium
node fetch.cjs ../..          # writes ../../assets/** and the icon PNGs
```

The GitHub Actions workflow **Fetch 3D renders** (`.github/workflows/fetch-assets.yml`) does the same on a runner and commits the result to the branch it is run on. Give it a different `urls` JSON to swap renders.
