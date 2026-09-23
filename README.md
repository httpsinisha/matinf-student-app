# MATINF

Unofficial academic demonstration: a WordPress website/content API and an Expo SDK 57 Android app. Interface language: Serbian Latin. The project follows [PLAN.md](PLAN.md); current decisions and remaining gates are in [docs/setup-status.md](docs/setup-status.md).

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

This opens the root Expo app on the connected Android emulator/device. Onboarding works locally; the remaining reader screens and live notification subscription integration are pending. `matinf/` is an archived starter, not the active app.

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
```

The browser check requires Google Chrome. The WordPress tests use a separate persistent test database, not the site's working content.

## Project map

- `src/`: Android app, onboarding, and local preference model.
- `wordpress/plugins/matinf-core/`: academic content types, metadata validation, public API, and demo content.
- `wordpress/themes/matinf/`: responsive WordPress theme.
- `wordpress/scripts/`: local runtime, checks, packaging, and backup tools.
- `design/`: supplied visual references.
- `artifacts/`: screenshots and local verification outputs.
- [API contract](docs/api-contract.md), [hosting steps](docs/hosting-setup.md), [current status](docs/setup-status.md).

All sample staff, announcements, courses, and documents are explicitly demonstration content. No hosting, push-delivery, final-signing, or Redmi compatibility result is claimed until those checks actually pass.
