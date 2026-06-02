#!/usr/bin/env bash
#
# tula-provision.sh — provision a Tula tenant from a baked managed image.
#
# Runs on the operator's laptop (or a control-plane VM). Requires:
#   - az CLI authenticated to the subscription
#   - gh CLI authenticated to the realactivity org with repo:create permission
#   - jq, openssl, xxd
#   - a bot-token-pool file at $TULA_OPS_HOME/bot-token-pool.txt
#   - a tenants directory at $TULA_OPS_HOME/tenants/
#   - operator SSH pubkey at $OPERATOR_SSH_PUBKEY
#
# Subcommands:
#   new-tenant <name> <email>      Provision a new tenant end-to-end.
#   list                            List all tenants.
#   show <tenant-id>                Show one tenant's record.
#   health <tenant-id>              Run health checks against a live tenant.
#   rollback <tenant-id>            Tear down a tenant (Azure, GitHub, bot pool).
#   decommission <tenant-id>        Begin tenant offboarding (30-day grace).
#
# License: Apache-2.0 (inherited from the Tula repository).
#
# See companion spec: ~/.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md
#

set -euo pipefail

# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

TULA_OPS_HOME="${TULA_OPS_HOME:-$HOME/tula-ops}"
TENANTS_DIR="$TULA_OPS_HOME/tenants"
BOT_POOL_FILE="$TULA_OPS_HOME/bot-token-pool.txt"
SECRETS_DIR="$TULA_OPS_HOME/secrets"

AZURE_LOCATION="${AZURE_LOCATION:-eastus2}"
AZURE_VNET="${AZURE_VNET:-tula-tenants-vnet}"
AZURE_SUBNET="${AZURE_SUBNET:-tula-tenants-subnet}"
AZURE_VM_SIZE="${AZURE_VM_SIZE:-Standard_B2s}"
AZURE_OS_DISK_SIZE_GB="${AZURE_OS_DISK_SIZE_GB:-64}"
AZURE_OS_DISK_SKU="${AZURE_OS_DISK_SKU:-StandardSSD_LRS}"
DEFAULT_IMAGE="${DEFAULT_IMAGE:-tula-tenant-template-0-1-0}"
IMAGE_RESOURCE_GROUP="${IMAGE_RESOURCE_GROUP:-ra-healthcareagents-rg}"

GH_ORG="${GH_ORG:-realactivity}"

OPERATOR_SSH_PUBKEY="${OPERATOR_SSH_PUBKEY:-$HOME/.ssh/id_ed25519.pub}"

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# -------------------------------------------------------------------------
# Logging helpers
# -------------------------------------------------------------------------

color() {
    if [[ -t 1 ]]; then
        case "$1" in
            red)    printf '\033[31m%s\033[0m' "$2" ;;
            green)  printf '\033[32m%s\033[0m' "$2" ;;
            yellow) printf '\033[33m%s\033[0m' "$2" ;;
            blue)   printf '\033[34m%s\033[0m' "$2" ;;
            *) printf '%s' "$2" ;;
        esac
    else
        printf '%s' "$2"
    fi
}

info() { echo "$(color blue '[INFO]') $*"; }
ok()   { echo "$(color green '[OK]') $*"; }
warn() { echo "$(color yellow '[WARN]') $*"; }
err()  { echo "$(color red '[ERR]') $*" >&2; }

# -------------------------------------------------------------------------
# Pre-flight
# -------------------------------------------------------------------------

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        err "missing required command: $1"
        exit 1
    fi
}

