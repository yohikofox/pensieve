# ===========================================
# Pensine - Docker Build & Push
# ===========================================

# Registry configuration
REGISTRY ?= localhost:5000
VERSION ?= $(shell git rev-parse --short HEAD)
LATEST_TAG ?= latest

# Image names
BACKEND_IMAGE = $(REGISTRY)/pensine-backend
WEB_IMAGE = $(REGISTRY)/pensine-web

# ===========================================
# Build Commands
# ===========================================

.PHONY: build build-backend build-web

## Build all images
build: build-backend build-web

## Build backend image
build-backend:
	@echo "🔨 Building backend image..."
	docker build -t $(BACKEND_IMAGE):$(VERSION) -t $(BACKEND_IMAGE):$(LATEST_TAG) ./backend

## Build web image
build-web:
	@echo "🔨 Building web image..."
	docker build -t $(WEB_IMAGE):$(VERSION) -t $(WEB_IMAGE):$(LATEST_TAG) ./web

# ===========================================
# Push Commands
# ===========================================

.PHONY: push push-backend push-web

## Push all images to registry
push: push-backend push-web

## Push backend image
push-backend:
	@echo "📤 Pushing backend image..."
	docker push $(BACKEND_IMAGE):$(VERSION)
	docker push $(BACKEND_IMAGE):$(LATEST_TAG)

## Push web image
push-web:
	@echo "📤 Pushing web image..."
	docker push $(WEB_IMAGE):$(VERSION)
	docker push $(WEB_IMAGE):$(LATEST_TAG)

# ===========================================
# Combined Commands
# ===========================================

.PHONY: release release-backend release-web

## Build and push all images
release: build push
	@echo "✅ All images released to $(REGISTRY)"

## Build and push backend
release-backend: build-backend push-backend
	@echo "✅ Backend released to $(REGISTRY)"

## Build and push web
release-web: build-web push-web
	@echo "✅ Web released to $(REGISTRY)"

# ===========================================
# Utility Commands
# ===========================================

.PHONY: list clean help

## List images in registry
list:
	@echo "📋 Images in registry:"
	@curl -s http://$(REGISTRY)/v2/_catalog | jq -r '.repositories[]' 2>/dev/null || echo "Registry not accessible"

## Show tags for an image (usage: make tags IMAGE=pensine-backend)
tags:
	@echo "🏷️  Tags for $(IMAGE):"
	@curl -s http://$(REGISTRY)/v2/$(IMAGE)/tags/list | jq -r '.tags[]' 2>/dev/null || echo "Image not found"

## Clean local images
clean:
	@echo "🧹 Cleaning local images..."
	-docker rmi $(BACKEND_IMAGE):$(VERSION) $(BACKEND_IMAGE):$(LATEST_TAG) 2>/dev/null
	-docker rmi $(WEB_IMAGE):$(VERSION) $(WEB_IMAGE):$(LATEST_TAG) 2>/dev/null
	@echo "✅ Local images cleaned"

## Show version
version:
	@echo "Version: $(VERSION)"
	@echo "Registry: $(REGISTRY)"

## Help
help:
	@echo "Pensine Docker Build System"
	@echo ""
	@echo "Usage: make [target] [REGISTRY=host:port] [VERSION=tag]"
	@echo ""
	@echo "Build targets:"
	@echo "  build           Build all images"
	@echo "  build-backend   Build backend image"
	@echo "  build-web       Build web image"
	@echo ""
	@echo "Push targets:"
	@echo "  push            Push all images"
	@echo "  push-backend    Push backend image"
	@echo "  push-web        Push web image"
	@echo ""
	@echo "Release targets:"
	@echo "  release         Build and push all"
	@echo "  release-backend Build and push backend"
	@echo "  release-web     Build and push web"
	@echo ""
	@echo "Utility targets:"
	@echo "  list            List images in registry"
	@echo "  tags            Show tags (IMAGE=name)"
	@echo "  clean           Remove local images"
	@echo "  version         Show current version"
	@echo ""
	@echo "Examples:"
	@echo "  make build"
	@echo "  make release REGISTRY=192.168.1.100:5000"
	@echo "  make release VERSION=v1.0.0"
	@echo "  make tags IMAGE=pensine-backend"

.DEFAULT_GOAL := help
