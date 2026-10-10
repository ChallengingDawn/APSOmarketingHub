# Connecting a person's Google account to the hub

The hub normally reads Google as **itself**, with a service account
(`GOOGLE_SERVICE_ACCOUNT`). That is the right way round: it belongs to nobody, it
survives people leaving, and an admin grants it once.

Search Console is the exception. `apsoparts.com` is a **domain property**, owned
by whoever verified the DNS record. The service account is not a user on it, so
every call comes back **HTTP 403** — note, not 404: the property exists and is
verified, the hub simply is not allowed in. Until an owner adds the service
account as a user, the SEO pages have no data at all.

So there is a second, deliberately temporary way in: one admin connects their own
Google account on **Settings → Integrations**, and the hub borrows their access.
`getGoogleAccessToken()` asks for a borrowed token first and falls back to the
service account, so no other code in the repo changes.

## What this costs, while it is on

- The data **everyone** sees is read with **one person's** permissions. If theirs
  change, so does everyone's view.
- That person changing their Google password revokes the token. The SEO pages
  stop, for everybody, until somebody reconnects.
- While the OAuth app is in *Testing*, Google expires the refresh token after
  **seven days** regardless. Publishing it removes that, but publishing is a
  Google review.

None of this applies to the service account, which is why the panel keeps saying
so while it is connected. The real fix is one line of work for a Search Console
owner: add the service account's e-mail as a user on the property, then
disconnect this.

## Step 1 — create the OAuth client (only a human can do this)

Google Cloud Console, in the **same project as the service account**:

1. **APIs & Services → OAuth consent screen**. If it has never been configured:
   User type **Internal** if the project is on the Angst+Pfister Workspace —
   internal apps skip Google's review *and* the seven-day token expiry. If
   Internal is not offered, choose External and leave it in Testing; then the
   seven-day expiry applies.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `APSOmarketingHub`
   - **Authorised redirect URIs** → Add URI, exactly this, no trailing slash:

     ```
     https://apsomarketinghub-dev.awssandbox.angst-pfister.com/api/integrations/google/callback
     ```

     It must match character for character or Google refuses with
     `redirect_uri_mismatch` before anyone sees a consent screen. Add a second
     URI for every other hostname the hub is reached on (a future
     `apsomarketinghub.com`, or `http://localhost:3000/...` for local work).
3. **APIs & Services → Enabled APIs** → make sure **Google Search Console API**
   is enabled in this project.
4. Copy the **Client ID** and **Client secret**. The secret is shown once.

## Step 2 — put them in Secrets Manager (one secret per variable, bare names)

```bash
aws secretsmanager create-secret --profile apso-dev \
  --name apso-dev/GOOGLE_OAUTH_CLIENT_ID     --secret-string '<client id>'
aws secretsmanager create-secret --profile apso-dev \
  --name apso-dev/GOOGLE_OAUTH_CLIENT_SECRET --secret-string '<client secret>'
```

## Step 3 — a new task-definition revision, then deploy

The container only sees a secret that is listed in the task definition's
`secrets` array, so adding the secrets is not enough — the revision has to name
them. Take the live revision, append the two entries, register it, point the
service at it:

```bash
aws ecs describe-task-definition --profile apso-dev \
  --task-definition apso-dev-apsomarketinghub \
  --query taskDefinition > td.json
# append to .containerDefinitions[0].secrets:
#   {"name":"GOOGLE_OAUTH_CLIENT_ID",
#    "valueFrom":"arn:aws:secretsmanager:eu-central-1:905418292914:secret:apso-dev/GOOGLE_OAUTH_CLIENT_ID"},
#   {"name":"GOOGLE_OAUTH_CLIENT_SECRET",
#    "valueFrom":"arn:aws:secretsmanager:eu-central-1:905418292914:secret:apso-dev/GOOGLE_OAUTH_CLIENT_SECRET"}
# and drop the read-only keys: taskDefinitionArn, revision, status,
# requiresAttributes, compatibilities, registeredAt, registeredBy
aws ecs register-task-definition --profile apso-dev --cli-input-json file://td.json
aws ecs update-service --profile apso-dev --cluster apso-dev \
  --service apso-dev-apsomarketinghub --task-definition apso-dev-apsomarketinghub:<new>
```

Only an env change needs `--task-definition`. A plain code deploy is
`--force-new-deployment` on its own.

## Step 4 — connect

**Settings → Integrations → Connect a Google account instead → Connect my Google
account**. Admins only: whoever presses it is lending their Google permissions to
everyone who opens the hub, which is not a thing a viewer should be able to set
in motion.

Until the secrets exist the panel says so rather than sending anyone to a broken
consent screen, and `/api/integrations/google/connect` returns a 400 explaining
which variable is missing.

## Checking it is really live

The tag is not what runs — tasks pull `:prod` when each one **starts**, so a
healthy task can be serving an older image than the one in ECR. The only proof
is the digest on the running task:

```bash
aws ecs describe-tasks --profile apso-dev --cluster apso-dev \
  --tasks $(aws ecs list-tasks --profile apso-dev --cluster apso-dev \
    --service-name apso-dev-apsomarketinghub --query 'taskArns[0]' --output text) \
  --query 'tasks[0].containers[0].imageDigest'
```
