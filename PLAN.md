# MATINF-inspired WordPress and Android information system

Status: implementation underway. Local onboarding, the WordPress content/API/theme, Professor publishing, and the five-tab Android reader with personal feeds and caching are implemented. Public hosting, native push, and final-device acceptance remain open. See `docs/setup-status.md` and `wordpress/README.md` for evidence and commands.

Prepared: 18 September 2026. The user has approximately 20 days available; the exact submission date and daily working hours are not confirmed.

Update, 23 September 2026: the user confirmed there is plenty of time, so the earlier twenty-day allocation below is historical guidance, not a deadline. Keep the name MATINF. Use the currently connected Android emulator throughout development and defer Redmi verification to the end. The user has no hosting, Expo, or Firebase accounts yet and chose a free public host. HelioHost Johnny is a candidate, pending signup and real API/outbound-network tests.

This document is the handoff for implementing the project step by step. Preserve confirmed decisions. Items labeled **ASSUMPTION**, **proposed default**, or **open** are not additional requirements approved during the interview. Validate feasibility early and record any subsequent decisions here.

## 1. Objective and constraints

Build an unofficial academic demonstration consisting of:

1. A functional, responsive WordPress website backed by a database.
2. An API exposing its public content to an Android application.
3. A standalone Android APK that can be installed and demonstrated on a physical phone.
4. Targeted push notifications that open the relevant content in the app.
5. A consistent, professional academic identity across website and app.

WordPress and its database are the content source of truth. An administrator must not enter the same content separately for the app. Publishing supported content must not require a new APK.

The Android APK is the most important final deliverable. Prefer a complete, stable system over additional unfinished features.

| Constraint | Agreed requirement |
| --- | --- |
| Purpose | Academic demonstration; not an official university service |
| Schedule | No tight deadline; the earlier twenty-day schedule is historical guidance |
| Experience | Beginner; architecture and documentation must be understandable |
| Budget | Strictly EUR 0; no paid fallback, billing activation, or payment-card requirement |
| Final device | Xiaomi Redmi Note 8 Pro; Android 11 / API 30 compatibility required |
| Development emulator | Android Studio Medium Phone; Android 16 / API 36 |
| Language | Serbian Latin for content and app interface |
| Backend delivery | Publicly hosted WordPress site |
| Demonstration internet | Venue Wi-Fi with hotspot/mobile-data backup |
| Accounts | Free Expo, Firebase/Google, and hosting accounts are acceptable |
| Future audience | Possible rollout to up to 100 students after assessment; not v1 |

The user has no ongoing service-maintenance commitment after assessment. A real rollout requires a separate content, ownership, capacity, and maintenance decision.

## 2. Confirmed scope

### Required in v1

- Responsive WordPress site with header, identity/logo, navigation, main content, and footer.
- Home, News, Announcements, Studies, Courses, Staff, Documents, and Contact content.
- Individual news, announcement, program, course, and staff detail pages/screens.
- Public reading without registration; WordPress Administrator and Professor accounts. Administrators create Professor accounts; Professors publish/edit their own posts without site-wide administration privileges.
- WordPress-based content editing, images, document links, and relevant academic relationships.
- API-backed mobile screens, not a whole-site WebView wrapper.
- Optional first-launch notification subscription setup and later settings.
- Subscriptions to program-years, individual courses, or both.
- Year subscriptions include notifications for the courses belonging to that year.
- Administrator-selected notifications when first publishing a news item or announcement.
- Notification tap opens the corresponding detail, including when starting the app.
- Previously loaded lists and detail text remain available offline across app restarts.
- Refresh, sharing public website links, external document opening, and clear loading/error states.
- Standalone APK, source code, practical setup/build guide, WordPress backup/export, and demonstration/testing checklist.

### Explicitly outside committed v1

- Student accounts, cross-device preference synchronization, private content, personalized student records, grades, or enrollment transactions.
- Editorial approval workflows beyond the Administrator/Professor roles now requested by the user.
- Search, advanced browsing filters, favorites, and dark mode.
- In-app PDF reader, managed document downloads, and a downloadable offline library.
- Arbitrary page-builder layouts, embedded widgets, and full desktop-layout reproduction in the app.
- Public production rollout, app-store publishing, iOS delivery, or production-scale guarantees.
- Formal academic report and presentation slides.
- AI chatbot, RAG, AI search, or any promised AI integration.

