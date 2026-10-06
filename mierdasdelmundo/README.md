# 💩 mierdasdelmundo

A phone-only web app that does one thing: you **record a shitty thing** on the street, it goes **on the map for everyone**, and you get to **see if somebody does something about it**.

Dog poop, cars where they shouldn't be, locks where they shouldn't be, cones holding public parking, dumped trash. The remains of shitty behavior, in any language.

## How it works

One toggle at the bottom of every screen: **you** on the left, the **camera** in the middle, the **map** on the right. The camera can also be swiped: left for the map, right for you.

- 📸 **Camera.** Point at the shit and press it on the screen. The frame is taken right there, then your arm (a green cleaning glove) flings a poop bag at the spot, with a whoosh; the bag lands on the shit and the question comes: **Bag it** or **Leave it**. Bag it: a scoop sound, the bag drops down the screen into the map, and the record is posted. Meanwhile the phone works out what kind of shit it is (an on-device image classifier looking at the crop around the spot you pressed; anything it cannot name is poop), blurs any faces (also on the device, nothing is uploaded for the check) and takes the time and the GPS position. Only when something needs you (no GPS fix, posting off, could not post) a small card says so and offers *Set the spot* on the map. The shutter button throws at the middle of the frame. Nothing else on the screen: the poop icon at the top left and a small dot at the top right that glows green when the GPS has a fix and red when it has not (tap it to retry).
- 🗺️ **Map.** Nothing on it but bagged shits: every record is a poop bag, yours with a green ring, everyone else's smaller with a grey one, plus your position, at street level around you. Tap a bag for its **card**: the photo full screen, when and where, and the face of whoever bagged it at the top right (tap it: how many shits they have bagged). Under the photo, the **"It's gone"** button, which only works on the spot: a fresh fix within 60 m, accuracy better than 150 m. After 10 people confirm, the bag shows as cleared. On your own cards: *Blur* (tap the photo where you want a mosaic) and *Delete*.
- 👤 **You.** Your face and your name first, picked at first start and changeable here: tap the face for the sixteen faces or a photo of you, tap the name to type a new one (a name a friend already has is refused). The face is on the toggle and both are on the cards of the shits you bag. Then your records, newest first, each with its fate: *On the map*, *n/10 say it's gone*, *Cleared*, *No location*. Tap one for the details, to set its spot or to delete it. Below: posting on/off, language, install, delete everything.
- 🎬 **Intro.** The name appears and the poop forms, then the poop flies into the corner and only the icon stays. Tap to skip.
- 📱 **Phones only.** On a desktop browser the app shows a QR code to open it on a phone instead (append `?dev=1` to the URL to bypass the gate while developing).
- 🌍 **Six languages**, following the phone: English, Spanish, Portuguese, French, German, Italian. Anything else falls back to English. Adding a language is one dictionary in `index.html`.
- 🏙️ **Big cities.** A built-in table of about 190 big cities assigns every record within 60 km to its city.
- 💾 **Local-first.** Photos and records live in IndexedDB on the phone. Installable PWA that works offline after the first load (the map tiles and the shared map need a connection). Records made offline are posted when the connection is back.

No accounts, no points, no levels, no badges. At first start you pick one of sixteen faces and type a name; both can be changed later, and a photo of you can be your face. The name is claimed on the shared map so two friends cannot share it. A record carries that face and name plus this phone's random id, so that each person counts once when confirming a shit is gone.

## Run it

The live camera and GPS need a secure context: **HTTPS or `localhost`**.

```bash
# from the repository root
python3 -m http.server 8080
# then open http://localhost:8080/mierdasdelmundo/?dev=1 on the desktop,
# or http://<your-lan-ip>:8080/mierdasdelmundo/ on a phone (camera app fallback only, no HTTPS)
```

For the real thing serve it over HTTPS, for example GitHub Pages: `https://<user>.github.io/mukiboard/mierdasdelmundo/`. Open it on the phone and add it to the home screen (browser menu, or the *Install* button under *You → Settings* where the browser offers it).

## The shared map

Posting is on by default (switch it off under *You → Settings*). Like MukiBoard, the app talks to a Firebase Realtime Database over plain REST, so there is no SDK and no build step. The database URL is `settings.cloudUrl` in `index.html` (the MukiBoard database is prefilled).

What leaves the phone for each record: the time, the coordinates rounded to 4 decimals (about 11 m), the city and country, the kind, this phone's id, your name and face, and a small copy of the photo (320 px, faces blurred first; while the face check has not run yet only a 96 px copy goes up, replaced later).

Data layout under `/mierdasdelmundo`:

| Path | Content |
|---|---|
| `sightings/{recordId}` | time, rounded coordinates, city and country, kind, phone id, name and face, time of posting |
| `names/{name}` | the phone id that claimed that name |
| `users/{phoneId}` | name, face, a 96 px photo when one was chosen, so cards can show who bagged what |
| `thumbs/{recordId}` | the small copy of the photo as a JPEG data URL |
| `clears/{recordId}/{phoneId}` | timestamp of an "it's gone" confirmation made on the spot; 10 of them mark the record as cleared |

Example rules for a public playground database (add the index so the map can request only the latest records):

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

Records without a location are never posted. Deleting a posted record also removes it from the database.

## Files

| File | What it is |
|---|---|
| `index.html` | the whole app: markup, styles, six languages, logic |
| `sw.js` | service worker: offline shell plus the cached map library and models |
| `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | installable app, poop icon |
| `assets/` | 3D renders: the poop, the bag, the throwing arm, the camera and map icons, the kind icons, the sixteen characters |
| `tools/renders/` | how the renders are fetched, trimmed and turned into icons |

Helvetica only. Black and white, with green reserved for the key things: the shutter, the lit side of the toggle, the GPS fix, a record that is on the map, a cleared one.

The earlier Pokémon-GO-style game (species, rarity, XP, badges, the Mierdex) and the X posting service are in the git history, before the stripped-down version.
