# Setup decisions and implementation status

Updated: 24 September 2026.

## Public hosting trial

Hosted check after corrected ZIP installation (24 September): MATINF theme and plugin are active, `/wp-json/matinf/v1/health` returns 200, and the catalog contains 6 programs, 34 courses, 6 staff, 1 document, and 8 feed posts. Course relationships and year-targeted/general-only feed filtering passed direct HTTP checks. Both HTTP and HTTPS PDF downloads return 200. A configuration issue remains: the core REST index reports `home=https://sinisa.alwaysdata.net` but `url=http://sinisa.alwaysdata.net`; the stored demo PDF URL also uses HTTP. Change WordPress Address to HTTPS and update the document file URL before connecting the public Android build. Hosted outbound push connectivity and Android access are still pending.

The user selected alwaysdata Free on 24 September and provided `https://sinisa.alwaysdata.net/`. Direct Node HTTP checks confirmed the WordPress homepage and `/?rest_route=/` return 200 over HTTPS without a browser challenge. The standard API namespaces are present; `matinf/v1` is absent. `/wp-json/` returns a server 404, while `/index.php/wp-json/matinf/v1/health` reaches WordPress but returns `rest_no_route`. Plugin/theme installation and permalink configuration are the next steps. Deployment instructions are in `docs/hosting-setup.md`; the plugin/theme upload archives are prepared. Android connectivity and outbound HTTPS remain unverified. Local data and accounts remain intact; the app still uses the local backend until hosted acceptance passes.

## Expanded app and Professor workflow

The user expanded the scope to a full WordPress-backed reader and Professor/Administrator publishing. The app now has Početna, Notifikacije, Predmeti, Osoblje, and Više tabs, plus program/year navigation, rich article details, linked staff/courses/documents, public email, sharing, contact/about, and editable preferences based on WordPress IDs. Personal feeds use the REST audience filter. Lists and visited details are stored locally; confirmed 404 responses remove cached details. Hosting and remote push are still pending.

Professor accounts use WordPress authentication, publish their own posts, and cannot manage other authors, academic records, accounts, or site settings. This implements direct publishing as the working default; an approval workflow was asked about but not confirmed. Administrators create accounts in Users → Add New and assign Profesor. Post targeting uses the MATINF metadata form; choose year/subject and uncheck the general-audience checkbox for targeted content.

The demo catalog has been extended additively to 34 courses across study years, six fictional staff, five announcements, and three news posts. Existing edits remain intact. Eleven WordPress integration tests, TypeScript validation, and three onboarding model checks passed for the expanded code. The browser publishing check also passed: an Administrator creates a Professor, the Professor signs in and publishes through the WordPress form, and matching year feeds include the post while general-only feeds exclude it. The temporary user and post are removed afterward.

The expanded native APK built successfully (16m 39s) and was installed on `emulator-5554`. Five-tab navigation, staff/course/article/program details, and offline staff/course caching across native restarts passed. Screenshots in `artifacts/reader/` were visually reviewed against the supplied design direction. The current emulator APK is 46,660,384 bytes. Removing an ADB reverse rule alone can leave existing HTTP sockets working; the offline check now restarts the app after disconnecting. The local untouched WordPress Sample Page was retained as a draft so it no longer appears in the public information menu.

Native targeting also passed: selecting the second year of Diplomirani matematičar i informatičar shows its targeted announcement in **Za mene**, opens its article, and preserves the selection after restarting the app. The emulator is left with this demo selection. Reproduce with `node scripts/check-android-reader.mjs --native --targeting`; `--offline` checks previously cached staff and courses separately. All ADB forwarding is restored after the checks. Public hosting and OS push delivery remain pending.

## Confirmed with the user

- The name is **MATINF**.
- There is no tight submission deadline; the older twenty-day schedule is no longer a constraint.
- Use the currently connected Android device throughout development. ADB identifies it as `emulator-5554`; Redmi Note 8 Pro verification is deferred to the end at the user's request.
- No hosting, Expo account, or Firebase project exists yet.
- Use a free public host, rather than faculty hosting. The zero-cost/no-card constraint remains unchanged.

