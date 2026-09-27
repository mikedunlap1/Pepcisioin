# Pepcision

Research-compound storefront with a branded chat widget, Node backend, finite approved-answer library, optional OpenAI intent routing, encrypted decision logs, and an authenticated review screen.

## Current public release: GitHub Pages demo

The website currently uses a **browser-only demo** so the team can try the mobile/desktop interaction before backend hosting is selected. Each widget script explicitly has `data-mode="demo"` and loads `chat/demo.js` first. The demo displays a visible label, uses preset answers and local refusal routing, and never calls the chat API, an AI provider, or browser storage. Conversations disappear on refresh or Clear chat. No server, paid hosting, or AI credentials are needed for this release. The backend below is prepared for a future deployment and is not active on GitHub Pages.

Edit approved replies in `server/knowledge.mjs`, then run `node scripts/build-chat-demo.mjs` and `npm run check`. The checked-in bundle contains only public approved text and local routing; CI checks that it matches the sources. Unknown wording goes to support. This demo tests the experience, not live AI classification or production logging. Lab reports, sample COAs, and new purity claims are excluded.

When activating the backend later, remove demo mode and the demo bundle script from each page, configure the actual API endpoint, and replace the demo privacy disclosure with accurate server/provider processing and retention details. Complete the production checks below first.

## Run locally

Use **Node 24.13.1**, the tested version. Its built-in SQLite API is experimental. No npm dependencies or installation step are required.

```sh
npm start
npm run check
```

Open http://127.0.0.1:3000. With no environment configuration, approved FAQ phrases work, uncertain questions go to support, logs are in memory, and admin access is disabled. The check command runs site validation and security/integration tests. AI tests use deterministic provider doubles, not paid API calls.

## Controlled response flow

`POST /api/chat` accepts only `{ "message": "...", "session": "optional server-signed token" }`.

1. Enforce origin, content type, payload limits, IP/session quotas, and the daily service cap.
2. Locally refuse medical, dosage, injection, reconstitution, consumption, outcome, and bypass requests. Detected personal details receive a fixed privacy response.
3. Match exact approved FAQ phrases. If enabled, OpenAI classifies remaining questions into an intent and a finite answer ID.
4. Independently verify the selected answer is active and unexpired, then return its exact curated text. Model-written prose never reaches the visitor.
5. Record the decision before returning it. Storage failures fail closed. Provider errors, ambiguity, invalid output, and unsupported questions route to the contact team.

There is no autonomous browsing, MCP access, order lookup, payment handling, or action-taking tool. Contact links let visitors initiate support; no email is sent automatically and no support ticket is falsely claimed to exist. Each question stands alone; ambiguous follow-ups receive no inferred advice.

The six entries in `server/knowledge.mjs` use the existing FAQ, contact information, and product storage placeholders. They make no unverified purity, stock, shipping-time, or temperature claims. **Review them with the business owner before launch.** Initial content expires December 25, 2026. Update provenance, review/expiry dates, and policy version when approving changes; never automatically ingest sales copy.

## Database and privacy

SQLite is selected for a low-volume, single-instance launch, capped at 1,000 chat requests per day by default. AES-256-GCM encrypts decision payloads and review audits, with authenticated record binding. IDs, timestamps, review flags, and keyed limiter identifiers remain database metadata. This is payload encryption, not full SQLite-file encryption. Use an encrypted persistent volume too.

The database stores **no visitor messages, reply transcripts, medical narratives, raw IP addresses, emails, payment details, or page URLs**. Records contain a pseudonymous session hash, topic category, routing decision, trigger code, approved answer ID, classifier, policy version, and review state. The response can be reconstructed from the approved source version. IPs become date-scoped HMAC identifiers; IPv6 addresses are grouped by /64. Rate buckets survive restarts.

Decision records and review audits expire after 14 days by default, with cleanup at startup and hourly. Rate buckets expire at their minute/day boundary and are removed by cleanup. Reaching the maximum 50,000 event rows stops chat until capacity is available. Backups and host/provider logs need separate retention policies.

Airtable is not connected and receives no data. It adds unnecessary data sharing for this metadata-only launch. Before running multiple instances, move both event storage and atomic rate limits to shared Postgres/Redis. Independent SQLite instances would split logs and let clients bypass global quotas.

## Admin access

Visit `/admin`. Every read/review API request requires the 256-bit `ADMIN_TOKEN`. The token is entered manually, held only in page memory, and cleared on sign-out, navigation, or after 15 minutes. It is never put in cookies, URLs, or local storage. Review actions are separately recorded. The HTML shell is public; all data APIs are authenticated.

This is a single-admin deployment. Before team access, add named accounts and MFA through an identity-aware proxy. Rotate the admin token and restart to revoke old access. A browser sign-out clears the local token but does not revoke a copied token.

## Production deployment

The live storefront is hosted at `https://mikedunlap1.github.io/Pepcisioin/`. GitHub Pages cannot run the backend. Keep the storefront there and run the API/admin on a separate **Node web service with a persistent disk**. The server's public-file allowlist excludes server code, secrets, databases, tests, and repository metadata. The same application also supports hosting the site and API together.

