# Courier Mail Record Register

Recorded on November 24, 2026, America/Los_Angeles.

This register reconstructs the initial implementation from the work recorded in the project chat and tool results. Entries are chronological within each phase. Earlier entries have no invented execution times. Continue adding dated entries when work, verification, deployment, or outstanding items change.

## Product and implementation decisions

| Record | Step | Result or evidence |
| --- | --- | --- |
| R001 | Reviewed Titan Email and business email competitors. | Established custom-domain email hosting and webmail as the reference product category. |
| R002 | Narrowed the product to the webmail experience at the user's direction. | Prioritized inbox, folders, search, compose, replies, attachments, and draft recovery. |
| R003 | Received the instruction to build the app completely. | Began implementation in the Courier Mail project directory. |
| R004 | Read the Sites workflow and inspected the workspace. | Selected a new private Site and a standalone Worker build. |
| R005 | Asked which provider to connect. | User authorized choosing the provider. Selected Fastmail and its JMAP API. |
| R006 | Selected the Courier Mail name and green visual style. | Implementation choices made without a separate branding brief. |
| R007 | Read the Fastmail developer and API token documentation and JMAP mail specification. | Used server-side bearer authentication, the session resource, mailbox and message methods, upload/download endpoints, and EmailSubmission. |
| R008 | Created the private Sites project. | Project ID `appgprj_6b067b0c6e908191b4176e4b4a8da6bd`, persisted in `.openai/hosting.json`. |
| R009 | Created package, build, local-server, environment-example, and ignore files. | Node.js 22+, no npm dependencies. The build embeds web assets into a Worker module. |

## Backend implementation

| Record | Step | Result or evidence |
| --- | --- | --- |
| R010 | Implemented configuration reporting and Fastmail session discovery. | Demo works without a token. Live endpoints require `FASTMAIL_API_TOKEN`. |
| R011 | Implemented hosted identity checks, optional owner restriction, and same-origin write checks. | Hosted live requests require Sites identity. `OWNER_ID` adds an explicit user restriction. |
| R012 | Restricted provider URLs and redirects, added timeouts and response headers. | Credentials remain server-side and provider requests are restricted to Fastmail domains. |
| R013 | Implemented mailboxes, identities, search, message pagination, and message detail. | Provider-backed APIs in `server/worker.js`. |
| R014 | Implemented read/unread, stars, folder moves, bulk changes, and custom folder creation. | Changes use JMAP mailbox and email methods. Partial provider failures are surfaced. |
| R015 | Implemented attachment upload and download. | Upload size limit is 10 MB. UI limits combined attachments to 10 MB. |
| R016 | Implemented replacement draft creation. | The old provider draft is retained until a replacement exists. Cleanup failure can leave recoverable duplicate drafts. |
| R017 | Implemented sending and pending-send recovery. | Saves a provider draft, checks existing submissions, uses submission state, and requests moving the email to Sent on successful submission. These behaviors have mocked coverage, with real provider verification pending. |

## Webmail interface

| Record | Step | Result or evidence |
| --- | --- | --- |
| R018 | Built the responsive sidebar, message list, and reading pane. | Inbox, Starred, Sent, Drafts, Archive, Spam, Trash, and custom folders. |
| R019 | Added search, selection, bulk actions, stars, unread state, and folder moves. | Demo uses local records. Live mode uses provider-backed endpoints. |
| R020 | Added compose, reply, reply all, forward, Cc/Bcc, signatures, and templates. | Includes blank-subject confirmation and recipient validation. |
| R021 | Added attachment selection, removal, forwarding, and download controls. | File data is stored locally in demo mode and uploaded through the server in live mode. |
| R022 | Added IndexedDB persistence, draft autosave, and recovered-draft settings. | Local recovery survives refresh. Live drafts sync when the composer closes. |
| R023 | Added explicitly labeled demo data. | Demo sending writes to the local Sent folder. No external email is delivered. |
| R024 | Added settings, provider connection instructions, and keyboard access. | Ctrl/Cmd K focuses search. Site currently serves a single mailbox account. |

## Verification and corrections