## Workspace and tooling

- Canonical Expo app: project root (`src/app`). The nested `matinf/` folder is an untouched starter, preserved for reference.
- Git root is this project directory, not the user's home directory.
- Node 24.21.0; root Expo 57.0.24, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3.
- PATH Java is Temurin 11. Android Studio includes JBR 21.0.6. The preview-build script uses the bundled JBR only for its own process and restores environment variables afterward.
- Android SDK platforms/build tools 34, 35, and 36 are installed; the connected emulator is API 36.
- Android package chosen as the demo default: `com.matinf.demo`; app label MATINF; light theme. This identifier is not a claim of an official university application.
- Runtime databases, local credentials, service-account files, and build artifacts are excluded from Git.

## Implemented locally

- Three-step onboarding UI with WordPress programs and courses, local preferences, skip/back behavior, and guarded notification opt-in.
- WordPress Core plugin: programs, courses, staff, documents, news/announcement categories, metadata forms, validated relationships, sanitized public content API, and additive sample seeding.
- Responsive WordPress theme: home prioritizing announcements, all collection archives and details, study years/course links, staff links, documents, Contact, About, responsive menu, and demo labeling.
- Six sample programs, 34 courses, six fictional staff, five announcements, three news posts, two information pages, and a generated PDF.
- API contract, public-host checklist, packaging and offline local-backup scripts.

## Verification

All nine WordPress integration checks passed on 23 September, including the regression check for privileged REST publication without academic metadata. Browser checks passed at widths 1440, 768, and 390, confirmed local admin login, and verified an actual title edit/save in the API before restoring the original title. Root TypeScript validation passed. Screenshots live in `artifacts/wordpress/`; upload ZIPs are in `wordpress/dist/`.

A stopped-site backup was created in `wordpress/.runtime/backups/20260923-092819`; its database, PDF upload, plugin, and theme were confirmed present. A full restore rehearsal is still pending. After restarting the original site, health, six programs, and twelve courses returned HTTP 200. Requests were slow while the Android compiler was consuming memory.

The native Android preview build is a feasibility check, not the final deliverable. `scripts/build-android-preview.ps1` builds an x86_64 release-mode APK with bundled JavaScript and the generated debug signing key. It is only suitable for the current emulator. Final signing material, ARM builds, remote notifications, and Android 11/Redmi compatibility remain separate acceptance gates.

The preview built successfully on 23 September (retry: 6m 13s), installed on `emulator-5554`, and cold-launched with Metro port forwarding removed. The native intro was visually compared against the supplied reference and prior Expo Go capture. Android's actual notification dialog, denial, later approval, and selection/denial persistence after a cold restart passed. Screenshots are `artifacts/onboarding/native-*.png`; the APK is `artifacts/build/MATINF-emulator-preview.apk` (46,250,924 bytes). Forwarding for the user's Metro server was restored afterward.

The first build was stopped after Gradle nearly exhausted its 512 MiB metadata allowance. The script now uses one worker, a 1 GiB metadata allowance, an explicit production environment, and the app-only build target. It checks Gradle's exit code rather than treating native stderr warnings as failures in Windows PowerShell.

## Remaining gates and next stages

1. Obtain and verify a free public host, including direct API access and outbound HTTPS. HelioHost Johnny is the current candidate; no account or deployment has been fabricated.
2. Configure user-owned Expo and Firebase projects, then prove a remote notification and detail routing in a native build. The local emulator APK and OS permission checks are complete.
3. Add private installation registration and bounded notification dispatch/receipts, with focused authorization and audience-matching tests.
4. Exercise hosted refresh, images, documents, and deleted-content handling against the eventual public backend. Local native navigation and persistent offline reading are verified.
5. Complete notification settings/synchronization, hosted deployment, signed ARM APK, Redmi testing, and a recoverable hosted backup.

No public hosting, notification delivery, MySQL compatibility, final signing, or Redmi run is claimed complete by the local website milestone.
