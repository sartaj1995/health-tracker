# Health Tracker

A personal health-metrics tracker: log a reading, see how it moves, and know
whether it sits in a healthy range. Built to be opened on a phone in five
seconds and read properly on a laptop.

## What it does

- **26 metrics** out of the box — weight, height, body fat, waist, blood
  pressure, resting heart rate, SpO2, fasting glucose, HbA1c, the full lipid panel
  including VLDL, vitamin D, B12, ferritin, hemoglobin, TSH, creatinine, uric acid, ALT,
  sleep, steps, water.
- **BMI is calculated, not typed.** Every weight reading is paired with
  whichever height was on record at the time.
- **Reference ranges** for each metric, so `34.1 ng/mL` reads as *Sufficient*
  rather than as a number you have to look up. Shaded behind every chart.
- **Charts** per metric with 3M / 6M / 1Y / All windows, an optional target
  line, and blood pressure drawn as two lines.
- **Dashboard** that surfaces what is out of range and what is overdue for a
  re-check, with the metrics you pin at the top.
- **Works offline, installs to your home screen** — it is a PWA.
- **Your data stays in your browser** unless you switch on Drive backup, in
  which case it goes to a single file in *your own* Drive and nowhere else.
  Export JSON or CSV any time; import the JSON back on another device.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build && npm start   # production build
```

## Deploying to Vercel

The app is a static Next.js build with no server and no database. The only
environment variable is the optional Google Drive client ID below, so a first
deployment is just:

```bash
npx vercel
```

Or push to GitHub and import the repo at vercel.com — the defaults are correct.
Once it is live, open it on your phone and use **Add to Home Screen**; it then
launches full-screen with its own icon and works without a connection.

## Backing up to Google Drive

Optional, and off until you set it up. Without it, readings live in one
browser only — your laptop and your phone are separate stores that never
meet, and **Settings → Export** is the manual way across.

With it, the app keeps a single file in your own Drive and re-uploads it after
every reading you save, so both devices stay in step.

It uses the `drive.file` scope, which grants access only to files this app
itself created. Your other Drive files stay invisible to it, and because Google
classes that scope as non-sensitive there is no app-verification review and no
"unverified app" warning.

### Give it its own Google Cloud project

**Do not reuse a project from another app.** The OAuth consent screen is
per-project, so a shared one would name the wrong app on the dialog you see
when connecting — and the two apps would not be cleanly isolated. A new project
is free and takes about five minutes.

1. At [console.cloud.google.com](https://console.cloud.google.com), create a
   new project — call it something like `health-tracker`.
2. **APIs & Services → Library**, search for **Google Drive API**, enable it.
3. **APIs & Services → OAuth consent screen**. Pick **External**, set the app
   name to `Health Tracker` (this is the name you will see when connecting),
   and add your own Google account under **Test users**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   Choose **Web application**.
5. Under **Authorised JavaScript origins**, add both:
   - `http://localhost:3000`
   - your deployed origin, e.g. `https://health-tracker-ssd.vercel.app`
6. Copy the client ID it gives you.

### Wire it in

Locally, put it in `.env.local` (gitignored):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

On Vercel, add the same name and value under **Settings → Environment
Variables**, then redeploy. The variable is `NEXT_PUBLIC_`, so it ships to the
browser — which is correct here: this OAuth flow has no client secret, and the
client ID is public by design.

Then open **Settings → Google Drive backup** and press **Connect**.

### What it does and does not do

It is a backup, not a live merge. If you log readings on two devices without
syncing in between, the app notices that Drive holds a version this device has
never seen and **stops rather than overwriting**, asking which copy to keep.
That same guard protects a freshly installed device, which has no readings and
would otherwise wipe a good backup the moment it connected.

## How it is put together

```
app/                 routes: dashboard, /add, /m/[id], /history, /settings
components/          UI — chart, cards, sparkline, entry form, nav
lib/metrics.ts       the metric catalogue and its reference bands
lib/stats.ts         series building, BMI derivation, summaries
lib/storage.ts       persistence behind a small interface
lib/store.tsx        React context holding entries + profile
lib/drive.ts         Google Drive auth and file calls
lib/sync.ts          backup/restore with conflict detection
scripts/gen-icons.mjs  regenerates the PNG app icons
```

Persistence sits behind the `HealthRepo` interface in `lib/storage.ts`. The
only implementation today writes to `localStorage`. Moving to a hosted database
later means adding a second implementation that calls an API route — no page or
component has to change.

## A note on the reference ranges

The bands are the common adult clinical cutoffs, in the units Indian labs use
(mg/dL, ng/mL, pg/mL). Several genuinely vary with age, sex and pregnancy —
those carry a note in the app. They are there to give a reading context, not to
diagnose anything. Your lab report and your doctor are the authority.
