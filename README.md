# Training Tracker

A phone-first PWA for logging lifting workouts. It is a static site with no framework and no build step. Everything you enter is stored in your own browser (IndexedDB) and never sent anywhere.

The app ships with no workout program. Import your own from Settings › Import Program (a JSON file with `sessions`, optional `warmup`, `notes` and `dayMapping`).

**Status:** Phase 3 of 4 (workout logger with progression suggestions, daily logs, weekly review, program editor, JSON backup and restore). The Progress tab is a placeholder until Phase 4.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. Service workers only run on HTTPS or localhost.

## Install on a phone

Deploy with GitHub Pages (Settings › Pages › Deploy from a branch › `main` / root), open the HTTPS address on the phone, then:

- **iPhone (Safari):** Share › Add to Home Screen.
- **Android (Chrome):** menu › Install app.

The Home Screen app and the browser keep separate data.

## Releasing a change

Every change bumps the version in two places: `CACHE` in `sw.js` and `VERSION` in `app.js`. If you skip this, phones keep serving the old cached files.

## Data and backup

Data is stored unencrypted in the browser. Clearing site data erases it. Use Settings › Back Up Now to save one plain JSON file, and Restore From Backup to bring it back.

## Development

`logic.js` holds the pure rules (progression, moving average, sleep hours, targets) with no browser dependencies. Unit tests live in `dev/tests.html`, and a sample-data generator in `dev/sample-data.js` loads when the app is opened with `?dev=1`. The `dev` folder is for local use and is not needed to deploy.
