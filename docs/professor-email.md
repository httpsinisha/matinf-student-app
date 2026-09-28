# Professor contact (Core 0.6.1 / theme 0.4.1)

Install both updated ZIPs from `wordpress/dist`. The Android form is included in
the updated `artifacts/build/MATINF-phone.apk`. It uses the same backend as the
website. No Gmail password, SMTP password, or mail secret belongs in the APK.

In **WordPress → Alati → MATINF mejl**, enter:

- **Mejl pošiljaoca:** the existing alwaysdata mailbox address.
- **SMTP server:** `smtp-ACCOUNT.alwaysdata.net`, replacing ACCOUNT with the account
  name. The plugin uses STARTTLS on port 587 with certificate validation. Alwaysdata
  permits sending from its hosted services without SMTP authentication. This
  transport is not intended for sending from a local development PC.
- **Probna adresa profesora:** the first test inbox controlled by the owner.
- **Probna adresa studenta (opciono):** leave empty to accept any student address
  after code verification; fill it to restrict testing to one student inbox.
- Enable **Probni režim** and **Uključi slanje poruka**, then save.

No professor metadata is changed. In test mode all public professor contact forms
send to the single configured teacher test address. With no test student address,
each student enters their own address and confirms it with a code. An optional
test student address restricts both requests and confirmations to that address.
Existing configurations retain their restriction until the field is cleared.
The public config API never exposes these
addresses. Disabling test mode restores each professor's WordPress email address;
placeholder addresses such as `example.org` are rejected.

Open a professor profile, select **Pošalji mejl profesoru**, enter the student's
name/address, a subject and message. Select **Nastavi — pošalji kod**, retrieve the
six-digit code from the student inbox, then select **Potvrdi i pošalji**. Check the
professor inbox and the student's copy, including spam folders. Clicking Reply in
the professor's mail should address the student. The student's copy replies to
the professor. Sender remains the configured MATINF mailbox in both cases.

The server confirms submission to the mail transport, not delivery to an inbox.
Use **alwaysdata → Emails → History** to investigate provider rejection/bounces.
Leaving SMTP blank uses the existing WordPress mail transport instead.

## Implementation and limits

- `GET /wp-json/matinf/v1/contact/config?staffId=ID` reports availability/test mode.
- `POST .../contact/request` takes `staffId`, `name`, `email`, `subject`, `message`.
  It sends a verification code to the student, not the professor, and returns an
  opaque request ID. Recipient is resolved on the server.
- `POST .../contact/confirm` takes `requestId` and `code`. It verifies the code and
  current recipient configuration before submitting the professor message and
  a separate student copy. Both clients show partial failures and retain the
  request ID for retrying only the missing copy.
- Requests expire after 10 minutes; five incorrect code attempts lock a request.
  Code hashes, not codes, are stored. Pending text is in expiring WP transients;
  successful sends remove text/name/subject immediately. Expired transient
  storage is cleaned by WordPress cron.
- Requests are limited to one code per minute and five per hour per student,
  fifteen per hour per source IP and one hundred per hour globally. A short
  database lock serializes counters and confirms. The limits intentionally suit
  this small project; larger deployments may need a proper queue and tuning.
- Completed retries do not resubmit mail. As with ordinary SMTP, a process crash
  between transport acceptance and persisting the receipt cannot guarantee
  exactly-once delivery. A timed-out request should be checked in the inbox/log
  before the user starts a new request.
- Forms do not accept attachments. User-entered email headers, recipients or SMTP
  hosts are never accepted from the public endpoint. Admin settings require the
  administrator capability and a WordPress nonce.

## Local checks

`node --test wordpress/tests/contact.test.mjs` uses an isolated WordPress runtime
and intercepts mail before delivery. It does not send real email. TypeScript is
checked with `npx tsc --noEmit`. Hosted delivery requires uploading the packages
and configuring the mailbox; local passing tests are not evidence of Gmail receipt.