preflight() {
    require_cmd az
    require_cmd gh
    require_cmd jq
    require_cmd openssl
    require_cmd xxd

    if [[ ! -d "$TULA_OPS_HOME" ]]; then
        warn "ops home $TULA_OPS_HOME does not exist; creating"
        mkdir -p "$TENANTS_DIR" "$SECRETS_DIR"
        chmod 700 "$TULA_OPS_HOME" "$SECRETS_DIR"
    fi

    if [[ ! -f "$BOT_POOL_FILE" ]]; then
        warn "bot pool file $BOT_POOL_FILE does not exist; creating empty"
        touch "$BOT_POOL_FILE"
        chmod 600 "$BOT_POOL_FILE"
    fi

    if [[ ! -f "$OPERATOR_SSH_PUBKEY" ]]; then
        err "operator SSH pubkey not found at $OPERATOR_SSH_PUBKEY"
        err "set OPERATOR_SSH_PUBKEY env var to your public key path"
        exit 1
    fi

    if ! az account show >/dev/null 2>&1; then
        err "not logged in to az CLI. Run: az login"
        exit 1
    fi

    if ! gh auth status >/dev/null 2>&1; then
        err "not logged in to gh CLI. Run: gh auth login"
        exit 1
    fi
}

# -------------------------------------------------------------------------
# Tenant-id helpers
# -------------------------------------------------------------------------

new_tenant_id() {
    # 12-hex random; collision-resistant for >10^6 tenants
    xxd -l 6 -p /dev/urandom
}

is_valid_tenant_id() {
    [[ "$1" =~ ^[a-f0-9]{12}$ ]]
}

tenant_record_path() {
    echo "$TENANTS_DIR/$1.json"
}

# -------------------------------------------------------------------------
# Bot-token pool helpers (with file lock for concurrent ops)
# -------------------------------------------------------------------------

