#!/bin/bash
set -e

REGISTRY="${REGISTRY:-localhost:5000}"
IMAGE_NAME="pensine-app-center"
VERSION="${VERSION:-$(git rev-parse --short HEAD)}"
LATEST_TAG="${LATEST_TAG:-latest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building ${IMAGE_NAME}..."
docker build \
  -t "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  -t "${REGISTRY}/${IMAGE_NAME}:${LATEST_TAG}" \
  "${SCRIPT_DIR}"

echo "Pushing ${IMAGE_NAME}..."
docker push "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
docker push "${REGISTRY}/${IMAGE_NAME}:${LATEST_TAG}"

echo "Published: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