| Record | Step | Result or evidence |
| --- | --- | --- |
| R025 | Ran JavaScript syntax checks and the Worker build. | Both source entrypoints parsed and the build succeeded. |
| R026 | Added nine targeted backend regression tests. | Covered configuration, identity, owner restriction, cross-origin writes, draft preservation, submission retry, submission state and Sent movement, partial failures, and provider URL restrictions. |
| R027 | Ran the nine backend tests. | All passed using simulated JMAP responses. |
| R028 | Started the loopback local preview and attempted an in-app browser connection. | Initial browser operation timed out. Recovered by selecting the already-open preview tab. |
| R029 | Checked draft save, refresh recovery, reopening, demo sending, and search in the browser. | The draft persisted across refresh. The demo send appeared in Sent and matched search. |
| R030 | Inspected desktop and mobile layouts. | Corrected content overflow and mobile toolbar sizing, increased reading text, and made narrow layouts open on the message list. |
| R031 | Corrected a stale draft reader after sending. | The selected draft is cleared after successful submission. |
| R032 | Locked pending-send content and attachment controls and guarded upload/send overlap. | Helps retain the same submission ID on uncertain outcomes and prevents sending before uploads finish. |
| R033 | Rebuilt and reran the backend tests and syntax checks after corrections. | All nine tests passed and the build succeeded. |
| R034 | Checked custom folder creation and bulk archive in the browser. | The folder appeared and bulk archive moved the selected demo messages. |

## Initial delivery

| Record | Step | Result or evidence |
| --- | --- | --- |
| R035 | Attempted Sites source synchronization. | Initial Git connection failed under restricted network access. |
| R036 | Requested the network permission needed for publication. | Permission was granted for the turn. |
| R037 | Retried source synchronization. | Windows Schannel reported a credentials-package error. Configured OpenSSL for this repository's Git HTTP transport and retried successfully. |
| R038 | Pushed the exact Site source and packaged the Worker artifact. | Source commit `277edd1d5655a85a64bfc4f0b2a855e266d80f24`. |
| R039 | Published the private Site. | Native deployment reported `succeeded`, deployment ID `appgdep_6b067e8f559c81918c97dbbcd271bdd5`. |
| R040 | Created the source ZIP and requested opening the deployed Site in the app. | Source ZIP created successfully. Browser handoff returned queued. |
| R041 | Stopped the owned local preview server and delivered the app. | Private Site URL and source package supplied. Fastmail token remains unconfigured. |

## GitHub handoff on November 24, 2026

| Record | Step | Result or evidence |
| --- | --- | --- |
| R042 | Received the instruction to create a Record Register and STATUS.md and push all project files. | Destination `rankint360/CourierMail`. |
| R043 | Inspected local project files, Git history, configuration, and available instructions. | Twelve source/configuration files were tracked. No project AGENTS.md was found. |
| R044 | Checked local GitHub CLI availability and connected GitHub tools. | `gh` was unavailable. Selected the authenticated GitHub connector. |
| R045 | Inspected the destination repository. | Repository is public, empty, defaults to `main`, and the connected account has push access. |
| R046 | Repeated tests, build, and syntax verification before upload. | Nine tests passed. `npm run build`, `node --check web/app.js`, and `node --check server/worker.js` succeeded. |
| R047 | Created this register and STATUS.md. | Documents previous work, current deliverables, outstanding setup, and publication progress. |
| R048 | Prepared project files for GitHub. | Includes source, tests, configuration, build scripts, and documentation. Generated `dist/`, local ZIP/tar archives, `.git/`, and runtime secrets follow the existing ignore and packaging workflow. |
| R049 | Initialized the empty GitHub repository with STATUS.md. | Initial commit `2df350b042f992e8acf8eaae0388afb65c21875e` on `main`. |
| R050 | Uploaded all 14 project files through the authenticated GitHub connector. | Source commit `3e46a3269727d38f8c9a5779ee8d7de3a93978e0`. Advanced `main` with the expected prior head and without force. |
| R051 | Read the remote recursive source tree. | Confirmed all 14 file paths were present and the result was complete, with `truncated` false. |
| R052 | Updated the register and current status to reflect the verified GitHub delivery. | Follow-up documentation commit records the completed upload. Fastmail connection and real provider verification remain pending. |

## Outstanding verification

