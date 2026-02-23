# ===========================================
# Pensine - Docker Build & Push & Deploy
# ===========================================

# Registry configuration
REGISTRY ?= localhost:5000
VERSION ?= $(shell git rev-parse --short HEAD)
LATEST_TAG ?= latest

# Mobile distribution target: "appcenter" (default) or "googleplay"
DISTRIBUTION_TARGET ?= appcenter

# Image names
BACKEND_IMAGE = $(REGISTRY)/pensine-backend
WEB_IMAGE = $(REGISTRY)/pensine-web
ADMIN_IMAGE = $(REGISTRY)/pensine-admin
APP_CENTER_IMAGE = $(REGISTRY)/pensine-app-center

# ===========================================
# Build Commands
# ===========================================

.PHONY: build build-backend build-web build-admin build-app-center

## Build all images
build: build-backend build-web build-admin build-app-center

## Build backend image
build-backend:
	@echo "🔨 Building backend image..."
	docker build -t $(BACKEND_IMAGE):$(VERSION) -t $(BACKEND_IMAGE):$(LATEST_TAG) ./backend

## Build web image
build-web:
	@echo "🔨 Building web image..."
	docker build -t $(WEB_IMAGE):$(VERSION) -t $(WEB_IMAGE):$(LATEST_TAG) ./web

## Build admin image
build-admin:
	@echo "🔨 Building admin image..."
	docker build -t $(ADMIN_IMAGE):$(VERSION) -t $(ADMIN_IMAGE):$(LATEST_TAG) ./admin

## Build app-center image
build-app-center:
	@echo "🔨 Building app-center image..."
	docker build -t $(APP_CENTER_IMAGE):$(VERSION) -t $(APP_CENTER_IMAGE):$(LATEST_TAG) ./app-center

# ===========================================
# Push Commands
# ===========================================

.PHONY: push push-backend push-web push-admin push-app-center

## Push all images to registry
push: push-backend push-web push-admin push-app-center

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

## Push admin image
push-admin:
	@echo "📤 Pushing admin image..."
	docker push $(ADMIN_IMAGE):$(VERSION)
	docker push $(ADMIN_IMAGE):$(LATEST_TAG)

## Push app-center image
push-app-center:
	@echo "📤 Pushing app-center image..."
	docker push $(APP_CENTER_IMAGE):$(VERSION)
	docker push $(APP_CENTER_IMAGE):$(LATEST_TAG)

# ===========================================
# Combined Commands
# ===========================================

.PHONY: release release-backend release-web release-admin release-app-center

## Build and push all images
release: build push
	@echo "✅ All images released to $(REGISTRY)"

## Build and push backend
release-backend: build-backend push-backend
	@echo "✅ Backend released to $(REGISTRY)"

## Build and push web
release-web: build-web push-web
	@echo "✅ Web released to $(REGISTRY)"

## Build and push admin
release-admin: build-admin push-admin
	@echo "✅ Admin released to $(REGISTRY)"

## Build and push app-center
release-app-center: build-app-center push-app-center
	@echo "✅ App Center released to $(REGISTRY)"

# ===========================================
# Deploy Commands (build + push + Portainer redeploy)
# ===========================================

.PHONY: deploy deploy-services deploy-mobile deploy-mobile-appcenter deploy-mobile-googleplay

## Full deploy: build + push all images & APK (App Center mode), then trigger Portainer redeployment
## Reads config from deploy.env (copy from deploy.env.example)
## Override mobile target: make deploy DISTRIBUTION_TARGET=googleplay
deploy:
	@bash ./deploy.sh --distribution-target=$(DISTRIBUTION_TARGET)

## Deploy only Docker services (no mobile APK)
deploy-services:
	@bash ./deploy.sh --skip-mobile

## Deploy only mobile (build + push to MinIO) — mode contrôlé par DISTRIBUTION_TARGET (défaut: appcenter)
deploy-mobile:
	@bash ./deploy.sh --only=mobile --distribution-target=$(DISTRIBUTION_TARGET)

## Deploy mobile — mode App Center (multiple APKs par ABI)
deploy-mobile-appcenter:
	@bash ./deploy.sh --only=mobile --distribution-target=appcenter

## Deploy mobile — mode Google Play (AAB unique)
deploy-mobile-googleplay:
	@bash ./deploy.sh --only=mobile --distribution-target=googleplay

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
	-docker rmi $(ADMIN_IMAGE):$(VERSION) $(ADMIN_IMAGE):$(LATEST_TAG) 2>/dev/null
	-docker rmi $(APP_CENTER_IMAGE):$(VERSION) $(APP_CENTER_IMAGE):$(LATEST_TAG) 2>/dev/null
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
	@echo "Deploy targets (build + push + Portainer redeploy):"
	@echo "  deploy                      Full deploy: all images + APK + Portainer webhooks"
	@echo "  deploy-services             Docker services only (no mobile APK)"
	@echo "  deploy-mobile               Mobile only — DISTRIBUTION_TARGET=$(DISTRIBUTION_TARGET)"
	@echo "  deploy-mobile-appcenter     Mobile — App Center (multiple APKs par ABI)"
	@echo "  deploy-mobile-googleplay    Mobile — Google Play (AAB unique)"
	@echo "  (reads config from deploy.env — copy from deploy.env.example)"
	@echo ""
	@echo "Mobile distribution:"
	@echo "  DISTRIBUTION_TARGET=appcenter   Multiple APKs (arm64-v8a, x86_64) — défaut"
	@echo "  DISTRIBUTION_TARGET=googleplay  Single AAB (Google Play Delivery)"
	@echo ""
	@echo "Build targets:"
	@echo "  build             Build all images"
	@echo "  build-backend     Build backend image"
	@echo "  build-web         Build web image"
	@echo "  build-admin       Build admin image"
	@echo "  build-app-center  Build app-center image"
	@echo ""
	@echo "Push targets:"
	@echo "  push              Push all images"
	@echo "  push-backend      Push backend image"
	@echo "  push-web          Push web image"
	@echo "  push-admin        Push admin image"
	@echo "  push-app-center   Push app-center image"
	@echo ""
	@echo "Release targets (build + push):"
	@echo "  release           Build and push all"
	@echo "  release-backend   Build and push backend"
	@echo "  release-web       Build and push web"
	@echo "  release-admin     Build and push admin"
	@echo "  release-app-center Build and push app-center"
	@echo ""
	@echo "Utility targets:"
	@echo "  list            List images in registry"
	@echo "  tags            Show tags (IMAGE=name)"
	@echo "  clean           Remove local images"
	@echo "  version         Show current version"
	@echo ""
	@echo "Examples:"
	@echo "  make deploy                                         # Full deploy (App Center APKs)"
	@echo "  make deploy DISTRIBUTION_TARGET=googleplay          # Full deploy (Google Play AAB)"
	@echo "  make deploy-mobile-appcenter                        # APKs only → MinIO"
	@echo "  make deploy-mobile-googleplay                       # AAB only → MinIO"
	@echo "  make deploy-services                                # Services only, no APK"
	@echo "  make release REGISTRY=192.168.1.100:5000            # Build + push, no Portainer"
	@echo "  make tags IMAGE=pensine-backend"

.DEFAULT_GOAL := help
