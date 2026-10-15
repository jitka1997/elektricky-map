<p align="center">
  <img src="public/tram-512.png" alt="Električky tram logo" width="120" />
</p>

<h1 align="center">Električky Map</h1>

<p align="center">
  A private map for five friends who live in different cities and never stay put.
</p>

---

We're five friends who call ourselves **Električky** (the trams). We live in different cities and move around a lot, so "where are you right now?" was the most common question in our group chat. This app answers it: each of us logs the city we're in, and everyone sees everyone on one map.

It's invite-only. Only the five of us can sign in.

## What it does

- **Map**: everyone's latest city as a pin with their photo. Friends in the same city are spread around it so no one hides behind someone else.
- **Log where you are**: search for a city, pick how you got there (🚆 🚌 ✈️ 🚢 🚗 🚶 or the tram), and post it. It's logged for now by default, or for any date and time, so you can add a past trip or plan an upcoming one.
- **Journeys**: play back anyone's travels as an animated trip across the map, with the travel mode for each leg.
- **History**: every entry for each of us. You can edit, add or delete your own.
- **Stats**: where you spent your time, how you travel, your records, and who you spend the most time with, down to when and where you were in the same city.
- **Profile**: choose the name and photo the others see, and download a backup of everyone's data.
- **Works like an app**: add it to your phone's home screen. Light and dark themes follow your phone, or switch them yourself.

## How we use it

1. Open the site and sign in with Google.
2. On your phone, add it to the home screen (Share → _Add to Home Screen_ on iPhone; menu → _Install app_ on Android).
3. When you arrive somewhere new, open the app, search for the city, pick how you travelled and tap **Update Location**.

## Built with

- [Next.js](https://nextjs.org) (App Router) and React, hosted on [Vercel](https://vercel.com)
- [Firebase](https://firebase.google.com): Google sign-in and Firestore
- [Leaflet](https://leafletjs.com) and [react-leaflet](https://react-leaflet.js.org) with [OpenStreetMap](https://www.openstreetmap.org) tiles
- [Photon](https://photon.komoot.io) for city search
- [Tailwind CSS](https://tailwindcss.com) and [daisyUI](https://daisyui.com) (caramellatte and luxury themes)

## Running it locally

You need Node.js 24 and a Firebase project. Use a separate dev project, not the real one.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with your Firebase web app config (Firebase console → Project settings → Your apps):

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

3. Start the dev server and open [localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

Other scripts: `npm run build`, `npm run lint` and `npm run typecheck`. A pre-commit hook formats and lints staged files.

### Who can sign in

Access is controlled by Firestore security rules, which live in the Firebase console. They only allow users whose email is listed in the `config/allowlist` document. To invite someone, add their Google email there.

## Data and backups

Each person is a document in `users`, and each logged city is a document in that person's `locations` subcollection.

The data represents hours of our lives, so it's backed up two ways:

- **Nightly**: a [GitHub Action](.github/workflows/backup.yml) exports everything every night. It encrypts the export with a passphrase and keeps it as a downloadable artifact for 90 days. The repo is public, so the backups are never committed.
- **On demand**: the _Download backup_ button on the Profile page.

To restore a backup, use [`scripts/restore-firestore.mjs`](scripts/restore-firestore.mjs). It needs the Firebase Admin SDK, so run it from a separate folder, not from inside the app. The instructions are at the top of the file. Every restore first saves what it's about to overwrite, so you can undo it exactly.

---

<p align="center">Made with love for the Električky 🚊</p>
