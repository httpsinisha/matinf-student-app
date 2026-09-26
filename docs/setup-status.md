# Setup decisions and implementation status

Updated: 26 September 2026.

## Automatic schedule-change announcements (Core 0.5.1)

The user requested only schedule-change notifications from the suggested follow-ups, and explicitly declined further verification. Calendar saves in the WordPress editor now compare stable event IDs and normalized date/day, time, room, course and period/type. Changed, added or cancelled upcoming terms create one important announcement per save with before/after details; unchanged saves and exclusively past exam corrections do not create an announcement. Audience targets are the affected course IDs, which also match followers of their program/year through the existing feed and push targeting. Existing opt-out and global push settings still apply. Tapping the push opens the announcement using the existing app flow, so this feature does not require another APK build.

The announcement is staged as a draft before saving the calendar, then published only after the schedule is persisted. If publication fails, the editor reports the saved draft for manual publication. Versioned upload: `wordpress/dist/matinf-core-0.5.1.zip`; deployment of this new version requires replacing the current plugin. No additional tests or device checks were run for this addition, per the user's instruction.

The completed phone APK is `artifacts/build/MATINF-phone.apk`, 69,230,747 bytes, SHA-256 `23db7bb9d168ab946e8e94641a1d1dc23469f19129b1a8cfa57d87337c7b77e0`, with arm64-v8a and x86_64 libraries. Signature verification passed and it was installed over the emulator app. Native staff/course detail-back and tab-switch scroll checks passed before the user stopped further checking. Native reminder end-to-end verification was not completed.

## Logo, calendar editor, reading state and exam reminders

The supplied `logo_app_logo.png` is copied unchanged into app and theme assets, including the app header, onboarding, splash and launcher configuration. Adaptive icon XML adds an inset to preserve the artwork under Android masks. The home catalog counters are removed. Core 0.5.0 performs a one-time migration to the 35 requested staff names while keeping profile IDs and course relationships; custom contact addresses are preserved.

WordPress → Raspored lets administrators and MATINF professors add/edit/delete class, regular-exam and fourth-year graduate-exam rows. Validation covers cohort, semester, published relationships, dates, times, rooms and overlapping events. Nonces and capability checks protect saves; revision checks prevent stale editors overwriting newer changes. Saved rows are shared by the website and public schedule API, with stable exam IDs and explicit Europe/Sarajevo offsets. Overrides survive catalog reimport.

Visited tabs and stacked detail screens remain mounted with their filters and scroll state. Android hidden screens keep their layout size to avoid offset clamping. Notifications have unread/important filters and notice-type labels; reading either category marks the shared post as read. The capped, site-scoped read history persists locally. Volatile unread queries are not cached as separate history snapshots.

Android exam reminders can be set one hour or one day before an exam, reviewed/cancelled under Više → Moji podsjetnici, and opened at the corresponding program/year/period. They are independent of remote post push opt-in. Fresh online schedules reconcile moved/deleted exams; offline sessions keep existing alarms. Future alarms missing after an Android force-stop are restored on reopening. Actual timing is subject to Android background scheduling.

Validation: TypeScript and 12 app-model checks; 7 catalog/calendar checks; 15 WordPress integration checks. Browser acceptance verifies a real calendar edit/save/REST read, row controls, nonce rejection, all five tabs' scroll position after detail/back and tab switching, and persistent unread/important filters. Screenshots: `artifacts/schedule/calendar-editor.png`, `notifications-updated.png`. Upload packages: `wordpress/dist/matinf-core-0.5.0.zip`, `matinf-theme-0.4.0.zip`.

Hosted acceptance on 26 September confirms Core 0.5.0, theme 0.4.0, all 35 requested names and exam IDs/offset timestamps on `sinisa.alwaysdata.net`. The new logo is visible in the hosted mobile website screenshot `artifacts/reader-hosted/website-new-logo.png`. Native reminder acceptance is recorded separately after verification.

## Following drives schedules; physical phone package

