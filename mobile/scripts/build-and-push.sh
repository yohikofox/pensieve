#!/bin/bash
# build-and-push.sh — Build l'APK Android et l'upload sur MinIO
# Usage: ./scripts/build-and-push.sh
#
# Variables d'environnement requises (ou via .env dans le dossier scripts/) :
#   MINIO_ENDPOINT   — ex: http://minio.homelab.local:9000
#   MINIO_ACCESS_KEY — clé d'accès MinIO
#   MINIO_SECRET_KEY — secret MinIO
#   MINIO_BUCKET     — nom du bucket (défaut: pensine-apks)

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

# 1. Version = package.json version + git sha court
cd "${MOBILE_DIR}"
PACKAGE_VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
VERSION="${PACKAGE_VERSION}-${GIT_SHA}"

echo "Version: ${VERSION}"

# 2. Build APK (release)
echo "Prebuild release..."
npm run prebuild:release:clean

echo "Build APK..."
cd android
./gradlew assembleRelease
cd "${MOBILE_DIR}"

# 3. Localiser l'APK
APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "${APK_PATH}" ]; then
  echo "Erreur: APK introuvable à ${APK_PATH}"
  exit 1
fi

APK_SIZE=$(stat -f%z "${APK_PATH}" 2>/dev/null || stat -c%s "${APK_PATH}")

echo "APK: ${APK_PATH} (${APK_SIZE} bytes)"

# 4. Configurer mc (MinIO client)
mc alias set pensine-build "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --quiet

# 5. Upload APK
DEST_PREFIX="pensine/mobile/${VERSION}"
echo "Upload APK -> ${MINIO_BUCKET}/${DEST_PREFIX}/app-release.apk"
mc cp "${APK_PATH}" "pensine-build/${MINIO_BUCKET}/${DEST_PREFIX}/app-release.apk"

# 6. Upload metadata.json
METADATA=$(cat <<EOF
{
  "version": "${VERSION}",
  "buildDate": "${BUILD_DATE}",
  "gitSha": "${GIT_SHA}",
  "size": ${APK_SIZE}
}
EOF
)

echo "${METADATA}" | mc pipe "pensine-build/${MINIO_BUCKET}/${DEST_PREFIX}/metadata.json"

echo ""
echo "Upload terminé: ${MINIO_BUCKET}/${DEST_PREFIX}/"
