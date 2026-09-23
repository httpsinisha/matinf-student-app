# MATINF WordPress

This folder contains the local WordPress development setup, the **MATINF Core** plugin, and the **MATINF** website theme. The root folder remains the canonical Expo app. The nested `matinf/` starter is preserved and is not used.

## Start the website

From the project root:

```powershell
npm --prefix wordpress ci
npm run wordpress
```

Open [the local website](http://127.0.0.1:9400) or [WordPress administration](http://127.0.0.1:9400/wp-admin/).

The local administrator username and randomly generated password are in `.runtime/local-admin.json` in this folder. Open that file locally; do not paste the password into chat or commit the file. The runtime and database are excluded from Git. The bootstrap `admin` account's default password is replaced and that account is demoted.

The server binds to localhost after startup. Keep it local; it is not the public deployment. WordPress Playground supplies PHP and SQLite, so no system PHP, Docker, MySQL, or paid service is needed. The database persists in `.runtime/site/wp-content/database/.ht.sqlite`. Do not delete `.runtime` to restart the site.

Versions: Playground CLI 3.1.55, WordPress 7.1.2, PHP 8.3. Automatic WordPress updates and WP-Cron are disabled **only in this local development runtime**. Keep the chosen hosted installation maintained separately. A native MySQL/MariaDB host must still be tested; SQLite success is not evidence that the hosted environment passes.

Six Playground workers are used because the CLI warns that fewer workers may deadlock on file locks. Startup is heavier than a static development server. If port 9400 is occupied, stop this project's old WordPress process before starting a second copy; do not point two processes at the same SQLite database.

## Editing content

The admin sidebar contains Studijski programi, Predmeti, Nastavno osoblje, and Dokumenti. These use ordinary WordPress editing plus a MATINF metadata form.

- Create/publish programs before linking courses. The project uses 4-year undergraduate, 1-year master, and 3-year doctoral programs.
- Courses require a published program, a year within that program, and semester 1 or 2 **within that year**. Choose published teaching profiles and documents from the lists.
- Upload documents through Media, then paste their media URL into the document form. External document URLs must use HTTPS.
- Publish news/announcements as standard posts, using category **Novosti** or **Obavještenja**. The “Važno” checkbox only marks importance; it does not send a push notification.
- Add a featured image to a post or profile to display it on the site. The supplied demo content deliberately does not invent real staff photos.
- Contact and About are editable under Pages.

Invalid academic metadata is rejected. An attempted invalid publication is kept as a draft with an admin notice; existing valid metadata remains intact. Drafts, private/password-protected posts, and unpublished relationships are omitted from the mobile API.

Tools → MATINF demo can add the sample content to an empty installation. Seeding is additive: existing slugs and administrator edits are preserved. The demo contains all six programs, twelve representative courses, three fictional staff profiles, five sample posts, two information pages, and a generated PDF stored in WordPress Media. It is not an official curriculum.

## Public API

Health: <http://127.0.0.1:9400/wp-json/matinf/v1/health>

The [API contract](../docs/api-contract.md) documents collections, details, pagination, relationships, and error handling. No WordPress administrator credential belongs in the Android app. Public reading is anonymous; installation registration and push dispatch are not implemented in this first backend milestone.

To reach the local site from the attached Android emulator/device:

```powershell
adb reverse tcp:9400 tcp:9400
```

Use `http://127.0.0.1:9400` on that device while USB/ADB is connected. The final APK must instead use the verified public HTTPS backend.

## Verify and package

```powershell
npm run test:wordpress
node wordpress/scripts/check-site.mjs
./wordpress/scripts/package.ps1
```

The integration suite uses its own `.test-runtime` database on port 9410, never the administrator's live development content. The browser check needs installed Google Chrome, captures desktop/tablet/mobile layouts, checks navigation, signs into local admin, and verifies that a temporary title edit appears in the API; it restores the original title afterward. Screenshots are in `artifacts/wordpress/`.

The packaging command produces `wordpress/dist/matinf-core.zip` and `wordpress/dist/matinf-theme.zip`, containing only deployable plugin/theme source. Upload these through Plugins → Add New → Upload and Appearance → Themes → Add New → Upload on the verified host. Activate the plugin before the theme. Runtime files and admin credentials are not included.

## Local backup and restore

Stop the WordPress terminal with Ctrl+C, then run:

```powershell
./wordpress/scripts/backup.ps1
```

This copies the complete local site/database/uploads, plugin, theme, package manifests, and local login into a timestamped private folder under `.runtime/backups/`. It refuses to copy a running SQLite database. Keep a second copy somewhere you control. A WordPress content XML export by itself is not a full backup.

To restore locally, stop WordPress; preserve the current `.runtime/site` under a different name; copy the backup's `site` into `.runtime/site`, and its `local-admin.json` into `.runtime/`. Restore the plugin/theme source from the backup's `site/wp-content` into `wordpress/plugins` and `wordpress/themes` as well, because those source folders are mounted at runtime. Run `npm run wordpress` and verify admin login, content counts, a program/course relation, and the PDF. Keep port 9400 for a same-machine restore. Migrating to another hostname requires URL replacement; this local SQLite backup must not be imported as if it were a MySQL database.

## What is still pending

Public hosting, HTTPS and outbound Expo-request checks; Expo/Firebase project configuration; private installation registration; notification queue/receipts; mobile content/cache integration; and the final Redmi build. See [setup decisions](../docs/setup-status.md) and [hosting steps](../docs/hosting-setup.md). The local site is a working development milestone, not a claim that those external-service gates are complete.
# Professors and targeted publishing

Open `/prijava/` to sign in as an Administrator or Professor. Administrators add accounts through **Users → Add New**, assigning the **Profesor** role. The login form does not allow self-selected privileges. Professors can publish and edit their own posts and upload media; academic catalogs, other authors' posts, settings, and users remain under Administrator control.

When writing a post, choose **Novosti** or **Obavještenja**. In **MATINF podaci**, select the program/year and/or subjects. Uncheck **Opšta objava za sve** for a targeted post. Leaving all targets empty makes the post general. Publishing makes it available to the Android REST reader on refresh; matching study-year followers also see their subjects' posts. These are public posts with a personalized feed, not private classroom content. OS push delivery is not yet connected.

`node wordpress/scripts/check-publishing.mjs` checks an Administrator-created temporary Professor, actual login and form publication, and the matching REST feed. It cleans up its temporary user/post afterward and seeds the additive demo catalog.