Schedule opening and return from saved following now choose the first valid program/year in selection order. Course-only following derives the first course's cohort; with no following the first undergraduate year is the fallback. Manual schedule choices last for that screen visit; only semester is persisted. Legacy independent program/year cache is ignored. The selector also accepts master/doctoral programs so an earlier chosen level is not silently skipped (weekly teaching data remains focused on undergraduate programs).

Core 0.4.1 limits graduate exams to three fourth-year courses in October/November (six rows); programs without fourth-year courses return none. The client also filters legacy responses to fourth-year entries. Nine model tests and TypeScript pass; the targeted graduate API test passes across all programs. The user deployed Core 0.4.1 during this turn.

Phone build script: `scripts/build-android-phone.ps1`, producing `artifacts/build/MATINF-phone.apk` with arm64-v8a and x86_64. Build succeeded in 15m51s on the first ARM64 compilation. APK is 68,533,029 bytes; SHA-256 `2c80005d897bd1ab1c1976c3b2b1a18cb5c74cc3d2262d702d739e86f7a7e137`. Android apksigner verification passes; minimum API 24, target 36, 24 native libraries per ABI, embedded JS contains the public hosted URL and no local test URL. Installation over the emulator app preserved data, and native exam/graduate navigation passed against the hosted API. Physical phone execution remains for the user to test; see `docs/phone-testing.md`.

Browser acceptance passed: ignored legacy independent fourth-year cache, retained semester, saved Math/Informatics fourth year before Informatics second year through the actual following editor, verified the requested API program/year and corresponding teaching/exams, and reopened the correct cached schedule offline. Screenshot: `artifacts/schedule/following-schedule.png`. Graduate UI and API contain six terms across only three fourth-year courses. The initial run stopped on a test-only assumption about the web `aria-selected` attribute; the assertion now checks the actual requested program/year and rendered course content.

## Official catalog, publishing attachments and timetable

Core 0.3.0 and theme 0.2.0 implement grouped checkbox audiences (undergraduate/master/doctoral), native WordPress media uploads attached directly to posts, and a resumable administrator catalog import. Public curriculum tables were fetched from matinf.pmf.unibl.org and converted to 174 course/option records across six programs, including 132 undergraduate records, with year/semester, ECTS, teaching hours, elective grouping and original syllabus/source links. The 35 staff names are fictional; their roles follow the public staffing structure. The weekly schedule uses invented times/rooms/assignments and an explicitly illustrative elective choice for all 24 undergraduate program/year/semester combinations. See `docs/catalog-and-schedule.md` for provenance, limitations and hosting steps.

All four catalog integration tests pass, including resumable import, preserved IDs, exact sampled facts, all timetable cohorts without overlaps, grouped audiences and media ownership validation. A real local browser check passed: a Professor uploaded a PDF, selected multiple targets, published, and the API returned a downloadable PDF and correctly filtered feeds. TypeScript passes. The timetable browser check passes for semester/year selection, persisted selection, offline cache, exam periods, graduate coverage across all four years, rooms, site tables, staff groups/contacts and stories. Browser screenshots are in `artifacts/schedule`. It also exposed a WordPress reserved query variable collision: the site form now uses `study_year` instead of `year`.

The release APK built and installed on emulator-5554 with preferences preserved. Native acceptance (`scripts/check-android-attachment.mjs --native --hosted`) confirmed the real hosted geofencing post displays its PDF below article text; the PDF URL returns HTTP 200 and `application/pdf`. Screenshot: `artifacts/reader-hosted/attachment-below-post.png`. Existing integration regression: 13/14 passed initially; one count assertion was caused by a password-protected fixture left by an interrupted run. Setup now removes only its own named local fixtures, and the failed idempotency test passes on targeted rerun. Push registration, routing, queue and permission regressions passed.

