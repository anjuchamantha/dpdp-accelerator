# @wso2-dpdp/cookie-consent (preview)

Cookie banner, script blocking and consent recording for a website whose backend runs Node.js
and Express. Choices are stored as DPDP consents in WSO2 Identity Server, so they appear in the
DPDP consent portal, keep their history, expire and raise Event Notifications like any other
consent. The banner is [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) 3.1.0
(MIT), an exact-version dependency that your backend serves at `/cookie-consent/vendor/*`, so
visitors' browsers never fetch it from a third-party CDN.

## How it works

The browser talks only to your backend. Your backend calls IS Consent Management v2.0 with your
site's own M2M application. Each cookie category is an IS Purpose of type `Cookie`, each cookie an
Element named after the browser cookie. One consent is kept per category per person: `ACTIVE` when
accepted, `REJECTED` or `REVOKED` when declined. A first-party HttpOnly cookie, `dpdp_cc`, holds an
encrypted visitor ID. When the visitor logs in, `linkOnLogin` copies their choices onto their user (property
`linkedFrom` names the visitor consent) and revokes the visitor's accepted consents.

## Set up Identity Server

1. Create one Element per cookie (name = cookie name, e.g. `_ga`) and one Purpose per category
   with **type `Cookie`** (e.g. `cookie_analytics`) listing those Elements.
2. Create an M2M application for the site and authorize it for:
   - Consent Management V2 Purposes API: `internal_consent_mgt_purpose_view`
   - Consent Management V2 Consents API: `internal_consent_mgt_consent_create`,
     `internal_consent_mgt_consent_view`, `internal_consent_mgt_consent_update`

These consent scopes are tenant-wide: keep the M2M credentials on the server only.

## Use it

```js
const { createCookieConsent } = require('@wso2-dpdp/cookie-consent');

const cookieConsent = createCookieConsent({
  isBaseUrl: 'https://is.example.com',
  clientId: process.env.COOKIE_CONSENT_CLIENT_ID,
  clientSecret: process.env.COOKIE_CONSENT_CLIENT_SECRET,
  serviceId: process.env.COOKIE_CONSENT_CLIENT_ID,
  siteName: 'Example Insurance',
  cookieSecret: process.env.COOKIE_CONSENT_SECRET, // 32+ characters, keep it stable
  categories: [
    { key: 'analytics', purposeName: 'cookie_analytics', title: 'Analytics cookies' },
    { key: 'marketing', purposeName: 'cookie_marketing', title: 'Marketing cookies' },
  ],
  getUsername: (req) => req.session?.username ?? null, // the IS username of the logged-in user
});

app.use('/cookie-consent', cookieConsent.router());

// In your OIDC callback, after the session is created:
await cookieConsent.linkOnLogin(req, res, username);
```

On every page:

```html
<script src="/cookie-consent/loader.js" defer></script>
<script type="text/plain" data-category="analytics" data-src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<a href="#" data-cc="show-preferencesModal">Cookie preferences</a>
```

To reopen the preferences, use a link with `data-cc="show-preferencesModal"` (above), a floating
button, or both. For the button, add `data-floating-button="bottom-right"` (or `"bottom-left"`) to
the loader's script tag. It shows once a choice exists and uses the banner's theme colours
(`--cc-btn-primary-bg`, `--cc-btn-primary-color`).

Optional settings: `secureCookies` (default `true`), `expiryDays` (365), `texts` (see
`src/defaultTexts.js`), `fetch`, `onApiCall`, `onError`, `subjectQuery` (`'userId'` or
`'property'`, see `scripts/verify-is-api.mjs`).

## Behaviour to know

- If the backend or IS is unreachable, no banner is shown and optional scripts stay blocked.
- A new Purpose version shows the banner again.
- After logout the browser keeps applying the user's choices; a change made while logged out is
  saved for the browser only and merged at the next login (most recent choice wins).
- A revocation in the consent portal takes effect on the next page load.
- A choice that could not be saved is kept in the browser and sent again on the next page load; until then the browser applies it.

## Develop

```sh
npm install
npm test
npm run verify:is   # live IS check, see scripts/verify-is-api.mjs
npm pack            # wso2-dpdp-cookie-consent-<version>.tgz
```

After re-packing, reinstall the tarball in any app that depends on it (`npm install ./vendor/<tarball>`), because the app's lockfile pins the tarball's checksum.
