# Configuring the Consent Portal application

Complete this after installing the accelerator and starting the Identity
Server — see [`setup-guide.md`](setup-guide.md) if you haven't done that yet.
This is the last step before the portal is ready to use.

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
