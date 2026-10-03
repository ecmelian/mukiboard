# 💩 mierdasdelmundo

*Gotta scoop 'em all.* A phone-only, Pokémon-GO-style web app for capturing, timestamping and mapping the dog poops of the world's big cities. In any language.

Spot a poop → tap the shutter → tag its size and freshness → flick the poop bag at it. If it doesn't break free, it's yours: timestamped, geotagged, assigned to its big city, identified as one of 32 species across 5 rarities, and added to your **Mierdex** and to the map.

## Features

- 📱 **Phones only.** On a desktop browser the app shows a QR code to open it on a phone instead (append `?dev=1` to the URL to bypass the gate while developing).
- 🌍 **Any language.** The interface, the 32 species with their entries, the 18 badges and the dates follow the phone's language: English, Spanish, Portuguese, French, German and Italian are built in, anything else falls back to English, and the language can be switched in Trainer → Settings. Adding a language is one dictionary in `index.html`.
- 🏙️ **Built for big cities.** A built-in table of about 190 big cities assigns every capture within 60 km to its city. Captures show their city, the trainer profile counts cities and names a home city, two badges reward capturing in 3 and 10 cities, city-dwelling species (Metro Mouth, Tourist Trap, Bus Stop Bomber, Crosswalk Crumb…) are more common inside a city, and the world sync ranks cities by number of poops.
- 📸 **Live camera viewfinder** with shutter, camera flip and gallery import. Falls back to the phone's camera app when the live camera isn't available.
- 🕒 **Timestamp + 📍 GPS** on every capture (local time with UTC offset, coordinates with accuracy). Imported photos get their real date and location from EXIF when present.
- 🎯 **Encounter mechanic**: size (S/M/L/XL) and freshness (fresh/dry/fossil) tags influence what you find; flick the bag (or tap *Throw*); rarer poops break free more often.
- 📖 **Mierdex**: 32 species in 5 rarities with dex entries, shiny variants (1 in 50), CP, XP, 50 levels, 18 badges and day streaks.
- 🗺️ **Map** of your captures (Leaflet + OpenStreetMap). Set or fix a capture's location by tapping the map; edit its time; add notes.
- 🌐 **World sync** (optional): publish captures to a shared Firebase Realtime Database to see everyone's sightings on the map, a trainer leaderboard and the city ranking.
- 🖼️ **Share cards**: the photo stamped with species, rarity, CP, city, time and coordinates, sent through the system share sheet.
- 💾 **Local-first**: photos and captures live in IndexedDB on the device. JSON export/import for backups. Installable PWA that works offline after the first load (map tiles need a connection).

## Design

Helvetica only. Black and white, with green reserved for the key things: the shutter, the poop bag, the primary buttons, the active tab, the GPS fix, XP and level-ups, new catches and badges. Rarity is a gray ramp from light (common) to black (legendary). Characters, badges and tab icons are 3D renders in `assets/` with emoji fallbacks until the renders are in place.

## Run it

The live camera and GPS need a secure context: **HTTPS or `localhost`**.

```bash
# from the repository root
python3 -m http.server 8080
# then open http://localhost:8080/mierdasdelmundo/?dev=1 on the desktop,
# or http://<your-lan-ip>:8080/mierdasdelmundo/ on a phone (camera app fallback only, no HTTPS)
```

For the real thing serve it over HTTPS, for example GitHub Pages: `https://<user>.github.io/mukiboard/mierdasdelmundo/`. Open it on the phone and add it to the home screen (browser menu or the *Install* button in Trainer → Settings).

## World sync

Off by default; nothing leaves the device until you turn it on in **Trainer → Poops of the world**. Like MukiBoard, it talks to a Firebase Realtime Database over plain REST, so there is no SDK and no build step. Point it at any RTDB URL (the MukiBoard database is prefilled).

Data layout under `/mierdasdelmundo`:

| Path | Content |
|---|---|
| `sightings/{captureId}` | time, coordinates rounded to 4 decimals (≈11 m), city and country, species, rarity, shiny, CP, size, freshness, trainer name and id |
| `thumbs/{captureId}` | a 96 px JPEG thumbnail as a data URL (no full photos are ever uploaded) |
| `trainers/{trainerId}` | name, avatar, XP, level, capture count, cities, home city for the leaderboard |

Example rules for a public playground database (add the index so the world map can request only the latest sightings):

```json
{
  "rules": {
    "mierdasdelmundo": {
      ".read": true,
      ".write": true,
      "sightings": { ".indexOn": ["ts"] }
    }
  }
}
```

Captures without a location are never published. Deleting a published capture also removes it from the database.

## The movement

The app is the engine of something bigger: channels, shows, sponsors, books, merch and a privately funded cleaning service for the cities. The plan is in [BUSINESS_PLAN.md](BUSINESS_PLAN.md).

## Files

| File | Purpose |
|---|---|
| `index.html` | the whole app (markup, styles, translations, city table and script) |
| `sw.js` | service worker: offline app shell; Leaflet (from unpkg) and the QR library (from cdnjs) are cached after the first load |
| `manifest.webmanifest`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` | PWA install metadata and icons |

## Game data

| Rarity | Weight | XP | CP range | Catch rate per throw |
|---|---|---|---|---|
| Common | 50 | 25 | 10–100 | 100 % |
| Uncommon | 28 | 50 | 80–250 | 90 % |
| Rare | 14 | 100 | 200–500 | 75 % |
| Epic | 6 | 200 | 450–900 | 60 % |
| Legendary | 2 | 500 | 850–1500 | 50 % |

Every failed throw adds 15 % to the catch rate. First capture of a species gives +50 XP, a shiny +100 XP. Level = ⌊√(XP / 100)⌋ + 1, capped at 50. XL and fossil tags tilt the odds toward big and ancient species, being inside a big city tilts them toward the urban species, and some species only show up at certain hours (the *Midnight Menace* never appears in daylight).
