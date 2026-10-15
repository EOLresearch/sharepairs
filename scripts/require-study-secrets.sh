# Study deploy secrets — source from CloudShell/deploy scripts.
# Local MEMORY_DB development does not need this.

if [ -z "${STUB_AUTH_SECRET:-}" ] || [ "$STUB_AUTH_SECRET" = "sharepairs-dev-launch" ] || [ "$STUB_AUTH_SECRET" = "unset-set-via-wire-api" ]; then
  echo "ERROR: Export STUB_AUTH_SECRET to a new random value (not a git-committed or placeholder secret)." >&2
  echo "  example: export STUB_AUTH_SECRET=\"\$(openssl rand -hex 32)\"" >&2
  exit 1
fi

if [ -z "${SUPPORT_PASSWORD:-}" ] || [ "$SUPPORT_PASSWORD" = "password123" ]; then
  echo "ERROR: Export SUPPORT_PASSWORD to a non-default value before study deploy." >&2
  exit 1
fi
