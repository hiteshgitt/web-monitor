# Ruya Lab accounts (accounts.ruyalab.com)

One sign-in for every Ruya Lab product. A small OpenID Connect provider on Cloudflare Workers + D1:
email and password (verified email, reset by link), Google, and an account page. Products are clients:

| Client | Callback | Notes |
|---|---|---|
| `webmonitor` | `https://webmonitor.ruyalab.com/api/auth/ruyalab/callback` | links an existing user by verified email |
| `ruyashield` | `https://ruyashield.ruyalab.com/auth/ruyalab/callback` | then asks for RuyaShield's authenticator code |

Code flow only, PKCE S256 required, confidential clients, RS256 ID tokens, single-use 60-second codes,
exact redirect-URI match (unknown ones never redirect), Origin-checked forms, rate-limited sign-in.

## First deploy

```bash
cd accounts
npx wrangler d1 create ruyalab-accounts            # put the database_id into wrangler.jsonc
npx wrangler d1 migrations apply ruyalab-accounts --remote
node scripts/genkey.mjs | npx wrangler secret put OIDC_PRIVATE_JWK
openssl rand -hex 32 | tee /dev/stderr | npx wrangler secret put CLIENT_SECRET_WEBMONITOR   # same value → WebMonitor RUYALAB_CLIENT_SECRET
openssl rand -hex 32 | tee /dev/stderr | npx wrangler secret put CLIENT_SECRET_RUYASHIELD   # same value → RuyaShield RUYALAB_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY              # the Resend key already used for reports@ruyalab.com
npx wrangler deploy
```

Google (optional): create an OAuth web client in Google Cloud with redirect URI
`https://accounts.ruyalab.com/google/callback`, set `GOOGLE_CLIENT_ID` in `wrangler.jsonc` and
`npx wrangler secret put GOOGLE_CLIENT_SECRET`. Without it the Google button is hidden.

Turning it on in the products:
- WebMonitor worker: `npx wrangler secret put RUYALAB_CLIENT_SECRET`, then build the web app with `VITE_RUYALAB_SIGNIN=1`.
- RuyaShield: add `RUYALAB_ISSUER=https://accounts.ruyalab.com`, `RUYALAB_CLIENT_ID=ruyashield`, `RUYALAB_CLIENT_SECRET=…` to `/etc/ruyashield/env`.

## Local testing

`.dev.vars` holds a local key and test clients. `npx wrangler dev --port 8799 --local-upstream 127.0.0.1:8799`
(the upstream flag stops wrangler rewriting the Origin header to the production host), then:

```bash
node test/flow.e2e.mjs <wrangler-log>        # 20 protocol and abuse checks
node test/webmonitor.e2e.mjs <wrangler-log>  # with WebMonitor's worker on :8787
node test/ruyashield.e2e.mjs <wrangler-log>  # with RuyaShield on :3299
```

Without `RESEND_API_KEY`, verification and reset links are printed to the log instead of emailed.