For the split deployment, set `CHAT_WIDGET_ORIGINS=https://mikedunlap1.github.io` and include that origin plus the assigned backend HTTPS origin in `ALLOWED_ORIGINS`. Only `/api/chat` supports CORS, only for configured origins, POST, and Content-Type. The admin screen must be opened on the backend origin. Origins cannot restrict a GitHub Pages path; all sites owned by this GitHub account share the same origin. Origin checks supplement quotas and authentication, and do not authenticate public API callers.

After the backend passes live checks, remove `data-mode="demo"` and add `data-api="https://ACTUAL-BACKEND-HOST/api/chat"` to each `chat/widget.js` script tag (including product pages and the privacy page). Use the assigned URL, never a guessed name. Keep demo mode active until that endpoint is ready. Source links and contact/privacy links continue to use the storefront address.

This release excludes sample lab reports, new COA documents, and new product testing/purity claims. Existing generic documentation FAQs remain. Start with `AI_ENABLED=false`; approved phrases and refusal/support routing work without a provider account. Enabling AI later is a separate configuration and live-evaluation step.

1. Copy `.env.example` to `.env` locally, or use the hosting provider's private environment settings. Never commit secrets or paste them into chat.
2. Set `NODE_ENV=production`, exact HTTPS `ALLOWED_ORIGINS`, and an absolute `CHAT_DB_PATH` on a private persistent volume, such as `/var/data/chat/events.sqlite`. The app cannot detect whether a path is backed by persistent storage: mount it and test a restart.
3. Generate **four distinct** 32-byte random hex secrets for `LOG_ENCRYPTION_KEY`, `IP_HASH_KEY`, `SESSION_SIGNING_KEY`, and `ADMIN_TOKEN`. Run this once per secret:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Store them in the host's secret manager. Preserve the encryption key separately from database backups. An encrypted sentinel validates the key on startup; changing it without migration blocks startup. For key rotation, stop writes, re-encrypt every event/audit and the sentinel in a controlled migration, then atomically replace database and key. Do not simply change the environment value.

4. For AI routing, set `AI_ENABLED=true`, a dedicated project `OPENAI_API_KEY`, and `OPENAI_MODEL` to an available model supporting Responses Structured Outputs. No model is silently selected. Set provider-level spending controls too.
5. Terminate HTTPS at a trusted reverse proxy. Restrict direct backend network access and set `TRUSTED_PROXY_IPS` to the exact IP addresses of the direct proxy peers. The proxy must overwrite `X-Forwarded-Proto` and append the real connecting client to `X-Forwarded-For`. Only the rightmost address from a trusted peer is accepted. Untrusted forwarded headers are ignored. Production refuses non-HTTPS requests except `/healthz`. Never trust arbitrary proxy addresses.
6. Use `npm start` and `/healthz` for liveness. Test an approved answer, refusal, provider outage, admin authentication, and persistence across restart before switching traffic. Keep request-body and Authorization-header capture disabled in proxy/monitoring logs.

For **Render**, use a paid **Web Service with a persistent disk**, build command `npm run check`, start command `npm start`, and disk mount `/var/data`. Verify direct proxy peer addresses before configuring trust. Disk-backed services are single-instance with deployment downtime; ordinary filesystem writes are ephemeral. [Render disk documentation](https://render.com/docs/disks).

Restrict files and keys to the service account. Use encrypted volumes/backups with separate key access. Back up SQLite through its backup API, or stop the service and copy a checkpointed database. Test restores and align backup expiry with the privacy notice. On Windows configure NTFS ACLs: POSIX chmod alone does not configure them. Patch Node within its supported release line and rerun checks after upgrades.

## AI privacy and accuracy

The provider request uses `store: false`, which does **not** promise zero provider retention. Review [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). Basic screening is not complete PII detection: an undetected name or medical detail can still reach the provider when AI is enabled. The widget and privacy page disclose this. Leave AI disabled if that transfer is unacceptable.

[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrain the result shape, not classification accuracy. A misclassified request can select only a curated reply; it cannot produce arbitrary advice. Evaluate adversarial and multilingual prompts against the actual configured model before public activation. The current deterministic tests verify boundaries and failure handling, not live model accuracy.

## Main files

- `chat/widget.js`, `chat/widget.css`: responsive widget; visitor/server text uses textContent, not HTML.
- `server/app.mjs`: API, signed sessions, origin/TLS checks, quotas, private admin endpoints, static-file allowlist.
- `server/policy.mjs`: local safety checks and optional structured AI classifier.
- `server/knowledge.mjs`: curated text, provenance, expiry, independent output gate.
- `server/store.mjs`: encrypted records, atomic quotas, and retention.
- `chat/admin.html`: review interface.
- `chat-privacy.html`: privacy disclosure; update it if retention or processing changes.
- `tests/chat.test.mjs`: security/integration tests.

Product data remains in `product-data.js`. The existing contact form opens the visitor's email app. Font licenses are in `assets/fonts/`.