AI may be discussed only after all core acceptance checks pass, under a separate time and zero-cost feasibility decision.

## 3. Academic content and data relationships

### Study hierarchy

Preserve the user-provided grouping below for the demo. Do not silently rename or restructure programs to match a different interpretation of the reference website.

| Level | Duration | Program pages |
| --- | --- | --- |
| Osnovne studije | 4 years | Diplomirani matematičar i informatičar; Diplomirani informatičar; Diplomirani profesor matematike i informatike |
| Master studije | 1 year | Matematička analiza i primjene; Algebra i geometrija |
| Doktorske studije | 3 years | Doktor matematičkih nauka |

Relationships: study level contains programs; each program has its own years; courses belong to a program-year and link to teaching staff. A year must be identified together with its program, not by a bare number such as “2”.

Populate all six program pages with basic information, duration, representative courses, and relevant documents. This is a sample curriculum, not a claim to provide complete official catalogs.

### Content entities

| Entity | Required capability and content |
| --- | --- |
| Program | Name, study level, duration, basic information, curriculum/course links, relevant documents |
| Course | Title, program/year, semester, description, linked staff, optional document links |
| Staff profile | Name, academic title/role, optional photo, public work email, short biography, linked courses |
| News / announcement | Title, body, publication date, category/type, optional image/media, document and external links, relevant audiences |
| Informational page | Title and basic rich content for study information, contact, and other agreed static content |
| Document | Descriptive link/title and a WordPress media attachment or suitable external URL; usable from the Documents section and related content |
| Device registration | Push token, installation association, selected audiences, notification preference and validity state |
| Notification submission | Content reference, publication event, intended recipients, submission outcome, and retry information |

Basic rich content means paragraphs, headings, lists, bold/italic, images, links, and document links. Complex tables, embedded media, and arbitrary WordPress layouts are not committed.

**Proposed data defaults for implementation:**

- Use native WordPress posts with distinct News and Announcements categories, pages for static information, and custom post types for programs, courses, and staff.
- Use WordPress media for uploaded images/documents. Avoid duplicating a second content database for the app.
- Register academic metadata and relationships explicitly; expose only published public fields through the API.
- Use stable IDs for relations and notification routing, not display names or array positions.
- Represent a shared course separately in each program-year for the demo unless actual sample content requires a shared-course model. Do not invent cross-program equivalence rules.
- Require course program/year/semester assignments to be consistent with the parent program duration. Validate linked entity IDs and public URLs.
- Keep device registrations and notification records private to server-side management; do not expose them through public content endpoints.

These are implementation defaults, not a finalized database schema. Record final endpoint and field contracts before building dependent screens.

### Sample content policy

- Use attributed public program facts.
- Use clearly fictional demo staff, announcements, news examples, and sample documents.
- Do not use real student names, results, or other student records.
- Do not present sample curricula or staff profiles as official information.
- Use a distinct, simple identity inspired by MATINF, with a visible unofficial-demo label.
- Exact app name, assets, sample counts, and content wording remain open. Populate enough examples to exercise every screen, program, relationship, and notification scenario.

## 4. User experience and core journeys

### Mobile navigation

