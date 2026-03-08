#!/bin/bash
# ===========================================
# Pensine — Deploy All
# Build + Push Docker images & APK, then update Portainer stack env vars
# and trigger redeploy via Portainer CE API
#
# Usage:
#   ./deploy.sh [options]
#
# Options:
#   --skip-mobile     Skip Android APK build
#   --skip-deploy     Skip Portainer redeploy
#   --dry-run         Print actions without executing them
#   --only=LIST       Deploy only specified components (comma-separated)
#                     Values: backend,web,admin,app-center,mobile
#   --distribution-target=VALUE  Mobile build target: "appcenter" (default) or "googleplay"
#   --help            Show this help
#
# Config:
#   Copy deploy.env.example → deploy.env and fill in values.
#   All variables can also be passed as environment variables.
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# -------------------------------------------
# Colors & formatting
# -------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()    { echo -e "${BLUE}[deploy]${RESET} $*"; }
ok()     { echo -e "${GREEN}[deploy]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[deploy]${RESET} $*"; }
error()  { echo -e "${RED}[deploy] ERROR:${RESET} $*" >&2; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${RESET}"; }
dry()    { echo -e "${YELLOW}[dry-run]${RESET} $*"; }

# -------------------------------------------
# Flags
# -------------------------------------------
SKIP_MOBILE=false
SKIP_DEPLOY=false
DRY_RUN=false
ONLY_COMPONENTS=""
DISTRIBUTION_TARGET="appcenter"

for arg in "$@"; do
  case "$arg" in
    --skip-mobile)           SKIP_MOBILE=true ;;
    --skip-deploy)           SKIP_DEPLOY=true ;;
    --dry-run)               DRY_RUN=true ;;
    --only=*)                ONLY_COMPONENTS="${arg#--only=}" ;;
    --distribution-target=*) DISTRIBUTION_TARGET="${arg#--distribution-target=}" ;;
    --help)
      sed -n '/^# Usage/,/^# =/p' "$0" | sed 's/^# *//'
      exit 0
      ;;
    *)
      error "Unknown option: $arg"
      error "Run ./deploy.sh --help for usage."
      exit 1
      ;;
  esac
done

# -------------------------------------------
# Load configuration
# -------------------------------------------
ENV_FILE="${SCRIPT_DIR}/deploy.env"
if [ -f "${ENV_FILE}" ]; then
  log "Loading config from deploy.env..."
  # shellcheck disable=SC1090
  set -a; source "${ENV_FILE}"; set +a
fi

# -------------------------------------------
# Defaults
# -------------------------------------------
REGISTRY="${REGISTRY:-cregistry.yolo.yt}"
VERSION="${VERSION:-$(git -C "${SCRIPT_DIR}" rev-parse --short HEAD 2>/dev/null || echo "latest")}"
PLATFORM="${PLATFORM:-linux/amd64}"

# Portainer CE API
PORTAINER_URL="${PORTAINER_URL:-}"
PORTAINER_TOKEN="${PORTAINER_TOKEN:-}"
PORTAINER_STACK_ID="${PORTAINER_STACK_ID:-}"
# Set to "true" to skip TLS certificate verification (self-signed certs)
PORTAINER_INSECURE="${PORTAINER_INSECURE:-false}"

# MinIO (mobile APK)
MINIO_ENDPOINT="${MINIO_ENDPOINT:-}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}"
MINIO_BUCKET="${MINIO_BUCKET:-pensine-apks}"

# -------------------------------------------
# curl base options
# -------------------------------------------
# CURL_INSECURE is appended to every Portainer curl call when PORTAINER_INSECURE=true
CURL_INSECURE=()
[ "${PORTAINER_INSECURE}" = "true" ] && CURL_INSECURE=("--insecure")

# -------------------------------------------
# Component selection helper
# -------------------------------------------
should_run() {
  local component="$1"
  if [ -z "${ONLY_COMPONENTS}" ]; then
    return 0
  fi
  echo ",${ONLY_COMPONENTS}," | grep -q ",${component},"
}

# -------------------------------------------
# Run or dry-run a command
# -------------------------------------------
run() {
  if [ "${DRY_RUN}" = true ]; then
    dry "$*"
  else
    "$@"
  fi
}

# Run a command from a specific directory (subshell — does not affect cwd)
run_in() {
  local dir="$1"
  shift
  if [ "${DRY_RUN}" = true ]; then
    dry "(cd ${dir} && $*)"
  else
    (cd "${dir}" && "$@")
  fi
}

