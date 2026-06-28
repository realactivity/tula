# Deploying Wren to Azure Container Apps

A runbook for running the single-tenant Wren records relay on Azure Container
Apps, served at your own domain and registered with Epic on Lane 2 (refresh
tokens + per-organization RSA JWKS activation).

This is a single-patient, self-hosted deployment. The multi-tenant,
hospital-scale relay is out of scope (see [`../../../OPEN_CORE.md`](../../../OPEN_CORE.md)).

> **Placeholders.** Values in `{{DOUBLE_BRACES}}` are environment-specific.
> Substitute your own. For the RealActivity reference deployment, the concrete
> values live in an untracked `deployment-azure.local.md` beside this file (it
> is gitignored; never commit operator-specific identifiers to the public repo).

## Target environment

| Setting | Value |
|---|---|
| Subscription | `{{SUBSCRIPTION_ID}}` |
| Region | `{{REGION}}` (example: `eastus2`) |
| Resource group | `{{RESOURCE_GROUP}}` (example: `wren-rg`) |
| Container registry | `{{ACR_NAME}}` (Basic; can be an existing registry in the same sub + region) |
| Container Apps env | `{{ENV_NAME}}` (example: `wren-cae`) |
| Container app | `wren` |
| JWKS share | `{{STORAGE_ACCOUNT}}` / `{{FILE_SHARE}}` (RG `{{STORAGE_RG}}`), subfolder `wren/`, mounted at `/mnt/wren` |
| Public hostname | `{{WREN_DOMAIN}}` (DNS at your registrar) |

## Key facts that shaped this design

- Wren is a Bun app (`bun:sqlite`, `Bun.serve`); it must run as a container.
- The JWKS must stay stable for the life of the Epic registration. It lives on
  the Azure Files share, not in the image. The private keys are non-sensitive
  by design (they ship to browsers).
- RSA only: `scripts/generate-jwks.ts` emits RS256 + RS384 (no EC). Epic rejects
  EC/ES384 at per-org activation. The browser signs with `keys[0]` (RS256).
- `offline_access` is always requested by the client
  ([`src/client/lib/smart/oauth.ts`](../src/client/lib/smart/oauth.ts)), so this
  is Lane 2: each hospital you use needs direct RSA JWKS activation in the Epic
  portal.
- Do not scale to zero. An OAuth relay loses in-flight sessions while the
  patient is logging in on Epic's domain. Run min = max = 1.

## Prerequisites

- Azure CLI logged in with access to subscription `{{SUBSCRIPTION_ID}}`.
- DNS control for your domain at your registrar.
- A free Epic on FHIR account at <https://fhir.epic.com>.
- Bicep (bundled with `az`). The `containerapp` CLI extension is not required;
  the whole deploy goes through `az deployment group create` against
  [`../azure/wren.bicep`](../azure/wren.bicep). This also sidesteps a known
  `containerapp` extension install failure on some Windows hosts (pip crash
  `0xC0000005`).

### Windows gotchas (handled in-repo, noted for reproducibility)

- `az acr build` streams remote logs through the local console. Any non-ASCII
  byte in build output crashes it (cp1252). The build scripts are ASCII-only;
  also run with `chcp 65001` + `PYTHONUTF8=1` for safety.
- Do not pipe the build log into the build-context directory (self-reference
  -> "unexpected end of data"). Write the log outside the context.
- `docker-entrypoint.sh` must use LF endings. `.gitattributes` enforces it and
  the Dockerfile runs `sed -i 's/\r$//'` as a belt-and-braces fix.

## 1. Resource group + pull identity

A user-assigned identity lets the app pull from an admin-disabled registry with
no stored credentials.

```bash
SUB={{SUBSCRIPTION_ID}}
RG={{RESOURCE_GROUP}}
LOC={{REGION}}
ACR={{ACR_NAME}}            # registry login name (without .azurecr.io)

az account set --subscription "$SUB"
az group create -n "$RG" -l "$LOC"

az identity create -g "$RG" -n wren-acr-pull -l "$LOC"
PRINCIPAL=$(az identity show -g "$RG" -n wren-acr-pull --query principalId -o tsv)
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" \
  --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"
```

## 2. Build and push the image

Run from `services/wren/` (the build context must include `config.prod.json`).

```bash
az acr build -r "$ACR" -t wren:latest .
```

