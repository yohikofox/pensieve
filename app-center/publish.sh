#!/bin/bash
set -e

REGISTRY="${REGISTRY:-cregistry.yolo.yt}"
IMAGE_NAME="pensine-app-center"
VERSION="${VERSION:-$(git rev-parse --short HEAD)}"
LATEST_TAG="${LATEST_TAG:-latest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building ${IMAGE_NAME} (linux/amd64)..."
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  -t "${REGISTRY}/${IMAGE_NAME}:${LATEST_TAG}" \
  "${SCRIPT_DIR}"

echo "Published: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
