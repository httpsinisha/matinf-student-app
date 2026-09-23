# Free public hosting setup

Budget remains EUR 0, with no card, billing activation, donation, or paid fallback. The user chose a free public host and has no existing hosting, Expo account, or Firebase project.

## Candidate: HelioHost Johnny

Use the **Johnny** free plan at <https://heliohost.org/signup/>. The provider documents limited signup windows at 12:00 and 00:00 UTC. During Budapest daylight-saving time those are 14:00 and 02:00; check the UTC time when signing up. Other plans on the page are not authorized alternatives.

Create the account yourself with an email you control and keep its password in your password manager. Once active, provide only the site's public URL. If registration is full, report that; do not enter payment details or select another plan merely to bypass the queue. The provider also requires a login at least once a month and enforces resource limits. This is a candidate, not a verified deployment yet.

After account activation:

1. Enable an HTTPS certificate for the supplied subdomain in the hosting panel.
2. Install WordPress with PHP 8.3 or a supported newer version and MariaDB/MySQL. Use a unique administrator password; keep login and database credentials private.
3. Record the actual WordPress/PHP/database versions and upload limits. Prefer the tested WordPress 7.1.2 or a security-patched compatible release.
4. Upload `wordpress/dist/matinf-core.zip`, activate it, then upload/activate `matinf-theme.zip`.
5. Set the site title to MATINF. Set permalinks to Post name. Keep the unofficial-demo label.
6. Run Tools → MATINF demo once. It creates sample content in the hosted database with that site's own IDs and document URLs.
7. Test the endpoints below from a non-browser client and the Android device. A page loading in a browser is not sufficient.

## Hosted acceptance checks

- `GET https://HOST/wp-json/matinf/v1/health`: JSON 200, without login or JavaScript/cookie challenges.
- Programs returns six public programs; a course detail links to its real program, staff, and PDF.
- A saved admin edit appears on the website and in a subsequent API response.
- Draft/private/password-protected details return 404 through the MATINF API.
- A server-side `wp_remote_get` to `https://exp.host/--/api/v2/push/getReceipts` reaches Expo over verified TLS. An HTTP method/validation error still proves connectivity, but is not a successful push.
- Upload and download a document; inspect quota/resource use and full database/upload backup access.
- Run over phone hotspot as well as normal Wi-Fi.

After these pass, configure Expo/Firebase for remote pushes in a native build and connect the app's environment-specific API URL. Do not put the hosting/admin password, Firebase service-account key, or Expo push access token in app code or Git.

## Why some familiar free hosts were not selected

- InfinityFree's browser security system blocks API clients/mobile applications: [provider explanation](https://forum.infinityfree.com/t/can-you-use-apis/117968).
- AwardSpace documents outbound connections as a paid-account feature, which conflicts with Expo push dispatch: [provider documentation](https://www.awardspace.com/kb/connect-remote-scripts-rss-feeds-curl/).
- Alwaysdata advertises a free no-card option, but its registration/WordPress installation page can request card verification. It was not treated as a proven no-card path.

HelioHost sources: [Johnny features and signup windows](https://wiki.helionet.org/Johnny), [signup plans](https://heliohost.org/signup/), [WordPress resource guidance](https://wiki.helionet.org/WordPress). Reviewed 22–23 September 2026. Signup availability and a successful real account test remain unresolved.