- Configure an eligible Fastmail account's API token with Email and Email submission scopes as a server secret, then redeploy.
- Verify real receive/reply/send, Sent movement, attachment upload/download, folder mutations, and retry behavior against that account.
- Validate deployment identity and provider behavior with the connected account before relying on live email.

## Reference artifacts

- [Current status](STATUS.md)
- [Run, connection, and build instructions](README.md)
- [GitHub repository](https://github.com/rankint360/CourierMail)
- [Private deployment](https://courier-webmail-jv.stonybrioche1.chatgpt.site)
- [Fastmail developer documentation](https://www.fastmail.com/dev/)
- [Fastmail API token instructions](https://www.fastmail.help/hc/en-us/articles/5254602856719-API-tokens)
- [JMAP mail specification](https://jmap.io/spec/rfc8621/)

## Platform expansion, November 24–25, 2026

| Record | Step | Result or evidence |
| --- | --- | --- |
| R053 | Received the request to expand all three product areas. | Business service, webmail, hosting infrastructure, and desktop/mobile access. |
| R054 | Inspected the implementation and reopened the private Site source. | Preserved Site identity and project history. |
| R055 | Confirmed infrastructure preferences with the user. | User has Render, no Linux server, and will select the domain after the build. |
| R056 | Reviewed current Render and Stalwart documentation. | Application runs over HTTP on Render. SMTP/IMAP need a separate host. Selected Stalwart v1 management and JMAP. |
| R057 | Added the persistent business backend. | SQLite organizations, users, domains, mailboxes, sessions, invitations, audit history, rate counters, and provisioning leases. |
| R058 | Implemented authentication and authorization. | Scrypt hashes, protected sessions, tenant ownership, owner/admin/member roles, same-origin writes, password changes, and session revocation. |
| R059 | Implemented domain onboarding. | Unique domains, DNS ownership verification, MX/SPF/DMARC checks, activation, and generated DNS-zone display. |
| R060 | Implemented mailbox administration. | Assignment, provisioning, aliases, quotas, suspension, encrypted mailbox sessions, and recoverable provider operations. |
| R061 | Built the business admin interface. | Overview, Domains, Mailboxes, Team, Branding, Security, Apps, and Operations. Invitations generate expiring links for the user to share. |
| R062 | Extended webmail to use self-hosted per-user JMAP credentials. | Preserved Fastmail compatibility and scoped browser databases by authenticated user. |
| R063 | Added the installable web app. | Manifest, PNG/SVG icons, shell-only service worker caching, install controls, and iOS guidance. |
| R064 | Added infrastructure and operational files. | Render Blueprint, Dockerfile, Stalwart Compose, backup scripts, password recovery, and deployment documentation. |
| R065 | Added business and production HTTP regression tests. | Covers tenant boundaries, verification gates, sessions, invitations, encryption, provisioning methods, provider object encoding, app routes, and PWA assets. |
| R066 | Ran the expanded suite. | All 20 tests passed, including the production HTTP entrypoint. Build and JavaScript syntax checks succeeded. |
| R067 | Corrected Stalwart payload encoding. | Credentials and aliases use keyed objects, matching Stalwart v1 documentation. Provider query recovery checks exact account/domain identities. |
| R068 | Attempted expanded browser QA. | Initial browser connection timed out. Reset the browser connection and restarted the local preview successfully on November 25. |
| R069 | Verified admin flows in the browser using a synthetic local account. | Registration, domain reservation, DNS setup display, branding, Apps screen, branded webmail, and mobile width checks succeeded. |
| R070 | Checked Docker availability. | Docker is unavailable. Mail container startup, delivery, and volume restoration remain unverified. |
| R071 | Discovered and suggested the Render integration. | User installed it. Render access was verified with a read-only workspace query. |
| R072 | Requested Render workspace confirmation. | User confirmed Rankint360. Listed existing services and selected Ohio to match their region. |
| R073 | Reviewed current Render Blueprint, disk, and compute-plan references. | Prepared one application service and a 1 GB persistent disk. No existing services are being adopted. Applying a reviewed plan requires user approval. |
| R074 | Updated readiness and deployment documentation. | Records business backend, separate mail host, installable PWA, paid disk choice, verification, and remaining live setup. |
