#!/bin/bash
set -e

# ===========================================
# Pensine Backend - Build & Publish
# ===========================================

REGISTRY="${REGISTRY:-cregistry.yolo.yt}"
IMAGE_NAME="pensine-backend"
VERSION="${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}"

PLATFORM="${PLATFORM:-linux/amd64}"

echo "🔨 Building ${IMAGE_NAME} for ${PLATFORM}..."
docker build --platform ${PLATFORM} -t ${REGISTRY}/${IMAGE_NAME}:${VERSION} -t ${REGISTRY}/${IMAGE_NAME}:latest .

echo "📤 Pushing to ${REGISTRY}..."
docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}
docker push ${REGISTRY}/${IMAGE_NAME}:latest

echo "✅ Published:"
echo "   - ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "   - ${REGISTRY}/${IMAGE_NAME}:latest"
