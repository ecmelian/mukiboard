# x-poster · the official X account

A tiny service that lets the mierdasdelmundo app share captures on the official X account **without ever putting the account keys on a phone**, and without anything going out unreviewed.

How a capture travels:

1. On the phone, faces are found and pixelated **before** the photo is saved. The app also lets you blur any spot by hand.
2. The app sends the blurred photo, the rounded coordinates (3 decimals, about 100 m), the city, the species and the time to `POST /api/submit`. The service refuses anything that was not face-checked and blurred, anything without a location, and more than a few submissions per hour from one address.
3. The capture waits in a queue. Nothing is posted automatically.
4. You open the review page, see the photo and the text, fix the text if you like, and press **Approve and post** or **Reject**. Only then does the service upload the photo and publish the post with the account's own credentials.
5. The app asks `GET /api/status` and shows "Sent for review", "See the post" or "Not posted".

Rejected captures lose their photo and details at once; only a tombstone remains so the same capture cannot be resubmitted. Posted captures keep their metadata and the link; the photo is deleted from the queue.

## Deploy (Vercel)

The official copy runs at `https://mierdasdelmundo-x-poster.vercel.app` (Vercel project `mierdasdelmundo-x-poster`, deployed from these files without a Git link). To deploy your own:

No dependencies, no build. Node 18 or newer.

1. Import this repository in Vercel and set the project's **Root Directory** to `x-poster` (or run `vercel` inside this folder).
2. Create an app at https://developer.x.com with **Read and Write** permission, then generate the four keys of the account that will post.
3. Add the environment variables below and deploy.
4. Open `https://<your-deployment>/api/review?key=<ADMIN_KEY>` on your phone and keep it as a bookmark: that is the review page.
5. Put the deployment URL into the app: either in `X_POSTER_URL` in `mierdasdelmundo/index.html` (for everybody) or in Trainer → Official X account → Poster service URL (one phone).

| Variable | Required | What it is |
|---|---|---|
| `X_API_KEY`, `X_API_SECRET` | yes | the X app's consumer key and secret |
| `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | yes | the access token and secret of the account that posts (Read and Write) |
| `ADMIN_KEY` | yes | a long random string; protects the review page |
| `X_HANDLE` | no | the account's handle, used to build the link to each post |
| `FIREBASE_URL` | no | Realtime Database URL, default `https://mukiboard-default-rtdb.firebaseio.com` |
| `FIREBASE_ROOT` | no | root node, default `mierdasdelmundo` (the same one the app's world sync uses) |
| `FIREBASE_SECRET` | no | database secret, if the rules are not public |
| `POST_TEMPLATE` | no | text template, see below |
| `MAX_PER_HOUR` | no | submissions per address per hour, default 5 |

Database layout under `FIREBASE_ROOT`:

| Path | Content |
|---|---|
| `xqueue/{id}` | capture details and status (`pending`, `posted`, `rejected`), never the photo |
| `ximg/{id}` | the blurred photo as a data URL while it waits for review |
| `xrate/{ip}/{hour}` | submission counters per hashed address |

Add `"xqueue": { ".indexOn": ["status"] }` to the database rules so the review page can ask for pending items only; without it the service reads the whole queue, which is fine while it is small.

## The text of a post

Default template:

```
{icon} {species}{shiny} spotted in {city} · {date} {time} UTC
{map}
#mierdasdelmundo #{citytag}
```

Placeholders: `{icon}` (💩 🚗 🔒 🚧 🗑️ for the kind of shit) `{kind}` `{species}` `{rarity}` `{shiny}` `{cp}` `{city}` `{cc}` `{citytag}` `{date}` `{time}` `{map}` `{trainer}`. The map link points at OpenStreetMap with the rounded coordinates. Long texts lose their hashtags first, then get cut, so they always fit.

## Endpoints

| Method and path | Who | What |
|---|---|---|
| `POST /api/submit` | the app | queue a capture; returns `202 {id, status: "pending"}`, or `200` with the current status if it was sent before |
| `GET /api/status?id=` | the app | `{id, status, url}` |
| `GET /api/review?key=` | you | the review page; `&list=1` returns the pending items as JSON, `&img=ID` one photo |
| `POST /api/review` | the review page | `{key, id, action: "approve" or "reject", text?}` |

## Test

```bash
node test/run.js
```

Runs the three functions against an in-memory database and a fake X behind a real HTTP server, and checks the OAuth 1.0a signature against the worked example in the X documentation.
