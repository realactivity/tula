# Tula tenant-template build pipeline

This directory holds the three artifacts that turn a Tula development VM
into a per-tenant golden image and provision new tenants from it.

| File | Purpose | Runs on |
|---|---|---|
| `deprovision.sh` | Scrubs a source VM for image capture | The source VM (the one being baked) |
| `tula-provision.sh` | Spawns a new tenant from a captured image | The operator's laptop / control-plane VM |
| `cloud-init-template.yaml` | First-boot configuration for each new tenant | Auto-injected; never run manually |

Full specification: [`~/.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md`](../../../.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md)

## Quick start (operator)

```bash
# One-time: prepare ops home
mkdir -p ~/tula-ops/{tenants,secrets}
chmod 700 ~/tula-ops ~/tula-ops/secrets
echo -n 'sk-ant-xxxx' > ~/tula-ops/secrets/anthropic-api-key && chmod 600 ~/tula-ops/secrets/anthropic-api-key
echo -n 'ghp_xxxx'    > ~/tula-ops/secrets/github-pat-tenant-write && chmod 600 ~/tula-ops/secrets/github-pat-tenant-write

# Add a few Telegram bot tokens to the pool (one per row)
cat <<EOF >> ~/tula-ops/bot-token-pool.txt
# pool_name      bot_token              bot_username      status
tula_aux_001    1234567890:AAH...       TulaAux001Bot     available
tula_aux_002    0987654321:AAH...       TulaAux002Bot     available
EOF
chmod 600 ~/tula-ops/bot-token-pool.txt

# Bake the image (one-time, ~30 min)
ssh azureuser@ra-bake-vm 'sudo ~/tula/scripts/tenant-template/deprovision.sh --version 0.1.0 --confirm'
ssh azureuser@ra-bake-vm 'sudo waagent -deprovision+user -force'
az vm deallocate -g ra-healthcareagents-rg -n ra-bake-vm
az vm generalize -g ra-healthcareagents-rg -n ra-bake-vm
az image create  -g ra-healthcareagents-rg -n tula-tenant-template-0-1-0 --source ra-bake-vm

# Provision a tenant (per tenant, ~5 min)
~/tula/scripts/tenant-template/tula-provision.sh new-tenant "Jane Doe" "jane@example.com"
```

## Subcommands

- `tula-provision new-tenant <name> <email>` - full provision
- `tula-provision list` - list tenants
- `tula-provision show <tenant-id>` - show one tenant's record
- `tula-provision health <tenant-id>` - health check
- `tula-provision rollback <tenant-id>` - clean teardown (idempotent)
- `tula-provision decommission <tenant-id>` - 30-day-grace offboarding

## Safety

- `deprovision.sh` refuses to run on hosts named `tula-tenant-*` (prevents
  nuking a live tenant)
- `deprovision.sh` requires `--confirm`; supports `--dry-run`
- `tula-provision.sh` rolls back automatically on any failure during
  provisioning (deletes Azure RG, deletes GitHub repo, returns bot
  token to pool)
- All operator secrets live in `~/tula-ops/secrets/` with 0600 perms
- Tenant secrets live in `/etc/tula-tenant-secrets.env` on the tenant
  VM with 0600 perms, owned by `azureuser`
- No tenant content ever crosses any operator boundary (operator can
  break-glass via SSH, but the operation is logged)

## v0.1 known gaps (to harden in v0.2)

- GitHub PAT per tenant is currently shared across tenants via
  `~/tula-ops/secrets/github-pat-tenant-write`. Should be per-tenant
  fine-grained PAT or GitHub App installation. Tracked in
  [`TENANT_TEMPLATE_BUILD.md`](../../../.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md) § 6.5.
- Data disk is currently combined with OS disk. v0.2 separates them so
  image updates don't require workspace data migration.
- No control plane yet; tenant heartbeat to a central observability
  endpoint is wired but disabled. Enable when control plane lands.
- No automated image-update workflow for existing tenants; updates are
  manual per tenant in v0.1.

## License

Apache-2.0 (inherited from the Tula repository).
