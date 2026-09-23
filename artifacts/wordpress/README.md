# Local WordPress verification

Captured on 23 September 2026 by `node wordpress/scripts/check-site.mjs`.

- `home-1440.png`, `home-768.png`, `home-390.png`: desktop, tablet, and phone layouts, with horizontal overflow checks.
- `studies-mobile.png`: six-program archive after opening the mobile navigation.
- `program-mobile.png`: program detail with year/course relationships.
- `admin-programs.png`: authenticated program management.

The browser check also saved a temporary program-title edit, verified the changed title through the public API, and restored the original. All nine isolated WordPress integration tests passed. These screenshots show the local demo; they do not verify a public host or remote notifications.