The hosted site now reports Core 0.4.0 and 174 published courses: the user deployed the catalog and this turn's plugin update. Hosted announcement 373 returns its PDF in `meta.attachments`; the previously installed APK lacked that renderer. The user also ran enrichment: all 35 staff have contacts and the stories page exists. Native exam/graduate controls were verified against hosted Core 0.4.0 with `scripts/check-android-exams.mjs --native --hosted`. Final theme 0.3.1 contains the mobile filter layout, scrollable tables and staff avatars tested on desktop/mobile and needs replacement of the already uploaded 0.3.0 theme. No further catalog import or enrichment is required. Imported content comes from WordPress, not the APK.

## Clearer following selection and effective course totals

Native acceptance passed via `scripts/check-android-following.mjs --native --hosted`: adding a master year changed the total from five to seven effective courses and showed undergraduate and master selections together. Cancelling and reopening restored the original summary; existing preferences were left unchanged. Screenshots `following-summary.png` and `following-multiple-programs.png` were visually inspected.

The following editor now shows all study levels together with expandable program cards instead of radio buttons and hidden level tabs. Collapsed cards report followed years and effective course counts. The global summary groups selections by program and level and allows removing an entire program's following. Course totals include the union of individual courses and courses included through followed years, without duplicates. Existing stored preferences and push permission choices are preserved. TypeScript and all eight model tests pass, including multiple-program/year counting and overlapping individual choices. The updated APK built and installed on emulator-5554; installation needed an emulator restart after Android package processing stalled.

## Dismiss notifications when reading the article

The updated emulator APK built successfully and was installed with `adb install -r` on emulator-5554, preserving app data. No MATINF tray notifications were present before this check, so on-device dismissal still needs a newly delivered notification.

The user confirmed faster delivery after the priority update and that tapping a notification opens its article and clears the tapped notification. Opening the same article through the app previously left its notification in the tray. The detail screen now dismisses presented notifications after article content is available, and checks again when returning to that open article from the background. Matching validates the backend and payload and uses WordPress post ID across news/announcements, preserving notifications for other posts. Failed detail loads do not dismiss notifications. TypeScript and all seven model tests pass. A fresh remote notification is still needed to verify tray removal on-device.

## Push delivery confirmed by user; latency improvement

The targeted queue integration test passes, including high-priority payloads, recipient matching, deduplication, retries and receipts. The 0.2.1 ZIP was packaged with eight verified portable entries at `wordpress/dist/matinf-core-0.2.1.zip`. These checks use simulated Expo responses; improved real-world latency is not yet measured.

The user now reports receiving real notifications both while using another app and after removing MATINF from recent apps, with longer waits in the latter case. This supersedes the earlier InvalidCredentials blocker below. Delivery times have not been measured, and notification-tap navigation has not yet been independently verified.

Plugin 0.2.1 explicitly requests high delivery priority for visible push notifications. Previously the omitted priority used Android's normal delivery priority, which can be delayed in Doze. This is a server-only change; no APK rebuild is required. The existing enqueue/worker cron stages still run on the every-minute schedule and can span two invocations. High priority does not guarantee instant delivery or establish the cause of the user's observed delay. The hosted site still needs the 0.2.1 ZIP uploaded.

## Push implementation — activation and acceptance underway

Expo project `370f402c-255a-4990-b120-39a8812ea99c` and Firebase project `matinf-e8e3b` were supplied by the user. The ignored root `google-services.json` matches `com.matinf.demo`; the Android emulator has Google Play services. A separate private RSA-2048/SHA256 upload JKS and local password file were generated under ignored `artifacts/build/` because Expo rejected the initial development keystore. No private Firebase key has been read or stored in source control. The user confirmed Expo accepted the new JKS and Firebase key. This is not yet a real delivery test.

Plugin 0.2.0 adds authenticated-per-installation registrations, validated subscriptions, opt-out, first-publication push opt-in, a deduplicated durable queue, temporary-error retries, Expo receipts, invalid-token cleanup, and administrator diagnostics. The app adds SecureStore-backed installation credentials, Expo token registration/rotation, preference synchronization, opt-out, real connection status, foreground presentation, and article navigation from warm/cold notification taps. Setup and limits are in `docs/push-setup.md`.

