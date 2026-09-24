# Free public hosting setup

Budget remains EUR 0, with no card, billing activation, donation, or paid fallback. The user chose a free public host and has no existing hosting, Expo account, or Firebase project.

## Selected trial: alwaysdata Free

On 24 September 2026 the user chose to try **alwaysdata Free**. Start at <https://www.alwaysdata.com/en/wordpress-hosting/> and select the Free offer. Create the account with an email you control, verify that email, and choose a unique account name, such as `matinf-demo` if available. The assigned website address will use `alwaysdata.net`; use the actual address shown in the panel, not an assumed available name.

The advertised free plan has 1 GB total storage (including files, mail and databases), 256 MB RAM, and three days of rolling backups. It is for noncommercial use and uses the supplied subdomain. Choose the actual EUR 0 Free plan, not a time-limited trial of a paid plan. The provider advertises registration without a credit card. If the flow makes a card mandatory, stop at that step and report the non-sensitive message rather than activating billing.

Keep passwords private. Share only the public site URL when ready. The existing local WordPress users, including `matinf-prof`, do not automatically exist on the new site. Create hosted users separately with new passwords or migrate them later as part of a planned content migration. Do not import the local Playground SQLite database into MySQL.

Install WordPress using alwaysdata's WordPress Marketplace installer. Keep the installation at the root of the assigned HTTPS address if possible. Use a unique WordPress administrator login; the alwaysdata account and WordPress account are separate logins. This is a hosting trial, not a verified deployment yet.

No-card accounts have stricter HTTP filtering. General network documentation allows outgoing connections, but direct Android REST access and outbound Expo HTTPS still need real tests on this account. No payment/card verification workaround is authorized.

After account activation:

1. Enable an HTTPS certificate for the supplied subdomain in the hosting panel.
2. Install WordPress with PHP 8.3 or a supported newer version and MariaDB/MySQL. Use a unique administrator password; keep login and database credentials private.
3. Record the actual WordPress/PHP/database versions and upload limits. Use the current supported WordPress release available from the installer and verify compatibility with our plugin; the local test runtime used 7.1.2.
4. Upload `wordpress/dist/matinf-core.zip`, activate it, then upload/activate `matinf-theme.zip`.
5. Set the site title to MATINF. Set permalinks to Post name. Keep the unofficial-demo label.
6. Run Tools → MATINF demo once. It creates sample content in the hosted database with that site's own IDs and document URLs.
7. Test the endpoints below from a non-browser client and the Android device. A page loading in a browser is not sufficient.
8. Create a Profesor account under Users → Add New. Publish a targeted test post, then check matching and unrelated personal feeds. Keep the default Sample Page as a draft.

The upload ZIPs can be rebuilt from the project root with `./wordpress/scripts/package.ps1`. They contain the plugin and theme only, not the local content database, uploaded media, or user accounts. Preserve the existing local site until migration is verified.

Packaging correction, 24 September: Windows PowerShell `Compress-Archive` produced backslash entry paths, followed by hosted errors "Plugin file does not exist" and missing `style.css`. The packaging script now writes explicit forward-slash ZIP paths and verifies the file count and required entry files before replacing the archives. Re-upload the rebuilt ZIPs; if WordPress detects an existing MATINF installation, use its replacement option. Correct entry files are `matinf-core/matinf-core.php` and `matinf/style.css`. Hosted activation still needs to be confirmed after re-upload.

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
- Alwaysdata's no-card account restrictions require an actual API test. Its current 1 GB Free plan is now the user's chosen trial; no account activation or compatibility result is assumed.

Alwaysdata sources: [WordPress/free signup](https://www.alwaysdata.com/en/wordpress-hosting/), [plan limits](https://help.alwaysdata.com/en/docs/admin-billing/billing/public-cloud-prices/), [restricted accounts](https://help.alwaysdata.com/en/docs/admin-billing/profile/restricted-mode/), [network policy](https://help.alwaysdata.com/en/docs/technical-specifications/network/). Reviewed 23–24 September 2026.

HelioHost Johnny remains an alternative if the alwaysdata trial fails: [signup plans](https://heliohost.org/signup/). It has limited signup availability; paid alternatives remain outside the agreed budget.