claim_bot_token() {
    local tenant_id="$1"
    local lock_file="$BOT_POOL_FILE.lock"
    exec 200>"$lock_file"
    if ! flock -x -w 10 200; then
        err "failed to acquire bot pool lock"
        exit 1
    fi
    # Find the first available bot
    local line claimed
    while IFS=$' \t' read -r pool_name bot_token bot_username status; do
        [[ "$pool_name" =~ ^# ]] && continue
        [[ -z "$pool_name" ]] && continue
        if [[ "$status" == "available" ]]; then
            claimed="$pool_name $bot_token $bot_username"
            # Update the line: mark as claimed
            sed -i "s|^$pool_name $bot_token $bot_username available|$pool_name $bot_token $bot_username claimed-by-$tenant_id|" "$BOT_POOL_FILE"
            break
        fi
    done < "$BOT_POOL_FILE"
    flock -u 200
    rm -f "$lock_file"
    if [[ -z "${claimed:-}" ]]; then
        err "no available bot tokens in pool. Create more bots via @BotFather and add to $BOT_POOL_FILE"
        exit 1
    fi
    echo "$claimed"
}

release_bot_token() {
    local tenant_id="$1"
    local lock_file="$BOT_POOL_FILE.lock"
    exec 200>"$lock_file"
    flock -x -w 10 200 || true
    sed -i "s|claimed-by-$tenant_id\$|available|" "$BOT_POOL_FILE"
    flock -u 200
    rm -f "$lock_file"
}

# -------------------------------------------------------------------------
# Secret helpers
# -------------------------------------------------------------------------

load_secret() {
    local name="$1"
    local f="$SECRETS_DIR/$name"
    if [[ ! -f "$f" ]]; then
        err "missing secret: $f"
        err "create with: echo -n 'value' > $f; chmod 600 $f"
        exit 1
    fi
    cat "$f"
}

# -------------------------------------------------------------------------
# Subcommand: new-tenant
# -------------------------------------------------------------------------

cmd_new_tenant() {
    local tenant_name="${1:-}"
    local tenant_email="${2:-}"
    local image="${3:-$DEFAULT_IMAGE}"

    if [[ -z "$tenant_name" || -z "$tenant_email" ]]; then
        err "usage: tula-provision new-tenant <display-name> <email> [image-name]"
        exit 2
    fi

    preflight
    info "=== Provisioning new tenant ==="
    info "  display name: $tenant_name"
    info "  email:        $tenant_email"
    info "  image:        $image"
    echo

    # Step 1 — Generate tenant-id
    local tenant_id
    tenant_id=$(new_tenant_id)
    info "Step 1: tenant-id = $tenant_id"

    # Resource names
    local rg="tula-tenant-$tenant_id"
    local vm="tula-tenant-$tenant_id"
    local backup_repo="$GH_ORG/tula-vm-state-$tenant_id"

    # Pre-create tenant record so we can roll back even on early failure
    local tenant_record
    tenant_record="$(tenant_record_path "$tenant_id")"
    cat > "$tenant_record" <<EOF
{
  "tenant_id": "$tenant_id",
  "display_name": "$tenant_name",
  "email_hash": "$(echo -n "$tenant_email" | sha256sum | awk '{print $1}')",
  "image": "$image",
  "azure": {
    "subscription_id": "$(az account show --query id -o tsv)",
    "resource_group": "$rg",
    "vm_name": "$vm",
    "location": "$AZURE_LOCATION"
  },
  "github": {
    "backup_repo": "$backup_repo"
  },
  "telegram": {
    "bot_pool_name": null,
    "bot_username": null
  },
  "status": "provisioning",
  "provisioned_at": "$TIMESTAMP"
}
EOF
    chmod 600 "$tenant_record"

    # Cleanup trap — runs if any step fails
    local rollback_needed=1
    cleanup() {
        if [[ "$rollback_needed" -eq 1 ]]; then
            err "FAILED during provision; rolling back..."
            cmd_rollback "$tenant_id" || true
        fi
    }
    trap cleanup EXIT

    # Step 2 — Claim bot token
    info "Step 2: claiming bot token from pool"
    local bot_info pool_name bot_token bot_username
    bot_info=$(claim_bot_token "$tenant_id")
    read -r pool_name bot_token bot_username <<< "$bot_info"
    ok "  claimed: $bot_username (pool name: $pool_name)"

    # Update tenant record with bot info
    jq --arg pn "$pool_name" --arg bu "$bot_username" \
        '.telegram.bot_pool_name = $pn | .telegram.bot_username = $bu' \
        "$tenant_record" > "$tenant_record.tmp"
    mv "$tenant_record.tmp" "$tenant_record"

    # Step 3 — Create resource group
    info "Step 3: creating Azure resource group $rg"
    az group create \
        --name "$rg" \
        --location "$AZURE_LOCATION" \
        --tags purpose=tula-tenant tenant-id="$tenant_id" \
               created-at="$TIMESTAMP" \
               email-hash="$(echo -n "$tenant_email" | sha256sum | awk '{print $1}')" \
        --output none
    ok "  resource group created"

    # Step 4 — Create GitHub backup repo
    info "Step 4: creating GitHub backup repo $backup_repo"
    gh repo create "$backup_repo" \
        --private \
        --description "Tula tenant backup ($tenant_id) — encrypted state, do not modify" \
        --confirm 2>/dev/null || gh repo create "$backup_repo" --private \
        --description "Tula tenant backup ($tenant_id) — encrypted state, do not modify"
    ok "  backup repo created"

    # Generate a fine-grained PAT for the tenant VM to push to its single repo
    # NOTE: gh CLI as of 2026 does not yet directly support fine-grained PAT
    # creation; we use a classic PAT scoped to that single repo via a token-
    # helper script. In an operator deployment, prefer GitHub Apps with a
    # per-tenant installation. For v0.1 we use a manually-pre-created PAT
    # bundled in $SECRETS_DIR/github-pat-template, then attribute the repo
    # access via the bot. This is a known gap to harden in v0.2.
    local github_pat
    github_pat=$(load_secret github-pat-tenant-write)
    ok "  github PAT loaded (caller-supplied; rotate per tenant in v0.2)"

    # Step 5 — Load LLM provider keys
    info "Step 5: loading LLM provider keys"
    local anthropic_key
    anthropic_key=$(load_secret anthropic-api-key)
    local xai_key=""
    if [[ -f "$SECRETS_DIR/xai-api-key" ]]; then
        xai_key=$(load_secret xai-api-key)
    fi
    ok "  provider keys loaded"

    # Step 6 — Render cloud-init userdata
    info "Step 6: rendering cloud-init userdata"
    local cloud_init_template
    cloud_init_template="$(dirname "$0")/cloud-init-template.yaml"
    if [[ ! -f "$cloud_init_template" ]]; then
        err "cloud-init template not found at $cloud_init_template"
        exit 1
    fi
    local cloud_init_rendered
    cloud_init_rendered=$(mktemp)
    chmod 600 "$cloud_init_rendered"
    local pubkey_content
    pubkey_content=$(cat "$OPERATOR_SSH_PUBKEY")

    # Render template with substitutions. Use a Python heredoc for safe YAML
    # string injection (avoids sed escaping foot-guns with special chars).
    python3 - <<PYEOF > "$cloud_init_rendered"
import os, sys
with open("$cloud_init_template") as f:
    tmpl = f.read()
subs = {
    "TENANT_ID":            "$tenant_id",
    "TENANT_DISPLAY_NAME":  """$tenant_name""",
    "TENANT_EMAIL":         "$tenant_email",
    "TELEGRAM_BOT_TOKEN":   "$bot_token",
    "TELEGRAM_BOT_USERNAME":"$bot_username",
    "ANTHROPIC_API_KEY":    """$anthropic_key""",
    "XAI_API_KEY":          """$xai_key""",
    "GITHUB_PAT":           """$github_pat""",
    "BACKUP_REPO_URL":      "https://github.com/$backup_repo.git",
    "OPERATOR_SSH_PUBKEY":  """$pubkey_content""",
    "TIMESTAMP":            "$TIMESTAMP",
}
for k, v in subs.items():
    tmpl = tmpl.replace("{{" + k + "}}", v)
sys.stdout.write(tmpl)
PYEOF
    ok "  cloud-init rendered ($(wc -l < "$cloud_init_rendered") lines)"

    # Step 7 — Create the VM from the image
    info "Step 7: creating VM $vm from image $image"
    local image_id
    image_id=$(az image show \
        --resource-group "$IMAGE_RESOURCE_GROUP" \
        --name "$image" \
        --query id -o tsv 2>/dev/null) || true
    if [[ -z "$image_id" ]]; then
        err "image $image not found in $IMAGE_RESOURCE_GROUP"
        exit 1
    fi

    az vm create \
        --resource-group "$rg" \
        --name "$vm" \
        --image "$image_id" \
        --size "$AZURE_VM_SIZE" \
        --os-disk-size-gb "$AZURE_OS_DISK_SIZE_GB" \
        --storage-sku os="$AZURE_OS_DISK_SKU" \
        --vnet-name "$AZURE_VNET" \
        --subnet "$AZURE_SUBNET" \
        --public-ip-address "" \
        --admin-username azureuser \
        --ssh-key-values "$pubkey_content" \
        --custom-data "$cloud_init_rendered" \
        --assign-identity \
        --tags purpose=tula-tenant tenant-id="$tenant_id" image="$image" \
        --output none
    ok "  VM created"

    # Step 8 — Wait for cloud-init to report success
    info "Step 8: waiting for cloud-init success (timeout 10 min)..."
    local start_time deadline
    start_time=$(date +%s)
    deadline=$((start_time + 600))
    local private_ip
    private_ip=$(az vm show -g "$rg" -n "$vm" -d --query privateIps -o tsv)
    info "  private IP: $private_ip"
    info "  polling /etc/tula-ready every 15s..."

    while true; do
        if [[ $(date +%s) -gt $deadline ]]; then
            err "cloud-init timeout"
            exit 1
        fi
        local result
        result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
            -o UserKnownHostsFile=/dev/null \
            "azureuser@$private_ip" \
            'cat /etc/tula-ready 2>/dev/null || echo not-ready' 2>/dev/null || echo unreachable)
        case "$result" in
            ready)      ok "  cloud-init complete"; break ;;
            failed:*)   err "cloud-init failed: $result"; exit 1 ;;
            *)          sleep 15 ;;
        esac
    done

    # Step 9 — Smoke test: ask the bot for status
    # (operator runs this via a separate /healthz path on the VM; for v0.1
    # we trust cloud-init's own /etc/tula-ready and do not attempt to
    # round-trip Telegram from the operator side, since that requires a
    # tenant chat-id we don't have until the patient first messages the bot)
    info "Step 9: skipping Telegram round-trip smoke test (no tenant chat-id yet)"

    # Step 10 — Finalize tenant record
    info "Step 10: finalizing tenant record"
    jq --arg ts "$TIMESTAMP" --arg pip "$private_ip" \
        '.status = "active" | .activated_at = $ts | .azure.private_ip = $pip' \
        "$tenant_record" > "$tenant_record.tmp"
    mv "$tenant_record.tmp" "$tenant_record"

    # Step 11 — Onboarding link
    local onboarding_token
    onboarding_token=$(openssl rand -hex 16)
    jq --arg ot "$onboarding_token" '.onboarding_token = $ot' \
        "$tenant_record" > "$tenant_record.tmp"
    mv "$tenant_record.tmp" "$tenant_record"
    local onboarding_link="https://t.me/$bot_username?start=$onboarding_token"

    # Disable rollback trap — success
    rollback_needed=0
    trap - EXIT

    # Step 12 — Operator output
    echo
    ok "==================================================================="
    ok "Tenant provisioned successfully."
    ok ""
    ok "  Tenant ID:        $tenant_id"
    ok "  Display name:     $tenant_name"
    ok "  Email:            $tenant_email"
    ok "  Azure VM:         $vm in $rg ($private_ip)"
    ok "  Backup repo:      https://github.com/$backup_repo"
    ok "  Telegram bot:     @$bot_username"
    ok "  Onboarding link:  $onboarding_link"
    ok ""
    ok "Tenant record:    $tenant_record"
    ok "==================================================================="
    ok ""
    ok "Send the onboarding link to $tenant_email and they're live."

    rm -f "$cloud_init_rendered"
}