All 14 WordPress integration cases pass across the full run and a targeted rerun: the first run had 12 passes and two HTTP timeouts while native compilation and unused Metro servers competed for memory; both timed-out cases passed after those servers were stopped. Queue/receipt tests use intercepted HTTP, not real delivery. Six model tests and TypeScript validation pass. Native testing exposed SDK 57's token event on every token fetch; a regression-tested listener now ignores unchanged tokens, preventing repeated registration. The first Firebase native build passed in 24m 55s; the corrected build passed in 2m 20s and was installed. The portable plugin ZIP has eight verified files; a versioned copy is `wordpress/dist/matinf-core-0.2.0.zip`.

The hosted health endpoint now reports plugin 0.2.0, public reader/PDF checks pass, and an unauthenticated registration returns the expected 401. The corrected native app registers successfully and displays its enabled status (`artifacts/push/registered.png`). The user reports one active installation, a successful hosted Expo HTTPS probe, a scheduled every-minute task, and three jobs failing with `InvalidCredentials` (posts 76, 80, 82). Those posts are present in the public feed with matching audiences. Expo's specific **FCM V1 service account key** assignment is being checked; an accepted Google Play service-account upload alone does not establish FCM credentials. Live delivery and notification-tap acceptance are not yet verified. The initial `am kill` background check left a process alive, so no cold-start test is claimed either.

## Study selection correction

The Professor's hosted post 73, “Obavještenje za studente informatike”, is published with audience `21:4` (Diplomirani matematičar i informatičar, fourth year). Public REST checks include it for `21:4` and exclude it for `30:4` (Diplomirani informatičar, fourth year). Both categories are supported; the unfiltered website-news section also includes it. The hosted post has not been modified by the coding agent.

The preferences editor now restores the selected program, migrates older records by inferring the program from followed years/courses, separates undergraduate/master/doctoral programs, and saves edits with an explicit “Sačuvaj izbor” button while preserving notification permission settings. Android Back cancels unsaved edits. Home and the personal feed display actual program/year/course names, and website news explains its unfiltered scope. TypeScript and four model tests pass. `node scripts/check-android-reader.mjs --native --hosted --preferences` passed on emulator-5554: program and fourth-year checkboxes are restored without reselecting the program after process restart; master/doctoral tabs show their programs; Back cancels an unsaved program change; the personal feed names the saved selection. Screenshots `artifacts/reader-hosted/preferences-*.png` were visually inspected. The updated emulator APK built successfully (final build 3m 43s). The saved program is now Diplomirani informatičar, fourth year; existing individual course subscriptions are preserved. No hosted audience edit was made.

## Public hosting trial

HTTPS corrections confirmed on 24 September: both WordPress core URLs and the PDF metadata now use `https://sinisa.alwaysdata.net`. `node wordpress/scripts/check-hosted.mjs` passed HTTPS JSON, nonempty public collections, course relationships, year targeting/exclusion, 404 behavior, and PDF content checks. The root `.env` now selects this public backend; `.env.local` can override it for local work.

The hosted emulator APK built successfully in 15m 16s and was installed on `emulator-5554`. The packaged manifest was inspected with aapt2 and confirms `usesCleartextTraffic=false`; the bundled JavaScript contains the public HTTPS URL. No local WordPress port forwarding was present during acceptance. Five-tab navigation and staff/course/article/program/document details passed. The hosted year-targeted feed and selection persistence after native restart also passed. Screenshots are in `artifacts/reader-hosted/`; the current APK is `artifacts/build/MATINF-emulator-preview.apk` (46,660,392 bytes, x86_64 emulator only, debug signed). The emulator is left following the second year of Diplomirani matematičar i informatičar on the hosted site. The reader test now scrolls to an article because hosted seed timestamps can produce a different post order from local content. No hosted offline or physical Redmi test is claimed by these checks.