Use five bottom tabs (updated to the user's expanded app request):

| Tab | Responsibility |
| --- | --- |
| Početna | Announcements first, recent news, and shortcuts to important sections |
| Notifikacije | Personal feed of matching news/announcements, all-post view, and preference editing |
| Predmeti | Program/year filters, course details, staff, and material links |
| Osoblje | Teaching staff profiles, public email, and linked courses |
| Više | Studies/programs, News, Documents, Contact, notification settings, and demo/about information |

News and Studies are reachable from Home and More. Staff has its own tab and is linked from course profiles. Relevant links connect related content without requiring users to return to Home.

Mobile navigation is fixed in code. WordPress manages content within supported sections; changing website menu labels/order does not automatically restructure mobile navigation. Adding a new screen type may require an APK update.

### First launch and preferences

1. Offer optional subscription setup with a Skip action.
2. Let users choose program-years and/or individual courses.
3. Explain notifications and obtain the applicable device/app permission or consent.
4. Enable general notices for opted-in users; skipping academic selections does not subscribe them to every course.
5. Allow later changes, including disabling notifications, in Settings.
6. Public content remains readable if setup is skipped, permission is denied, or push registration fails.

**Proposed default:** preferences belong to an installation and are persisted locally, then synchronized to WordPress when online. Show pending/failed synchronization honestly; do not claim a server-side change succeeded while offline. No account or cross-device restore is promised.

### Administrator publication

1. Sign into WordPress as an Administrator or Professor. The account's assigned role determines permissions; users cannot grant themselves a role at login.
2. Create a news item or announcement with supported content and optional attachments.
3. Select its relevant program-year/course audiences, or explicitly select Everyone for a general notice.
4. Optionally check the notification control, unchecked by default.
5. Publish. Content becomes available on the website and through the API.
6. The app obtains it when fetching/refreshing; the administrator does not modify the APK.
7. If selected for notification, send to the matching device set and display submission status.

Ordinary edits must not send again. Notification failure must not undo content publication. Scheduling notifications or resend campaigns are not requirements; manual retry addresses failed submissions.

### Reading, refresh, and sharing

- Render supported WordPress content in appropriate mobile screens.
- Provide manual refresh and normal loading, empty, error, and missing-image states.
- Share the corresponding public website URL.
- Open document links through the device browser or an available viewer. External tools handle any download.
- Open email, telephone, and external website links using suitable device handlers where available.

### Offline and removed content

- Persist previously loaded lists and detail text across restarts.
- Display that data is saved/cached and may be stale; provide retry.
- Do not promise that images, uncached details, or documents work offline.
- If no cached data exists, explain that internet is needed to load content.
- A timeout or server error does not mean the content was deleted; retain cached data in these cases.
- Once the API confirms that previously public content was removed/unpublished, discard its cached detail and show an unavailable state with a route back.
- An old notification for unavailable content must not crash or lead to a blank screen.

## 5. Notifications

### Confirmed behavior

- Provider path: WordPress plugin -> Expo Push Service -> Firebase Cloud Messaging -> Android device.
- Use an option at first publication, not automatic sending for every post.
- Support Everyone, program-year, and individual-course audiences.
- A subscribed year includes its associated course notices.
- Match any applicable selection, not all selections simultaneously.
- Deduplicate the recipient set before sending so a device selected through several matching audiences is targeted once for that event.
- A notification tap opens the relevant content detail.
- Show submission status in WordPress and allow deliberate retry when sending fails.
- Provider acceptance is not proof that a phone displayed the notification.

### Implementation requirements

- Keep Firebase/service credentials and any Expo push access credential out of the APK, public API, and source control.
- Register/refresh installation tokens and preferences without student accounts, using a per-installation credential so one client cannot change another registration by supplying an ID.
- Validate and limit anonymous registration requests; never provide a public endpoint that sends pushes.
- Track a stable publication event and per-recipient outcome to prevent repeat hooks or normal edits from resending successful submissions.
- Handle invalid tokens and provider receipts; distinguish accepted, failed, and uncertain outcomes.
- Avoid claiming exactly-once delivery. If a timeout leaves acceptance uncertain, flag that uncertainty rather than blindly resending to every recipient.
- Do not make a large remote send loop block content publication. Choose a bounded dispatch method compatible with the verified host and provide an administrative way to complete/check submissions.
- Automatic transient-failure retries are not a committed feature; manual retry is the agreed workflow.
- Verify notification routing with the app foregrounded, backgrounded, and closed; test denied permission and changed subscriptions.

Expo SDK 57 documentation states that Android remote push is unavailable in Expo Go. Use development/release builds for this work and verify final behavior in the standalone APK.

## 6. Architecture, versions, and environments

### Confirmed technology decisions

- Android client: Expo SDK 57, React Native, TypeScript.
- Content backend and website: WordPress and its database.
- Custom integration: a focused project-specific WordPress plugin.
- API foundation: WordPress REST API, with narrowly scoped extensions where needed.
- Push: Expo Push Service with Firebase Android configuration.
- Development: local WordPress plus early hosted feasibility checks.

### API responsibilities

- Public read access to published pages, news, announcements, programs, courses, staff, media/document links, and required academic metadata.
- Pagination for lists and stable identifiers for details/relationships.
- Installation registration and preference updates through dedicated validated endpoints.
- Administrator content management and Professor-owned news/announcement editing. Notification service administration remains Administrator-only.
- Consistent mobile handling of empty results, unavailable content, invalid requests, and server/network errors.
- Build a short API contract with example responses before mobile screen implementation. Exact routes and field names remain to be defined during that step.

The app owns presentation, local cached copies, and local preference UX. WordPress owns content and server-side subscription/dispatch records. Expo and Firebase deliver notifications; they are not an additional source of academic content.

### Version discipline

- Before code changes, read `https://docs.expo.dev/versions/v57.0.0/` as required by the workspace `AGENTS.md`.
- Use SDK 57-compatible packages and the project lockfile; do not copy setup instructions from older SDKs without checking them.
- Current root manifest declares Expo `~57.0.24`, React Native `0.86.3`, React `19.2.3`, and TypeScript `~6.0.3`. These are declarations, not evidence that all build combinations have been validated.
- Root and nested `matinf/` Expo projects both exist. Inspect their actual content and select one canonical project before implementing; do not delete either without checking for useful work.
- Verify WordPress, PHP, database, theme, and plugin versions against the chosen host before pinning them. No exact versions or theme were selected in the interview.
- Verify Android 11 support by building and running, not only by checking declared minimum SDK values.

### Environments and delivery defaults

- Local WordPress for development and content/plugin work.
- One public hosted demo site; no separate production-grade staging environment is required for v1.
- Keep API base URL environment-specific; a final APK must target the public HTTPS backend.
- Retain Android signing material securely so replacement APKs can update the installed app.
- Do not assume cloud builds are unlimited or that local builds are already configured. Verify a free build path early and document it.
- Back up the WordPress database, uploads, plugin/theme configuration, and source needed to restore the site. A content XML export alone is not a complete site backup.

## 7. Security, accessibility, and operations

**Proposed baseline defaults:**

- HTTPS for hosted API and notification registration.
- Only published intended-public content available anonymously; drafts, private fields, credentials, and device tokens stay private.
- Standard WordPress administrator authentication, capability checks, input validation, and protections appropriate to admin actions.
- No WordPress administrator credentials embedded in the app.
- Sanitize content and validate URL schemes before mobile rendering/opening links.
- No advertising, monetization, analytics SDK, or student tracking requirement.
- Collect only the installation/token/preferences needed for notification functionality; include a brief explanation and a disable/reset path.
- Keep operational logs focused on failures and notification status; redact credentials and push tokens.
- Use readable contrast, labels for interactive elements, scalable text, useful touch targets, and screen layouts checked on both target devices.
- Use a light theme; do not implement an incomplete dark theme.
- Use reasonable pagination, request timeouts, and bounded work suitable for the verified host. Numerical performance and capacity guarantees have not been agreed.
- No external monitoring subscription is required. Verify the backend and push path before assessment, with a short troubleshooting guide.

## 8. Step-by-step implementation checklist

Day ranges are a **proposed working allocation**, not a confirmed daily-hour commitment. Preserve a finishing buffer. Do not reduce core scope silently if a gate fails; document the conflict and choose the smallest explicit adjustment.

### Stage 0 — Workspace and version review (day 1)

- [x] Read applicable workspace instructions and exact SDK 57 documentation.
- [x] Inspect both Expo projects and identify the canonical app without discarding existing work. Root is canonical; nested starter preserved.
- [x] Establish a project-local source-control boundary. `git rev-parse --show-toplevel` confirms this project directory.
- [x] Check installed Android/JDK/Node/build tooling and record versions in `docs/setup-status.md`.
- [ ] Confirm account ownership, app/package identity, and a credential-storage approach.
- [ ] Record exact submission date if supplied and agree a workable daily pace.

Exit: one understood workspace and a version/account checklist; no accidental changes outside the project.

### Stage 1 — Prove hosting, APK, and push feasibility (days 1–3)

- [ ] Verify a strictly free host with PHP/database support, HTTPS, custom plugins, uploads, public REST access from the app, and outbound HTTPS for Expo requests.
- [ ] Check signup requirements, quotas, sleeping/suspension behavior, API restrictions, and backup/export access using current provider documentation and real requests.
- [x] Set up persistent local WordPress with the MATINF plugin/theme and separate integration-test database.
- [ ] Set up a minimal hosted test site and verify it from the Android device.
- [x] Produce an installable emulator preview APK through the local free build path; final ARM/signing delivery remains pending.
- [x] Run the preview on the API 36 emulator without Metro port forwarding; Redmi/API 30 verification is deferred to final acceptance by the user's updated instruction.
- [ ] Configure Expo/Firebase and demonstrate one remote push opening a test detail route.
- [ ] Record any unresolved host/build/notification blocker before broader UI work.

Exit: public API request, real-phone installation, and remote notification are proven. Do not assume a paid fallback is authorized.

### Stage 2 — Content model, plugin, and API contract (days 3–5)

- [ ] Implement the agreed content entities and academic relations in the focused plugin.
- [ ] Define/validate program-years, courses, staff links, audiences, and media references.
- [x] Create all six program pages and representative sample content locally.
- [ ] Add basic public endpoints/REST exposure and private installation/subscription endpoints.
- [ ] Document endpoint shapes, identifiers, pagination, and error cases.
- [ ] Verify draft/private content and device registrations are not publicly exposed.

Exit: a documented API supplies representative data for every required screen.

### Stage 3 — WordPress website (days 5–7)

- [x] Select and record a free theme approach compatible with the agreed rich-content subset: custom MATINF theme.
- [x] Build responsive identity, header/menu/footer, Home, lists, details, academic sections, Documents, and Contact locally.
- [x] Make Home prioritize announcements and provide clear navigation.
- [x] Add unofficial-demo labeling and source attribution.
- [x] Check mobile, tablet, and desktop layouts and administrator editing flow, including a real browser edit reflected in the API.

Exit: the administrator can manage all demo content and a browser user can navigate all required pages.

### Stage 4 — Android reading experience (days 7–11)

- [ ] Build four bottom tabs and all required list/detail routes.
- [ ] Connect Home, announcements, news, studies/programs/courses, staff, Documents, and Contact to the API.
- [ ] Render the supported rich-content subset safely.
- [ ] Add refresh, public-link sharing, external documents, and useful contact links.
- [ ] Add persistent cached lists/detail text and offline/error/empty/loading states.
- [ ] Handle confirmed removal, uncached notification targets, slow responses, and missing media.
- [ ] Check Serbian Latin text, accessibility basics, and layout on API 30/API 36.

Exit: useful standalone mobile reading works online and for previously loaded text offline.

### Stage 5 — Subscription and publication notification workflow (days 11–14)

- [ ] Build optional onboarding and editable settings for general, year, and course preferences.
- [ ] Persist/synchronize preferences, handle token changes, and respect opt-out/permission denial.
- [ ] Implement administrator publication option and explicit audience selection.
- [ ] Expand year membership and compute a deduplicated matching device set.
- [ ] Record publication/submission outcomes, handle receipts and invalid tokens, and provide manual retry.
- [ ] Prevent normal edits/repeated hooks from causing repeat sends.
- [ ] Complete notification-to-detail routing in foreground/background/closed states.

Exit: an administrator can publish a targeted announcement and demonstrate correct inclusion/exclusion and direct navigation.

### Stage 6 — Integration, deployment, and acceptance (days 14–17)

- [ ] Deploy complete content/plugin/theme configuration to the verified host.
- [ ] Build a signed standalone APK pointed at that HTTPS site.
- [ ] Run the acceptance matrix below and fix failures.
- [ ] Verify representative website content appears consistently in mobile screens after refresh.
- [ ] Test the real phone and hotspot fallback.
- [ ] Export a recoverable backup and verify recovery instructions.

Exit: core acceptance passes with the actual hosted backend and final APK configuration.

### Stage 7 — Handoff and demonstration buffer (days 18–20)

- [ ] Freeze optional feature work.
- [ ] Prepare source, setup/build instructions, API notes, backup/export, and APK.
- [ ] Document secret setup without including secrets, signing-key custody, and known limitations.
- [ ] Prepare a short repeatable demonstration and troubleshooting checklist.
- [ ] Rehearse install -> read -> subscribe -> publish -> receive -> open -> offline reading.
- [ ] Record tested device/OS/build versions and final verification results.

Exit: the project can be installed, explained, demonstrated, and restored by following the supplied guide.

## 9. Acceptance and test matrix

Use focused automated tests for audience matching, publication-event duplicate prevention, and authorization/validation where mistakes would affect multiple users. Use repeatable manual end-to-end checks for device, UI, and external-service behavior. Do not spend the schedule building an exhaustive UI automation suite.

| Area | Required scenarios |
| --- | --- |
| Installation | Standalone APK launches without a development server on Redmi/API 30; app also works on emulator/API 36 |
| Website | Responsive pages, all six programs, course/staff relations, documents, header/menu/footer, clear demo identity |
| Content updates | Publish/edit in WordPress; website reflects it and Android fetch/refresh displays it without rebuilding |
| API access | Only intended published data is public; malformed requests fail clearly; private tokens/admin actions are protected |
| Navigation | All four tabs, news access, study hierarchy, related staff/course links, Android Back behavior |
| Rendering | Rich text, Unicode Serbian Latin, long titles, absent images, document links, empty lists |
| Target matching | Year-only subscription receives its course notice; course-only receives its course notice; unrelated program/year is excluded |
| Overlap | Year plus course, or multiple matching targets, produces one intended recipient entry |
| General notices | Everyone reaches opted-in general subscribers; disabled notifications do not receive newly dispatched notices |
| Publication | Checkbox off sends nothing; checked initial publication sends; ordinary edits do not resend |
| Failure/retry | Content stays published after send failure; status is truthful; retry does not resend known-successful recipients |
| Registration | Denied permission does not block reading; changed token/preferences synchronize; invalid tokens are handled |
| Push navigation | Foreground, background, and closed-app tap opens correct content; removed and uncached targets have clear states |
| Offline | Loaded lists/detail text survive restart; uncached data has helpful messaging; failed fetch does not erase valid cache |
| Removal | Confirmed unavailable content loses cached detail; transient failures are not mistaken for deletion |
| External actions | Share URL opens public website; document and contact links work or show a useful failure |
| Operations | Hosted HTTPS works over Wi-Fi/hotspot; backup and setup guide are usable; secrets are absent from distributed artifacts/source |

A provider-accepted push is not an end-to-end pass until a real-device demonstration confirms reception and correct navigation. Delivery timing itself remains subject to network/provider/device behavior.

## 10. Assumptions and unresolved decisions

### Assumptions carried from the interview summary

1. Preferences are installation-specific; no synchronization between devices.
2. V1 is Android-only, directly distributed as an APK without an app-store launch.
3. Contact is informational with external links; no contact form or embedded map.
4. Fetching and manual refresh are sufficient; no continuous real-time content synchronization.
5. The user's academic grouping is authoritative for demo organization.
6. Exact WordPress/PHP/theme/hosting/dependency choices are verified during implementation preparation.

### Additional proposed defaults in this document

- Standard posts/categories and pages plus custom academic post types.
- Stable IDs and a documented API contract before dependent mobile implementation.
- Program-specific course entries unless actual content demonstrates a shared-course requirement.
- Private per-installation registration credentials, minimal notification data, and no analytics service.
- A light theme, accessibility basics, one hosted demo environment, and bounded operations/logging.
- Phase day ranges and sequencing are planning estimates.

### Open risks / gates

| Risk or unknown | Resolution required |
| --- | --- |
| Free host not selected | Prove API/plugin/outbound-request support without billing before committing deployment work |
| SDK/build compatibility | Early actual APK run on Android 11 and API 36 |
| Phone push behavior | Test permissions/settings, token registration, receipt, and tap routing on the Redmi |
| No exact daily work capacity | Track progress against the 20-day window; preserve finishing buffer |
| Scope size | Targeted subscriptions and six program pages are core; reduce only by explicit agreement |
| Two existing app projects | Inspect and select canonical project while preserving useful existing work |
| Source-control boundary | Establish project-local scope; never stage personal files inherited from a parent repository |
| Final brand/content not prepared | Choose demo name and simple identity; curate enough attributed facts and fictional examples |
| Notification retries/background execution | Verify a host-compatible dispatch/status mechanism; do not assume reliable cron or exactly-once delivery |
| Backup/build/signing custody | Document restore, free build path, and secure key/account ownership |
| Future public rollout | Separate decision on accurate content, maintenance owner, privacy, capacity, and sustainable hosting |

## 11. References and working rules

- Visual/content reference: https://matinf.pmf.unibl.org/
- Mandatory versioned Expo reference: https://docs.expo.dev/versions/v57.0.0/
- Versioned notification reference: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- Expo push overview: https://docs.expo.dev/push-notifications/overview/

The reference and Expo documentation were inspected during the interview. Recheck exact setup instructions when implementing; do not treat unverified hosting/service limits as established facts.

Work stage by stage, updating checkboxes only after verification. Record the command/device/manual evidence needed to reproduce meaningful checks. Keep confirmed requirements, new decisions, and unresolved risks distinct. Do not introduce paid services, student authentication, AI, or other deferred features without revisiting scope with the user.