# -------------------------------------------------------------------------
# Subcommand: list
# -------------------------------------------------------------------------

cmd_list() {
    preflight
    if [[ ! -d "$TENANTS_DIR" ]] || [[ -z "$(ls -A "$TENANTS_DIR" 2>/dev/null)" ]]; then
        info "(no tenants)"
        return
    fi
    printf "%-14s  %-30s  %-10s  %-25s\n" "TENANT-ID" "DISPLAY-NAME" "STATUS" "PROVISIONED-AT"
    printf "%-14s  %-30s  %-10s  %-25s\n" "$(printf '%0.s-' {1..14})" "$(printf '%0.s-' {1..30})" "$(printf '%0.s-' {1..10})" "$(printf '%0.s-' {1..25})"
    for f in "$TENANTS_DIR"/*.json; do
        [[ -f "$f" ]] || continue
        local tid dn status pa
        tid=$(jq -r '.tenant_id' "$f")
        dn=$(jq -r '.display_name' "$f")
        status=$(jq -r '.status' "$f")
        pa=$(jq -r '.provisioned_at' "$f")
        printf "%-14s  %-30s  %-10s  %-25s\n" "$tid" "$dn" "$status" "$pa"
    done
}

# -------------------------------------------------------------------------
# Subcommand: show
# -------------------------------------------------------------------------

cmd_show() {
    local tenant_id="${1:-}"
    [[ -z "$tenant_id" ]] && { err "usage: tula-provision show <tenant-id>"; exit 2; }
    is_valid_tenant_id "$tenant_id" || { err "invalid tenant-id"; exit 2; }
    local f
    f=$(tenant_record_path "$tenant_id")
    [[ ! -f "$f" ]] && { err "no such tenant"; exit 2; }
    jq . "$f"
}

# -------------------------------------------------------------------------
# Subcommand: rollback (idempotent cleanup)
# -------------------------------------------------------------------------

cmd_rollback() {
    local tenant_id="${1:-}"
    [[ -z "$tenant_id" ]] && { err "usage: tula-provision rollback <tenant-id>"; exit 2; }
    is_valid_tenant_id "$tenant_id" || { err "invalid tenant-id"; exit 2; }
    preflight
    info "rolling back tenant $tenant_id (idempotent)"

    local rg="tula-tenant-$tenant_id"
    local backup_repo="$GH_ORG/tula-vm-state-$tenant_id"

    # Delete VM + RG
    if az group show -n "$rg" >/dev/null 2>&1; then
        info "  deleting resource group $rg (background)"
        az group delete --name "$rg" --yes --no-wait
        ok "  rg delete initiated"
    else
        info "  resource group $rg not found; skipping"
    fi

    # Delete GitHub repo
    if gh repo view "$backup_repo" >/dev/null 2>&1; then
        info "  deleting GitHub repo $backup_repo"
        gh repo delete "$backup_repo" --yes 2>/dev/null || \
            warn "  could not delete repo $backup_repo (may need --confirm interactively)"
    else
        info "  github repo $backup_repo not found; skipping"
    fi

    # Release bot token back to pool
    release_bot_token "$tenant_id"
    ok "  bot token released"

    # Update / remove tenant record
    local f
    f=$(tenant_record_path "$tenant_id")
    if [[ -f "$f" ]]; then
        jq --arg ts "$TIMESTAMP" '.status = "rolled-back" | .rolled_back_at = $ts' "$f" > "$f.tmp"
        mv "$f.tmp" "$f"
        ok "  tenant record updated to rolled-back"
    fi

    ok "rollback complete"
}

# -------------------------------------------------------------------------
# Subcommand: health
# -------------------------------------------------------------------------

cmd_health() {
    local tenant_id="${1:-}"
    [[ -z "$tenant_id" ]] && { err "usage: tula-provision health <tenant-id>"; exit 2; }
    is_valid_tenant_id "$tenant_id" || { err "invalid tenant-id"; exit 2; }
    preflight
    local f
    f=$(tenant_record_path "$tenant_id")
    [[ ! -f "$f" ]] && { err "no such tenant"; exit 2; }

    local rg vm private_ip backup_repo
    rg=$(jq -r '.azure.resource_group' "$f")
    vm=$(jq -r '.azure.vm_name' "$f")
    private_ip=$(jq -r '.azure.private_ip' "$f")
    backup_repo=$(jq -r '.github.backup_repo' "$f")

    info "=== Health check: $tenant_id ==="
    # VM state
    local vm_state
    vm_state=$(az vm get-instance-view -g "$rg" -n "$vm" \
        --query 'instanceView.statuses[?starts_with(code, `PowerState/`)].displayStatus' -o tsv 2>/dev/null || echo "unknown")
    info "  VM state:        $vm_state"

    # SSH reachable
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
        -o UserKnownHostsFile=/dev/null \
        "azureuser@$private_ip" 'echo ok' >/dev/null 2>&1; then
        ok "  SSH reachable"
    else
        warn "  SSH NOT reachable"
    fi

    # Last backup
    local last_commit
    last_commit=$(gh api "repos/$backup_repo/commits?per_page=1" --jq '.[0].commit.committer.date' 2>/dev/null || echo none)
    info "  last backup:     $last_commit"

    # Disk free
    local disk_free
    disk_free=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
        -o UserKnownHostsFile=/dev/null \
        "azureuser@$private_ip" "df -h / | tail -1 | awk '{print \$4 \" (\" \$5 \" used)\"}'" 2>/dev/null || echo unknown)
    info "  disk free:       $disk_free"

    # Openclaw service running
    local gw_status
    gw_status=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
        -o UserKnownHostsFile=/dev/null \
        "azureuser@$private_ip" 'systemctl is-active openclaw-gateway.service' 2>/dev/null || echo inactive)
    info "  openclaw-gw:     $gw_status"

    # Tula version on the VM
    local tula_ver
    tula_ver=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
        -o UserKnownHostsFile=/dev/null \
        "azureuser@$private_ip" 'cat /etc/tula-template-version 2>/dev/null | grep ^version= | cut -d= -f2' 2>/dev/null || echo unknown)
    info "  template ver:    $tula_ver"
}

# -------------------------------------------------------------------------
# Subcommand: decommission
# -------------------------------------------------------------------------

cmd_decommission() {
    local tenant_id="${1:-}"
    [[ -z "$tenant_id" ]] && { err "usage: tula-provision decommission <tenant-id>"; exit 2; }
    is_valid_tenant_id "$tenant_id" || { err "invalid tenant-id"; exit 2; }
    preflight
    local f
    f=$(tenant_record_path "$tenant_id")
    [[ ! -f "$f" ]] && { err "no such tenant"; exit 2; }

    info "=== Decommission begin: $tenant_id ==="
    local rg vm
    rg=$(jq -r '.azure.resource_group' "$f")
    vm=$(jq -r '.azure.vm_name' "$f")

    # Phase 1 — stop the VM (deallocate; keeps disk for the grace period)
    info "  deallocating VM (30-day grace)"
    az vm deallocate -g "$rg" -n "$vm" --no-wait

    # Mark in record
    jq --arg ts "$TIMESTAMP" '.status = "decommission-requested" | .decommission_requested_at = $ts' \
        "$f" > "$f.tmp"
    mv "$f.tmp" "$f"

    ok "  tenant deallocated. 30-day grace started."
    ok "  to complete: tula-provision rollback $tenant_id (after $TIMESTAMP + 30d)"
    warn "  recommended: export the tenant record before final rollback"
}

# -------------------------------------------------------------------------
# Main dispatch
# -------------------------------------------------------------------------

usage() {
    cat <<EOF
tula-provision — orchestrate Tula tenant lifecycle

Usage:
  $0 new-tenant <display-name> <email> [image-name]
                                        Provision a new tenant
  $0 list                               List all tenants
  $0 show <tenant-id>                   Show one tenant's record
  $0 health <tenant-id>                 Health check a live tenant
  $0 rollback <tenant-id>               Tear down a tenant (idempotent)
  $0 decommission <tenant-id>           Begin offboarding (30-day grace)
  $0 -h | --help                        This help

Environment overrides:
  TULA_OPS_HOME       Operator state directory (default \$HOME/tula-ops)
  AZURE_LOCATION      Default eastus2
  AZURE_VNET          Default tula-tenants-vnet
  AZURE_SUBNET        Default tula-tenants-subnet
  AZURE_VM_SIZE       Default Standard_B2s
  DEFAULT_IMAGE       Default tula-tenant-template-0-1-0
  IMAGE_RESOURCE_GROUP    Default ra-healthcareagents-rg
  GH_ORG              Default realactivity
  OPERATOR_SSH_PUBKEY     Default \$HOME/.ssh/id_ed25519.pub

See companion spec at ~/.openclaw/workspace/docs/TENANT_TEMPLATE_BUILD.md
EOF
}

main() {
    local sub="${1:-}"; shift || true
    case "$sub" in
        new-tenant)    cmd_new_tenant "$@" ;;
        list)          cmd_list "$@" ;;
        show)          cmd_show "$@" ;;
        rollback)      cmd_rollback "$@" ;;
        health)        cmd_health "$@" ;;
        decommission)  cmd_decommission "$@" ;;
        -h|--help|"")  usage ;;
        *)             err "unknown subcommand: $sub"; usage; exit 2 ;;
    esac
}

main "$@"
