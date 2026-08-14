# Configuring the Consent Portal application

Complete this after installing the accelerator and starting the Identity
Server — see [`setup-guide.md`](setup-guide.md) if you haven't done that yet.
This is the last step before the portal is ready to use.

The steps below configure the portal for the super tenant. To serve other
tenants at `/t/<tenant>/consent-portal/`, additionally follow
[Multi-tenant deployment](#multi-tenant-deployment) — the same steps repeated
inside each tenant, with the credentials stored through an API instead of the
properties file.

## 1. Register & configure the OAuth application

In the Console (`https://<host>:9443/console`):

1. **Applications → New Application → Standard-Based Application**.
2. Name: `DPDP Consent Portal`. Protocol: **OpenID Connect**.
3. Open the new application's **Protocol** tab and enable only the **Code** and
   **Refresh Token** grant types.
4. Set Authorized redirect URL: `https://<host>:9443/consent-portal/auth/callback`
5. On the same tab, under **Access Token**, set **Type** to **JWT**. → Click **Update**.
6. Note the **Client ID** and **Client Secret** on the same tab — you'll need
   them in step 5.
7. Go to the **Roles** tab → set the **Role Audience** as `Organization`. → Click **Update**.
8. Go to the **Advanced** tab → enable **Skip login consent** and **Skip logout
   consent**. → Click **Update**.
9. Go to the **User Attributes** tab → Search & add `http://wso2.org/claims/username` as a
mandatory requested claim → Enable **Assign alternate subject identifier** → 
Select **username** as Subject Attribute → Click **Update**.
   
10. Go to the **Authorization** tab, authorize all three resources below,
selecting **all scopes** for each and policy **RBAC**:
    - Consent Management V2 Consents API
    - Consent Management V2 Purposes API
    - Consent Management V2 Elements API

## 2. Create the required user roles for the consent-portal

In **User Management → Roles → New Role**, create two organization-wide
roles (Select the role audience: **Organization**):

1. `dpdp-consent-admin` role
   - Add all scopes from the following API resources:
     - Consent Management V2 Consents API
     - Consent Management V2 Purposes API
     - Consent Management V2 Elements API
2. `dpdp-consent-user` role
   -  No permissions assigned yet.

Assign users to `dpdp-consent-admin` role to grant them portal administration access.

## 3. Add the client credentials to the portal configuration

Edit `<IS_HOME>/repository/conf/dpdp-portal.properties`:

```properties
oauth.client.id=<Client ID>
oauth.client.secret=<Client Secret>
```

## 4. Restart

Restart the Identity Server, then open `https://<host>:9443/consent-portal/`.

## Multi-tenant deployment

The portal serves every tenant from the same deployment, at
`https://<host>:9443/t/<tenant>/consent-portal/` — enabled by the
`[tenant_context.rewrite] custom_webapps` entry the accelerator ships in
`deployment.toml`. Consents, catalog data, roles and sessions are all
partitioned per tenant by the Identity Server.

Each tenant that uses the portal needs its own application registration and
credentials. For each tenant (created under **Tenants** in the super-tenant
Console):

1. **Register the OAuth application** in that tenant's Console
   (`https://<host>:9443/t/<tenant>/console`), following the same steps as
   [step 1](#1-register--configure-the-oauth-application) with one
   difference — the Authorized redirect URL is tenant-qualified:

   ```
   https://<host>:9443/t/<tenant>/consent-portal/auth/callback
   ```

2. **Create the two roles** in that tenant's Console, exactly as in
   [step 2](#2-create-the-required-user-roles-for-the-consent-portal).

3. **Store the client credentials** through the tenant's Configuration
   Management API (as a tenant administrator):

   ```sh
   curl -k -u <tenant-admin>@<tenant> -X POST \
     'https://<host>:9443/t/<tenant>/api/identity/config-mgt/v1.0/resource/dpdp-portal' \
     -H 'Content-Type: application/json' \
     -d '{
       "name": "oauth-app",
       "attributes": [
         { "key": "client_id", "value": "<Client ID>" },
         { "key": "client_secret", "value": "<Client Secret>" }
       ]
     }'
   ```

   To rotate credentials later, repeat the call with `-X PUT`. The store is
   tenant-partitioned: a tenant can only ever read or write its own entry.

No restart is needed — the portal picks up new or changed credentials within
two minutes. Open `https://<host>:9443/t/<tenant>/consent-portal/` and sign in
as a user of that tenant.

> **Note** — the super tenant can use the same mechanism instead of
> `dpdp-portal.properties`: call the API without the `/t/<tenant>` prefix as
> the super-tenant administrator. When both exist, the Configuration
> Management entry wins; the properties file remains as the fallback so
> existing installs keep working.
