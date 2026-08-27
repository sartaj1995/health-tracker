# Health Tracker

A personal health-metrics tracker: log a reading, see how it moves, and know
whether it sits in a healthy range. Built to be opened on a phone in five
seconds and read properly on a laptop.

## What it does

- **24 metrics** out of the box — weight, height, body fat, waist, blood
  pressure, resting heart rate, SpO2, fasting glucose, HbA1c, the full lipid
  panel, vitamin D, B12, ferritin, hemoglobin, TSH, creatinine, uric acid, ALT,
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
- **Your data stays in your browser.** Nothing is uploaded. Export JSON or CSV
  any time; import the JSON back on another device.

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

The app is a static Next.js build with no server, no database, and no
environment variables, so deployment is:

```bash
npx vercel
```

Or push to GitHub and import the repo at vercel.com — the defaults are correct.
Once it is live, open it on your phone and use **Add to Home Screen**; it then
launches full-screen with its own icon and works without a connection.

## How it is put together

```
app/                 routes: dashboard, /add, /m/[id], /history, /settings
components/          UI — chart, cards, sparkline, entry form, nav
lib/metrics.ts       the metric catalogue and its reference bands
lib/stats.ts         series building, BMI derivation, summaries
lib/storage.ts       persistence behind a small interface
lib/store.tsx        React context holding entries + profile
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
