# 💩 Poop GO

*Gotta scoop 'em all.* A Pokémon-GO-style web app for capturing, timestamping and mapping the dog poops of the world.

Spot a poop → tap the shutter → tag its size and freshness → flick the poop bag at it. If it doesn't break free, it's yours: timestamped, geotagged, identified as one of 28 species across 5 rarities, and added to your **Poopédex** and to the map.

## Features

- 📸 **Live camera viewfinder** with shutter, camera flip and gallery import. Falls back to the phone's camera app when the live camera isn't available.
- 🕒 **Timestamp + 📍 GPS** on every capture (local time with UTC offset, coordinates with accuracy). Imported photos get their real date and location from EXIF when present.
- 🎯 **Encounter mechanic**: size (S/M/L/XL) and freshness (Fresh/Dry/Fossil) tags influence what you find; flick the bag (or tap *Throw*); rarer poops break free more often.
- 📖 **Poopédex**: 28 species in 5 rarities with dex entries, shiny variants (1 in 50), CP ("crap power"), XP, 50 levels, 16 badges and day streaks.
- 🗺️ **Map** of your captures (Leaflet + OpenStreetMap). Set or fix a capture's location by tapping the map; edit its time; add notes.
- 🌍 **Poops of the world** (optional): publish captures to a shared Firebase Realtime Database to see everyone's sightings on the map and a trainer leaderboard.
- 🖼️ **Share cards**: the photo stamped with species, rarity, CP, time and coordinates, sent through the system share sheet (or downloaded).
- 💾 **Local-first**: photos and captures live in IndexedDB on the device. JSON export/import for backups. Installable PWA that works offline after the first load (map tiles need a connection).

## Design

Helvetica only. Black and white, with green reserved for the key things: the shutter, the poop bag, the primary buttons, the active tab, the GPS fix, XP and level-ups, new catches and badges. Rarity is a gray ramp from light (common) to black (legendary).

## Run it

The live camera and GPS need a secure context: **HTTPS or `localhost`**.

```bash
# from the repository root
python3 -m http.server 8080
# then open http://localhost:8080/poopgo/
```

To try it on a phone, serve it over HTTPS (for example GitHub Pages: `https://<user>.github.io/mukiboard/poopgo/`) or use a tunnel such as `ngrok`. Over plain HTTP on a LAN address the live viewfinder is unavailable, but *Take a photo* still works through the camera app.

Install it from the browser menu (*Add to Home Screen*) or the *Install* button in the Trainer tab.

## Poops of the world (World sync)

Off by default; nothing leaves the device until you turn it on in **Trainer → Poops of the world**. Like MukiBoard, it talks to a Firebase Realtime Database over plain REST, so there is no SDK and no build step. Point it at any RTDB URL (the MukiBoard database is prefilled).

Data layout under `/poopgo`:

| Path | Content |
|---|---|
| `sightings/{captureId}` | time, coordinates rounded to 4 decimals (≈11 m), species, rarity, shiny, CP, size, freshness, trainer name and id |
| `thumbs/{captureId}` | a 96 px JPEG thumbnail as a data URL (no full photos are ever uploaded) |
| `trainers/{trainerId}` | name, avatar, XP, level, capture count for the leaderboard |

Example rules for a public playground database (add the index so the world map can request only the latest sightings):

```json
{
  "rules": {
    "poopgo": {
      ".read": true,
      ".write": true,
      "sightings": { ".indexOn": ["ts"] }
    }
  }
}
```

Captures without a location are never published. Deleting a published capture also removes it from the database.

## Files

| File | Purpose |
|---|---|
| `index.html` | the whole app (markup, styles and script) |
| `sw.js` | service worker: offline app shell; Leaflet (from unpkg) and the web font are cached after the first load |
| `manifest.webmanifest`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` | PWA install metadata and icons |

## Game data

| Rarity | Weight | XP | CP range | Catch rate per throw |
|---|---|---|---|---|
| Common | 50 | 25 | 10–100 | 100 % |
| Uncommon | 28 | 50 | 80–250 | 90 % |
| Rare | 14 | 100 | 200–500 | 75 % |
| Epic | 6 | 200 | 450–900 | 60 % |
| Legendary | 2 | 500 | 850–1500 | 50 % |

Every failed throw adds 15 % to the catch rate. First capture of a species gives +50 XP, a shiny +100 XP. Level = ⌊√(XP / 100)⌋ + 1, capped at 50. XL and fossil tags tilt the odds toward big and ancient species; some species only show up at certain hours (the *Midnight Menace* never appears in daylight).
