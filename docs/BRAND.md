# Zavrill

Zavrill is the selected brand for the business email hosting platform previously developed under the working name Courier Mail.

## Product identity

- Display name and spelling are **Zavrill**, with a capital Z and two final l characters.
- The descriptor is **Business email**.
- The product includes business email hosting, webmail, organization administration, and installable desktop/mobile web apps.
- The existing green palette and envelope symbol remain in use for this rebrand. A bespoke logo has not been commissioned.
- `zavrill.com` is the intended domain, subject to registration and connection. The application does not assume ownership of it.

## Compatibility

The repository remains `rankint360/CourierMail`. Existing Render and private preview URLs remain valid. A repository rename or domain cutover is a separate operation.

Internal database filenames, browser storage names, session cookies, Docker project/volume names, and DNS verification keys retain their existing Courier identifiers. Changing those identifiers could detach saved drafts, sessions, mail storage, or domain ownership records. They are compatibility details rather than the displayed product name.

New application shells use a Zavrill cache namespace and clean up old Courier shell caches when the updated service worker activates. Existing browser mail and draft databases are preserved. The webmail accepts both old and new hosted-provider labels during deployment transitions.

## Activation

Register the intended domain after completing appropriate brand checks. Then configure the app and mail hostnames, DNS/PTR, certificates, and public origins using the Netcup guide. Selecting the name does not register a domain, create a trademark, or activate email hosting.
