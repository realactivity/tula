#!/usr/bin/env bash
# Wren container entrypoint.
#
# The JWKS (Wren's OAuth signing keyset) MUST stay stable for the life of the
# Epic registration. We persist it on a mounted Azure Files share rather than
# baking it into the image, so rebuilds and replica restarts reuse the same
# keys. The private keys are non-sensitive by design (they ship to browsers).
#
# The SQLite session DB (./data/wren.db) is intentionally NOT placed on the
# share - it holds only short-lived ciphertext and SQLite over SMB risks lock
# contention/corruption. It stays on the container's local disk.
set -euo pipefail

KEYS_DIR="${WREN_KEYS_DIR:-/mnt/wren/wren}"
DATA_DIR="./data"
PUB="jwks.json"
FULL="jwks-intentionally-publishing-private-keys-which-are-not-sensitive-in-this-architecture.json"

mkdir -p "$DATA_DIR"
mkdir -p "$KEYS_DIR"

if [ ! -f "$KEYS_DIR/$PUB" ]; then
  echo "[entrypoint] No JWKS found on share at $KEYS_DIR - generating once (RSA only)."
  bun run generate-jwks
  cp "$DATA_DIR/$PUB" "$KEYS_DIR/$PUB"
  cp "$DATA_DIR/$FULL" "$KEYS_DIR/$FULL"
  echo "[entrypoint] Persisted new JWKS to $KEYS_DIR."
else
  echo "[entrypoint] Loading existing JWKS from $KEYS_DIR."
fi

# Always sync the canonical keyset from the share into ./data (where the
# server and client-assertion path read it).
cp "$KEYS_DIR/$PUB" "$DATA_DIR/$PUB"
cp "$KEYS_DIR/$FULL" "$DATA_DIR/$FULL"

exec bun run src/server.ts