## 3. Deploy env + storage mount + app (Bicep)

The template creates Log Analytics, the managed environment, the Azure Files
storage link (`wrenkeys`), and the container app (min = max = 1, HTTPS-only,
`/mnt/wren` mount, `/health` probes). Bump `revisionSuffix` to force a re-pull
of `:latest` on redeploys.

```bash
UAMI=$(az identity show -g "$RG" -n wren-acr-pull --query id -o tsv)
KEY=$(az storage account keys list -g {{STORAGE_RG}} -n {{STORAGE_ACCOUNT}} \
  --query "[0].value" -o tsv)

az deployment group create -g "$RG" -n wren-deploy \
  --template-file azure/wren.bicep \
  --parameters \
    acrLoginServer=$ACR.azurecr.io \
    image=$ACR.azurecr.io/wren:latest \
    uamiResourceId="$UAMI" \
    storageAccountName={{STORAGE_ACCOUNT}} \
    storageAccountKey="$KEY" \
    fileShareName={{FILE_SHARE}} \
    revisionSuffix=v1
```

The deployment outputs `fqdn` (the default
`{{APP_FQDN}}.azurecontainerapps.io`) and `customDomainVerificationId`. Save
both; you need them for DNS.

## 4. Custom domain and managed certificate

1. At your DNS provider add:
   - `CNAME  wren  ->  {{APP_FQDN}}.azurecontainerapps.io`
   - `TXT    asuid.wren  ->  {{DOMAIN_VERIFICATION_ID}}`
2. Once both records resolve, redeploy with the `customDomain` parameter. Bicep
   provisions the free managed cert (CNAME validation) and binds it:

```bash
az deployment group create -g "$RG" -n wren-domain \
  --template-file azure/wren.bicep \
  --parameters \
    acrLoginServer=$ACR.azurecr.io \
    image=$ACR.azurecr.io/wren:latest \
    uamiResourceId="$UAMI" \
    storageAccountName={{STORAGE_ACCOUNT}} \
    storageAccountKey="$KEY" \
    fileShareName={{FILE_SHARE}} \
    revisionSuffix=v1 \
    customDomain={{WREN_DOMAIN}}
```

## 5. Epic registration (Lane 2)

Follow [`epic-registration.md`](epic-registration.md). Summary:

- App type Patients, FHIR R4, USCDI read APIs, scopes `patient/*.rs` + `offline_access`.
- Redirect URI (exact, lowercase): `https://{{WREN_DOMAIN}}/connect/callback`.
- Register the app-level public JWKS (RSA only) from
  `https://{{WREN_DOMAIN}}/.well-known/jwks.json`.
- Sandbox test with the Non-Prod Client ID and `fhircamila` / `epicepic1`.
- Mark production-ready, then in "Review & Manage Downloads" activate each
  hospital you use with DIRECT RSA JWKS upload (not JWK Set URL), for both
  Non-Prod and Prod. A handful of orgs is a few clicks each.
- Put the Non-Prod and Prod client IDs into `config.prod.json`, rebuild (step 2),
  then redeploy with a bumped `revisionSuffix` (step 3) so the running app uses
  them.

## 6. Wire the Tula agent

On the agent VM, point the `health-records` skill at this relay:

```bash
BASE_URL=https://{{WREN_DOMAIN}} ./scripts/set-openclaw-health-skillz-env.sh
```

## 7. Verify

Against the default FQDN before DNS, or `{{WREN_DOMAIN}}` after:

```bash
curl -sS https://{{WREN_DOMAIN}}/health                       # ok
curl -sS https://{{WREN_DOMAIN}}/api/vendors                  # brand entries
curl -sS https://{{WREN_DOMAIN}}/.well-known/jwks.json        # RSA keys only
```

Then run the full sandbox round trip through the agent (connect, log in,
consent, fetch, decrypt).

## JWKS backup (do this once keys exist)

Losing the keyset forces re-registering every Epic org. After first start,
snapshot the share or copy `wren/jwks*.json` into a Key Vault secret as a
backup.

## Rollback / teardown

```bash
az group delete -n {{RESOURCE_GROUP}} --yes --no-wait
```

This removes the app, env, Log Analytics, and the `wren-acr-pull` identity. It
does not touch a shared/reused registry or the storage account. Delete the
`wren/` subfolder on the share manually and remove the `wren:latest` repo from
the registry if you want a full cleanup.
