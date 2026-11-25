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