MATINF theme and plugin are active, `/wp-json/matinf/v1/health` returns 200, and the hosted catalog contains 6 programs, 34 courses, 6 staff, 1 document, and 8 feed posts. The initial installation errors were traced to Windows ZIP entry separators and corrected in the packaging script. The initial permalink and HTTP URL configuration problems have also been resolved.

The user selected alwaysdata Free on 24 September. Public API reads work without a browser challenge. Deployment instructions are in `docs/hosting-setup.md`. Local data and accounts remain intact; hosted users are separate. Authenticated hosted publishing, server-side outbound Expo connectivity, and real remote push delivery still need acceptance checks.

## Expanded app and Professor workflow

The user expanded the scope to a full WordPress-backed reader and Professor/Administrator publishing. The app now has Početna, Notifikacije, Predmeti, Osoblje, and Više tabs, plus program/year navigation, rich article details, linked staff/courses/documents, public email, sharing, contact/about, and editable preferences based on WordPress IDs. Personal feeds use the REST audience filter. Lists and visited details are stored locally; confirmed 404 responses remove cached details. Hosted reading is verified above; remote push is still pending.

Professor accounts use WordPress authentication, publish their own posts, and cannot manage other authors, academic records, accounts, or site settings. This implements direct publishing as the working default; an approval workflow was asked about but not confirmed. Administrators create accounts in Users → Add New and assign Profesor. Post targeting uses the MATINF metadata form; choose year/subject and uncheck the general-audience checkbox for targeted content.

The demo catalog has been extended additively to 34 courses across study years, six fictional staff, five announcements, and three news posts. Existing edits remain intact. Eleven WordPress integration tests, TypeScript validation, and three onboarding model checks passed for the expanded code. The browser publishing check also passed: an Administrator creates a Professor, the Professor signs in and publishes through the WordPress form, and matching year feeds include the post while general-only feeds exclude it. The temporary user and post are removed afterward.

The expanded native APK built successfully (16m 39s) and was installed on `emulator-5554`. Five-tab navigation, staff/course/article/program details, and offline staff/course caching across native restarts passed. Screenshots in `artifacts/reader/` were visually reviewed against the supplied design direction. The current emulator APK is 46,660,384 bytes. Removing an ADB reverse rule alone can leave existing HTTP sockets working; the offline check now restarts the app after disconnecting. The local untouched WordPress Sample Page was retained as a draft so it no longer appears in the public information menu.

Native targeting also passed: selecting the second year of Diplomirani matematičar i informatičar shows its targeted announcement in **Za mene**, opens its article, and preserves the selection after restarting the app. The emulator is left with this demo selection. Reproduce with `node scripts/check-android-reader.mjs --native --targeting`; `--offline` checks previously cached staff and courses separately. All ADB forwarding is restored after the checks. Public hosting and OS push delivery remain pending.

## Confirmed with the user

- The name is **MATINF**.
- There is no tight submission deadline; the older twenty-day schedule is no longer a constraint.
- Use the currently connected Android device throughout development. ADB identifies it as `emulator-5554`; Redmi Note 8 Pro verification is deferred to the end at the user's request.
- Alwaysdata Free hosting is active at `https://sinisa.alwaysdata.net`. Expo/Firebase project setup is still pending.
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

1. Complete alwaysdata acceptance: authenticated hosted publishing and server-side outbound Expo HTTPS. Public HTTPS API, PDF, and native Android reading/targeting checks pass.
2. Configure user-owned Expo and Firebase projects, then prove a remote notification and detail routing in a native build. The local emulator APK and OS permission checks are complete.
3. Add private installation registration and bounded notification dispatch/receipts, with focused authorization and audience-matching tests.
4. Exercise hosted refresh, images, documents, and deleted-content handling against the eventual public backend. Local native navigation and persistent offline reading are verified.
5. Complete notification settings/synchronization, hosted deployment, signed ARM APK, Redmi testing, and a recoverable hosted backup.

No public hosting, notification delivery, MySQL compatibility, final signing, or Redmi run is claimed complete by the local website milestone.
