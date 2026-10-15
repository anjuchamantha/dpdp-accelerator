# Cookie consent SDK contract

What every cookie consent SDK must do, whatever its language, so that the shared browser loader
(`../browser`) works with it and so that consents written by any SDK look the same in Identity
Server. The Node SDK (`../node`) is the reference implementation.

## Browser API

The site mounts the SDK under one base path, `/cookie-consent` in the examples. The loader finds
the base path from its own script URL, so any path works. All responses carry
`Cache-Control: no-store` unless stated.

### `GET /state`

The visitor's current state. `200` with:

```json
{
  "revision": 1234567,
  "hasDecision": true,
  "categories": { "analytics": true, "marketing": false },
  "config": {
    "texts": { "bannerTitle": "…", "…": "…" },
    "categories": [
      {
        "key": "analytics",
        "title": "Analytics cookies",
        "description": "…",
        "cookies": [{ "name": "_ga", "description": "…" }]
      }
    ]
  }
}
```

- `revision`: a non-negative 31-bit integer that changes whenever any category's Purpose gets a
  new version. The banner library requires a number.
- `hasDecision`: `true` only when every configured category has a decision.
- `categories`: one boolean per category that has a decision; undecided categories are left out.
- `config.texts`: the twelve strings the loader reads, listed in `../node/src/defaultTexts.js`.
- `config.categories`: in display order. `cookies` are the Purpose's Elements.

`502` with `{"error": "…"}` when Identity Server cannot be reached. The loader then shows no
banner and keeps optional scripts blocked.

### `POST /decision`

Body, at most 4 KB:

```json
{ "revision": 1234567, "categories": { "analytics": true, "marketing": false } }
```

| Status | When | Body |
|---|---|---|
| `200` | Saved | The new state, same shape as `GET /state` |
| `400` | `revision` is not an integer, or `categories` is not an object of booleans | `{"error": "…"}` |
| `409` | `revision` is not the current one | `{"error": "…"}`; the loader drops the choice and reloads |
| `502` | Identity Server failed | `{"error": "…"}`; the loader keeps the choice and sends it again on the next page load |

Keys that are not configured categories are ignored. A category left out is not changed.

### `GET /loader.js`

`../browser/loader-core.js` followed by `../browser/loader.js`, joined with a newline, as
`application/javascript` with `Cache-Control: no-cache`.

### `GET /vendor/cookieconsent.umd.js`, `GET /vendor/cookieconsent.css`

The same files from vanilla-cookieconsent **3.1.0** (`dist/`), cacheable for a day. The loader
reads the library's own preferences cookie, whose format is specific to this version, so every
SDK pins exactly 3.1.0.

## Visitor cookie

`dpdp_cc`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` unless the site turns it off, lifetime
equal to the consent expiry (365 days by default). Its value is opaque to the browser: it must not
reveal the subject and must not be forgeable. A visitor's subject is `v-` followed by a random
UUID; after login it is the IS username. The value only needs to be readable by the SDK that wrote
it.

## Consents in Identity Server

One consent per category per subject, created through Consent Management v2.0 with:

- `subjectId`: the subject; `serviceId`: the site's M2M client ID; `language`: `en`.
- `purposes`: the category's Purpose (latest version) with all its Elements.
- `state`: `ACTIVE` when accepted, `REJECTED` when declined and undecided before.
- `expiryTime`: now plus the configured expiry, in epoch milliseconds.
- `properties`: `consentType` = `cookie`, `category` = the category key, `siteName`, `subjectRef` =
  the subject, and on a copy made at login `linkedFrom` = the visitor consent's ID.

Declining an accepted category revokes every `ACTIVE` consent of that category. The rules for
reading the current decision, saving a change and linking at login are in
`../node/src/consentState.js` and `../node/src/cookieConsentService.js`; the calls they make are
listed in the Node README ("Calls to Identity Server").

## Checking Identity Server

`verify-is-api.mjs` checks, against a live IS, the consent-mgt v2 behaviour every SDK relies on
(results of the last run in `verify-is-api-results.md`). It needs Node.js 20+ and no install. From
`sdks/cookie-consent`:

```sh
IS_BASE_URL=https://localhost:9443 COOKIE_CONSENT_CLIENT_ID=… COOKIE_CONSENT_CLIENT_SECRET=… \
  NODE_TLS_REJECT_UNAUTHORIZED=0 node spec/verify-is-api.mjs
```
