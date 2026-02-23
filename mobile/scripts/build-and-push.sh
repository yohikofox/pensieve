#!/bin/bash
# build-and-push.sh — Build l'APK/AAB Android et l'upload sur MinIO
# Usage: ./scripts/build-and-push.sh
#
# Variables d'environnement requises (ou via .env dans le dossier scripts/) :
#   MINIO_ENDPOINT        — ex: http://minio.homelab.local:9000
#   MINIO_ACCESS_KEY      — clé d'accès MinIO
#   MINIO_SECRET_KEY      — secret MinIO
#   MINIO_BUCKET          — nom du bucket (défaut: pensine-apks)
#   DISTRIBUTION_TARGET   — "appcenter" (défaut) ou "googleplay"
#
# Modes :
#   appcenter   → assembleRelease -PdistributionTarget=appcenter
#                 Génère app-arm64-v8a-release.apk + app-x86_64-release.apk
#   googleplay  → bundleRelease -PdistributionTarget=googleplay
#                 Génère app-release.aab

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Charger .env si présent
ENV_FILE="${SCRIPT_DIR}/.env"
if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

# Validation des variables
if [ -z "${MINIO_ENDPOINT}" ]; then
  echo "Erreur: MINIO_ENDPOINT est requis"
  exit 1
fi
if [ -z "${MINIO_ACCESS_KEY}" ]; then
  echo "Erreur: MINIO_ACCESS_KEY est requis"
  exit 1
fi
if [ -z "${MINIO_SECRET_KEY}" ]; then
  echo "Erreur: MINIO_SECRET_KEY est requis"
  exit 1
fi

MINIO_BUCKET="${MINIO_BUCKET:-pensine-apks}"
DISTRIBUTION_TARGET="${DISTRIBUTION_TARGET:-appcenter}"

# 1. Version = package.json version + git sha court
cd "${MOBILE_DIR}"
PACKAGE_VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
VERSION="${PACKAGE_VERSION}-${GIT_SHA}"

echo "Version          : ${VERSION}"
echo "Distribution     : ${DISTRIBUTION_TARGET}"

# 2. Build (release)
echo "Prebuild release..."
npm run prebuild:release:clean

cd android

if [ "${DISTRIBUTION_TARGET}" = "googleplay" ]; then
  echo "Build AAB (Google Play)..."
  ./gradlew bundleRelease -PdistributionTarget=googleplay
else
  echo "Build APKs (App Center)..."
  ./gradlew assembleRelease -PdistributionTarget=appcenter
fi

cd "${MOBILE_DIR}"

# 3. Configurer mc (MinIO client)
mc alias set pensine-build "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --quiet

DEST_PREFIX="pensine/mobile/${VERSION}"

if [ "${DISTRIBUTION_TARGET}" = "googleplay" ]; then
  # --- Mode Google Play : un seul AAB ---
  AAB_PATH="${MOBILE_DIR}/android/app/build/outputs/bundle/release/app-release.aab"
  if [ ! -f "${AAB_PATH}" ]; then
    echo "Erreur: AAB introuvable à ${AAB_PATH}"
    exit 1
  fi

  AAB_SIZE=$(stat -f%z "${AAB_PATH}" 2>/dev/null || stat -c%s "${AAB_PATH}")
  echo "AAB: ${AAB_PATH} (${AAB_SIZE} bytes)"

  echo "Upload AAB -> ${MINIO_BUCKET}/${DEST_PREFIX}/app-release.aab"
  mc cp "${AAB_PATH}" "pensine-build/${MINIO_BUCKET}/${DEST_PREFIX}/app-release.aab"

  METADATA=$(cat <<EOF
{
  "version": "${VERSION}",
  "distributionTarget": "googleplay",
  "buildDate": "${BUILD_DATE}",
  "gitSha": "${GIT_SHA}",
  "artifacts": [
    { "file": "app-release.aab", "size": ${AAB_SIZE} }
  ]
}
EOF
)
else
  # --- Mode App Center : un APK par ABI ---
  APK_DIR="${MOBILE_DIR}/android/app/build/outputs/apk/release"
  ABIS=("arm64-v8a" "x86_64")
  ARTIFACTS_JSON=""
  FIRST=true

  for ABI in "${ABIS[@]}"; do
    APK_PATH="${APK_DIR}/app-${ABI}-release.apk"
    if [ ! -f "${APK_PATH}" ]; then
      echo "Avertissement: APK introuvable pour ${ABI} (${APK_PATH}) — ignoré"
      continue
    fi

    APK_SIZE=$(stat -f%z "${APK_PATH}" 2>/dev/null || stat -c%s "${APK_PATH}")
    echo "APK [${ABI}]: ${APK_PATH} (${APK_SIZE} bytes)"

    DEST_FILE="app-${ABI}-release.apk"
    echo "Upload -> ${MINIO_BUCKET}/${DEST_PREFIX}/${DEST_FILE}"
    mc cp "${APK_PATH}" "pensine-build/${MINIO_BUCKET}/${DEST_PREFIX}/${DEST_FILE}"

    if [ "${FIRST}" = true ]; then
      FIRST=false
    else
      ARTIFACTS_JSON="${ARTIFACTS_JSON},"
    fi
    ARTIFACTS_JSON="${ARTIFACTS_JSON}
    { \"abi\": \"${ABI}\", \"file\": \"${DEST_FILE}\", \"size\": ${APK_SIZE} }"
  done

  METADATA=$(cat <<EOF
{
  "version": "${VERSION}",
  "distributionTarget": "appcenter",
  "buildDate": "${BUILD_DATE}",
  "gitSha": "${GIT_SHA}",
  "artifacts": [${ARTIFACTS_JSON}
  ]
}
EOF
)
fi

# 4. Upload metadata.json
echo "${METADATA}" | mc pipe "pensine-build/${MINIO_BUCKET}/${DEST_PREFIX}/metadata.json"

echo ""
echo "Upload terminé: ${MINIO_BUCKET}/${DEST_PREFIX}/"
