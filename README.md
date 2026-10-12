# MATINF

Unofficial academic demonstration: a WordPress website/content API and an Expo SDK 57 Android app. Interface language: Serbian Latin.

## Run the local WordPress site

```powershell
npm --prefix wordpress ci
npm run wordpress
```

Open http://127.0.0.1:9400 or http://127.0.0.1:9400/wp-admin/.

The local admin login is stored privately in `wordpress/.runtime/local-admin.json`. Do not share or commit it. Content and the SQLite database persist across restarts. See the [WordPress guide](wordpress/README.md) for editing, API access, backups, packaging, and hosting.

## Run the Android app

```powershell
npm ci
npm run android
```

This opens the root Expo app on the connected Android emulator/device. The app includes onboarding, five main tabs, WordPress content/details, year/subject feed matching, and persistent saved content. Remote push delivery remains pending. `matinf/` is an archived starter, not the active app.

The checked-in `.env` points to `https://sinisa.alwaysdata.net`; the hosted app needs internet access but no local WordPress server or port forwarding. For local backend work, set `EXPO_PUBLIC_WORDPRESS_URL=http://127.0.0.1:9400` in `.env.local`, start WordPress, and run `adb reverse tcp:9400 tcp:9400`. Restart Metro after changing the environment; standalone APKs must be rebuilt. Run `npx expo prebuild --platform android --no-install` when switching between local HTTP and public HTTPS so the Android network configuration is regenerated. Public builds disable cleartext HTTP. See `.env.example`.

For the standalone emulator feasibility build:

```powershell
./scripts/build-android-preview.ps1
```

It uses Android Studio's bundled JDK and installed SDK. It targets x86_64 and uses a generated debug signing key: it is not the final Redmi APK. The first build downloads Gradle/native SDK dependencies and can take substantially longer than later builds. Build output is in `artifacts/build/`.

## Verify

```powershell
npx tsc --noEmit
node --test scripts/onboarding-model.test.mjs
npm run test:wordpress
node wordpress/scripts/check-site.mjs
node wordpress/scripts/check-publishing.mjs
node wordpress/scripts/check-hosted.mjs
node scripts/check-android-reader.mjs --hosted
node scripts/check-android-reader.mjs --native --hosted
node scripts/check-android-reader.mjs --native --hosted --targeting
```

The browser check requires Google Chrome. The WordPress tests use a separate persistent test database, not the site's working content. The Android checks expect the seeded demo catalog; omit `--hosted` only for a build using local WordPress (that mode also checks offline behavior by removing local port forwarding).

## Project map

- `src/`: Android app, onboarding, and local preference model.
- `wordpress/plugins/matinf-core/`: academic content types, metadata validation, public API, and demo content.
- `wordpress/themes/matinf/`: responsive WordPress theme.
- `wordpress/scripts/`: local runtime, checks, packaging, and backup tools.
- `design/`: supplied visual references.
- `artifacts/`: screenshots and local verification outputs.
- [API contract](docs/api-contract.md), [hosting steps](docs/hosting-setup.md).

All sample staff, announcements, courses, and documents are explicitly demonstration content. No hosting, push-delivery, final-signing, or Redmi compatibility result is claimed until those checks actually pass.