# -------------------------------------------
# Portainer CE API — update env vars + redeploy stack
#
# Strategy:
#   1. GET /api/stacks/{id}         → fetch current env + endpointId
#   2. GET /api/stacks/{id}/file    → fetch current compose file (unchanged)
#   3. Upsert BACKEND_VERSION, WEB_VERSION, ADMIN_VERSION in env
#   4. PUT /api/stacks/{id}?endpointId={id}  → push updated env + pullImage=true
# -------------------------------------------
portainer_redeploy() {
  if [ -z "${PORTAINER_URL}" ] || [ -z "${PORTAINER_TOKEN}" ] || [ -z "${PORTAINER_STACK_ID}" ]; then
    warn "Portainer not configured (PORTAINER_URL / PORTAINER_TOKEN / PORTAINER_STACK_ID) — skipping redeploy"
    return
  fi

  if [ "${DRY_RUN}" = true ]; then
    dry "Portainer API: GET /api/stacks/${PORTAINER_STACK_ID} → upsert *_VERSION=${VERSION} → PUT /api/stacks/${PORTAINER_STACK_ID}?pullImage=true"
    return
  fi

  local api_key_header="X-API-Key: ${PORTAINER_TOKEN}"

  # 1. Get stack info (env + endpointId)
  log "Portainer: fetching stack ${PORTAINER_STACK_ID}..."
  local stack_resp
  stack_resp=$(curl -sf "${CURL_INSECURE[@]}" \
    "${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}" \
    -H "${api_key_header}" \
    2>&1) || { error "Portainer GET stack failed: ${stack_resp}"; return 1; }

  local endpoint_id current_env stack_name
  endpoint_id=$(echo "${stack_resp}" | jq -r '.EndpointId')
  current_env=$(echo "${stack_resp}" | jq '.Env // []')
  stack_name=$(echo "${stack_resp}" | jq -r '.Name')

  log "Portainer: stack '${stack_name}' on endpoint ${endpoint_id}"

  # 2. Get compose file content
  local file_resp stack_file_content
  file_resp=$(curl -sf "${CURL_INSECURE[@]}" \
    "${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}/file" \
    -H "${api_key_header}" \
    2>&1) || { error "Portainer GET stack file failed: ${file_resp}"; return 1; }

  stack_file_content=$(echo "${file_resp}" | jq -r '.StackFileContent')

  # 3. Upsert version env vars — only for deployed components
  # Map component names → Portainer env var names
  local version_vars=()
  if [ -z "${ONLY_COMPONENTS}" ]; then
    version_vars=("BACKEND_VERSION" "WEB_VERSION" "ADMIN_VERSION")
  else
    echo ",${ONLY_COMPONENTS}," | grep -q ",backend,"   && version_vars+=("BACKEND_VERSION")
    echo ",${ONLY_COMPONENTS}," | grep -q ",web,"       && version_vars+=("WEB_VERSION")
    echo ",${ONLY_COMPONENTS}," | grep -q ",admin,"     && version_vars+=("ADMIN_VERSION")
  fi

  if [ ${#version_vars[@]} -eq 0 ]; then
    warn "No versioned service in ONLY_COMPONENTS (${ONLY_COMPONENTS}) — skipping Portainer redeploy"
    return
  fi

  log "Portainer: updating $(IFS=,; echo "${version_vars[*]}") to '${VERSION}'..."
  local keys_json
  keys_json=$(printf '%s\n' "${version_vars[@]}" | jq -R . | jq -s .)
  local updated_env
  updated_env=$(echo "${current_env}" | jq \
    --arg v "${VERSION}" \
    --argjson keys "${keys_json}" \
    '
    . as $env |
    $keys | reduce .[] as $key (
      $env;
      if map(.name) | index($key) != null then
        map(if .name == $key then .value = $v else . end)
      else
        . + [{"name": $key, "value": $v}]
      end
    )
    ')

  # Show what changed
  for var in "${version_vars[@]}"; do
    local old_val new_val
    old_val=$(echo "${current_env}" | jq -r --arg k "${var}" '.[] | select(.name==$k) | .value // "latest"')
    new_val="${VERSION}"
    if [ "${old_val}" != "${new_val}" ]; then
      log "  ${var}: ${old_val} → ${new_val}"
    else
      log "  ${var}: ${new_val} (unchanged)"
    fi
  done

  # 4. Redeploy with updated env + pullImage=true
  log "Portainer: deploying (pull + restart)..."
  local payload http_code
  payload=$(jq -n \
    --arg content "${stack_file_content}" \
    --argjson env "${updated_env}" \
    '{stackFileContent: $content, env: $env, pullImage: true, prune: false}')

  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${CURL_INSECURE[@]}" \
    -X PUT "${PORTAINER_URL}/api/stacks/${PORTAINER_STACK_ID}?endpointId=${endpoint_id}" \
    -H "${api_key_header}" \
    -H "Content-Type: application/json" \
    -d "${payload}")

  if [ "${http_code}" = "200" ]; then
    ok "Stack '${stack_name}' redeployed with ${VERSION} (HTTP 200)"
  else
    error "Portainer redeploy failed (HTTP ${http_code})"
    return 1
  fi
}

# -------------------------------------------
# Timing helpers
# -------------------------------------------
START_TIME=$(date +%s)
STEP_START_TIME=0

step_start() {
  STEP_START_TIME=$(date +%s)
  header "$1"
}

step_end() {
  local elapsed=$(( $(date +%s) - STEP_START_TIME ))
  ok "Done in ${elapsed}s"
}

# -------------------------------------------
# Pre-flight summary
# -------------------------------------------
header "Pensine — Full Deploy"
log "Version  : ${BOLD}${VERSION}${RESET}"
log "Registry : ${REGISTRY}"
log "Platform : ${PLATFORM}"
[ -n "${PORTAINER_URL}" ] && log "Portainer: ${PORTAINER_URL} (stack ID: ${PORTAINER_STACK_ID})"
[ "${SKIP_MOBILE}" = true ]  && warn "Mobile APK : SKIPPED"
[ "${SKIP_DEPLOY}" = true ]  && warn "Portainer  : SKIPPED"
[ "${DRY_RUN}" = true ]      && warn "DRY RUN MODE — no commands will be executed"
[ -n "${ONLY_COMPONENTS}" ]  && log "Components : ${ONLY_COMPONENTS}"

echo ""
if [ "${DRY_RUN}" = false ]; then
  read -r -p "Proceed? [y/N] " confirm
  case "${confirm}" in
    [yY][eE][sS]|[yY]) ;;
    *)
      log "Aborted."
      exit 0
      ;;
  esac
fi

# -------------------------------------------
# 1. BACKEND
# -------------------------------------------
if should_run "backend"; then
  step_start "Backend — Build & Push"
  run_in "${SCRIPT_DIR}/backend" env \
    REGISTRY="${REGISTRY}" \
    VERSION="${VERSION}" \
    PLATFORM="${PLATFORM}" \
    bash publish.sh
  step_end
fi

# -------------------------------------------
# 2. WEB
# -------------------------------------------
if should_run "web"; then
  step_start "Web — Build & Push"
  run_in "${SCRIPT_DIR}/web" env \
    REGISTRY="${REGISTRY}" \
    VERSION="${VERSION}" \
    PLATFORM="${PLATFORM}" \
    bash publish.sh
  step_end
fi

# -------------------------------------------
# 3. ADMIN
# -------------------------------------------
if should_run "admin"; then
  step_start "Admin — Build & Push"
  run_in "${SCRIPT_DIR}/admin" env \
    REGISTRY="${REGISTRY}" \
    VERSION="${VERSION}" \
    PLATFORM="${PLATFORM}" \
    bash publish.sh
  step_end
fi

# -------------------------------------------
# 4. APP-CENTER
# -------------------------------------------
if should_run "app-center"; then
  step_start "App-Center — Build & Push"
  run_in "${SCRIPT_DIR}/app-center" env \
    REGISTRY="${REGISTRY}" \
    VERSION="${VERSION}" \
    bash publish.sh
  step_end
fi

# -------------------------------------------
# 5. MOBILE (APK Android)
# -------------------------------------------
if [ "${SKIP_MOBILE}" = false ] && should_run "mobile"; then
  step_start "Mobile — Build APK & Push to MinIO"

  if [ -z "${MINIO_ENDPOINT}" ] || [ -z "${MINIO_ACCESS_KEY}" ] || [ -z "${MINIO_SECRET_KEY}" ]; then
    error "Missing MinIO config for APK upload."
    error "Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY in deploy.env"
    exit 1
  fi

  run_in "${SCRIPT_DIR}/mobile" env \
    MINIO_ENDPOINT="${MINIO_ENDPOINT}" \
    MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
    MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
    MINIO_BUCKET="${MINIO_BUCKET}" \
    DISTRIBUTION_TARGET="${DISTRIBUTION_TARGET}" \
    bash scripts/build-and-push.sh
  step_end
fi

# -------------------------------------------
# 6. PORTAINER — Update env vars + redeploy stack
# -------------------------------------------
if [ "${SKIP_DEPLOY}" = false ]; then
  step_start "Portainer — Update versions & redeploy"
  portainer_redeploy
  step_end
fi

# -------------------------------------------
# Summary
# -------------------------------------------
TOTAL_ELAPSED=$(( $(date +%s) - START_TIME ))
echo ""
ok "${BOLD}Deploy complete in ${TOTAL_ELAPSED}s${RESET}"
log "Version ${VERSION} deployed to ${REGISTRY}"
