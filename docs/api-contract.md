# MATINF API v1 — initial content contract

WordPress is the source of content and numeric IDs. Base URL: `https://HOST/wp-json/matinf/v1` (local development uses `http://127.0.0.1:9400`). This contract is the foundation for the mobile reader; notification registration/dispatch will be added after hosting and native-build feasibility are verified.

## Public read endpoints

- `GET /health`: plugin version, site URL, WordPress version, and API version. No credentials or device records.
- `GET /content/{collection}?page=1&per_page=20`: `{items: Content[], page, perPage, total, totalPages}`. Page is positive; per_page is 1–50. Out-of-range pages return an empty items array.
- `GET /content/{collection}/{id}`: one Content. Missing, wrong-type, draft, private, trashed, and password-protected content all return 404.
- `GET /home`: `{announcements: Content[], news: Content[]}`; five announcements and three news items, newest first.

Collections: `announcements`, `news`, `programs`, `courses`, `staff`, `documents`, `pages`. News and announcements use native WordPress posts and separate categories. Academic collections use dedicated post types. Lists of courses accept optional positive `program_id` and `year` (1–4) filters. Other unknown filters are ignored, never interpreted as arbitrary database queries.

## Content shape

```json
{
  "id": 42,
  "type": "courses",
  "slug": "uvod-u-programiranje",
  "title": "Uvod u programiranje",
  "excerpt": "Primjer nastavnog predmeta.",
  "bodyHtml": "<p>Javno dostupan opis predmeta.</p>",
  "url": "https://HOST/predmeti/uvod-u-programiranje/",
  "publishedAt": "2026-09-22T10:00:00Z",
  "updatedAt": "2026-09-22T10:00:00Z",
  "image": null,
  "meta": {"programId": 10, "year": 1, "semester": 1},
  "relations": {"program": {"id": 10, "title": "Diplomirani informatičar", "url": "https://HOST/studije/informatika/", "type": "programs"}, "staff": [], "documents": []}
}
```

`image` is null or `{url, alt}`. All linked relationships refer only to published, unprotected content. `bodyHtml` contains a limited, sanitized rich-text subset; clients must still validate URL schemes before opening links.

Metadata:

| Collection | Fields |
| --- | --- |
| programs | `level`: undergraduate/master/doctoral; `durationYears`: 4/1/3 respectively; `ects`: integer |
| courses | `programId`: published program ID or null; `year`: within that program; `semester`: 1 or 2 within the year |
| staff | `academicTitle`, `email` (public work/demo email only) |
| documents | `fileUrl`: published media attachment URL or validated HTTPS URL; `mimeType` |
| announcements/news | `important`: boolean |
| pages | no additional fields |

Course and program `relations.documents` contain linked documents; course `relations.staff` contains teaching staff. Staff details include `relations.courses`; program details include `relations.courses`. These are bounded to 50 and contain public summaries. Full lists are paginated through the collection endpoints.

Program-years will use `PROGRAM_ID:YEAR`, never a bare year. IDs are stable within a WordPress installation and its database backups; imports into a new database may assign new IDs and require client preference reset/migration.

## Writes and errors

Anonymous requests cannot write content. WordPress admin screens require normal authentication, edit capabilities, and nonces for the plugin's forms. No public send-push endpoint exists.

Errors use WordPress REST's `{code,message,data:{status}}` envelope: 400 invalid input, 404 unavailable content, 401/403 unauthorized actions, 5xx backend failures. Clients must retain cached content on network/5xx errors; only a confirmed detail 404 invalidates that cached detail.

## Hosting acceptance gate

Test a real HTTPS request from Android (without browser cookies), anonymous draft/password protection, a validated admin edit, and a server-side HTTPS request to Expo before marking hosted feasibility complete. Local Playground uses SQLite for development; MySQL/MariaDB hosting compatibility remains a separate test.
# Expanded reader and publishing contract

Added 23 September 2026: `GET /content/feed` combines published news and announcements. Items retain `type: news` or `announcements` for detail routes. Normal pagination still applies. `following=true` accepts comma-separated `program_years=PROGRAM_ID:YEAR` and `course_ids=COURSE_ID`; each selection list is limited to 50. Matching uses OR semantics and returns each post once. A selected year includes its course notices, and an individually selected course includes notices targeted to its program-year. General notices are always included. With no selections, the personal feed contains only general notices. Invalid or unpublished selection IDs return 400; the app's preference editor uses the current published catalog.

News/announcement `meta` now includes `authorName` and `audience: { everyone, programYears, courseIds }`. Classic WordPress forms validate and save those fields. Old unclassified posts are general. Public browsing/detail access remains unrestricted for published content: targeting personalizes the feed and is not an access-control boundary.

The Professor role can create/publish/edit/delete its own posts and upload media. It cannot edit another author's posts, academic records, users, or site settings. Administrators retain those capabilities. Both roles use standard WordPress authentication through `/prijava/`; no editor password is stored in the mobile app. Remote push delivery remains a separate integration.
