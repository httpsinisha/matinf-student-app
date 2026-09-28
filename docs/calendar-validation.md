# Calendar resource validation (Core 0.5.2)

The WordPress Raspored editor rejects a save if a room or assigned teacher is
already occupied in another published program/year calendar. The error identifies
the submitted row and conflicting course, program, year, calendar, day/date and
time. Rejected saves preserve the current calendar and create no announcement or
push notification. Checks run inside the existing global calendar save lock.

- Weekly classes are compared with other classes in the same semester.
- Regular and graduate exams are compared together by actual date, including
  different exam calendars for the same cohort.
- Intervals that only touch at their endpoints are allowed.
- Room names ignore case, accents and repeated whitespace. Use the same room
  designation throughout; “101” and “Učionica 101” are different names.
- Teachers match by profile ID. An unassigned teacher is not a shared resource.
- Generated defaults and edited overrides both count. An empty override removes
  a calendar's reservations. The calendar being replaced is excluded.
- Generated exams without an explicit end retain the editor's two-hour duration.
- Existing conflicting data is not automatically moved; a conflicting submitted
  calendar must be corrected before it can be saved.

Classes and exams are not compared against each other: the weekly teaching model
has no teaching-period dates or holiday exceptions. Such validation requires those
dates rather than inferring them from an exam's month or weekday.

Targeted regression checks:

```powershell
cd wordpress
node --test --test-name-pattern="calendar resource validation|calendar edits validate" tests/catalog.test.mjs
```

Deploy `wordpress/dist/matinf-core-0.5.2.zip` through WordPress Plugins → Add New →
Upload Plugin, replacing the installed MATINF Core. No theme or APK update is
required. The archive does not deploy itself to alwaysdata.
