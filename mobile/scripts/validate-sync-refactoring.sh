#!/bin/bash

##############################################################################
# Sync Architecture Refactoring Validation Script
#
# Validates the migration from sync_status column to sync_queue table
# as the single source of truth for synchronization status.
#
# Usage: ./scripts/validate-sync-refactoring.sh
##############################################################################

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================="
echo "🔍 Sync Architecture Refactoring Validation"
echo "=================================================="
echo ""
echo "Project: $PROJECT_ROOT"
echo "Date: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((CHECKS_PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((CHECKS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((CHECKS_WARNING++))
}

info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

section() {
    echo ""
    echo "=================================================="
    echo "$1"
    echo "=================================================="
    echo ""
}

##############################################################################
# CHECK 1: Schema Version
##############################################################################
section "1. Checking Database Schema Version"

if grep -q "export const SCHEMA_VERSION = 2" "$PROJECT_ROOT/src/database/schema.ts"; then
    pass "Schema version is 2"
else
    fail "Schema version is not 2"
fi

##############################################################################
# CHECK 2: sync_status Column Removed from Schema
##############################################################################
section "2. Checking sync_status Column Removed"

if grep -q "sync_status" "$PROJECT_ROOT/src/database/schema.ts"; then
    fail "sync_status column still exists in schema.ts"
else
    pass "sync_status column removed from schema.ts"
fi

# Check for index removal
if grep -q "idx_captures_sync_status" "$PROJECT_ROOT/src/database/schema.ts"; then
    fail "idx_captures_sync_status index still exists"
else
    pass "idx_captures_sync_status index removed"
fi

##############################################################################
# CHECK 3: FK Constraint Added
##############################################################################
section "3. Checking Foreign Key Constraint"

if grep -q "FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE" "$PROJECT_ROOT/src/database/schema.ts"; then
    pass "FK constraint added to sync_queue"
else
    fail "FK constraint missing in sync_queue"
fi

##############################################################################
# CHECK 4: 'conflict' Operation Type Added
##############################################################################
section "4. Checking 'conflict' Operation Type"

if grep -q "'conflict'" "$PROJECT_ROOT/src/database/schema.ts"; then
    pass "'conflict' operation type added to schema"
else
    fail "'conflict' operation type missing from schema"
fi

if grep -q "'conflict'" "$PROJECT_ROOT/src/contexts/capture/domain/ISyncQueueService.ts"; then
    pass "'conflict' added to ISyncQueueService OperationType"
else
    fail "'conflict' missing from ISyncQueueService"
fi

##############################################################################
# CHECK 5: Migration v2 Exists
##############################################################################
section "5. Checking Migration v2 Implementation"

if grep -q "version: 2" "$PROJECT_ROOT/src/database/migrations.ts"; then
    pass "Migration v2 exists"
else
    fail "Migration v2 not found"
fi

# Check for down() method
if grep -q "down: (db: DB)" "$PROJECT_ROOT/src/database/migrations.ts"; then
    pass "Migration v2 has rollback (down) method"
else
    warn "Migration v2 missing rollback method"
fi

##############################################################################
# CHECK 6: Domain Model Updated
##############################################################################
section "6. Checking Capture Domain Model"

if ! grep -q "syncStatus:" "$PROJECT_ROOT/src/contexts/capture/domain/Capture.model.ts"; then
    pass "syncStatus removed from Capture interface"
else
    fail "syncStatus still exists in Capture interface"
fi

if ! grep -q "sync_status:" "$PROJECT_ROOT/src/contexts/capture/domain/Capture.model.ts"; then
    pass "sync_status removed from CaptureRow interface"
else
    fail "sync_status still exists in CaptureRow interface"
fi

##############################################################################
# CHECK 7: Repository Interface Updated
##############################################################################
section "7. Checking ICaptureRepository Interface"

# Check for removed method
if ! grep -q "findBySyncStatus" "$PROJECT_ROOT/src/contexts/capture/domain/ICaptureRepository.ts"; then
    pass "findBySyncStatus() removed from interface"
else
    fail "findBySyncStatus() still exists in interface"
fi

# Check for new methods
REQUIRED_METHODS=("findPendingSync" "findSynced" "findConflicts" "isPendingSync" "hasConflict")
for method in "${REQUIRED_METHODS[@]}"; do
    if grep -q "$method" "$PROJECT_ROOT/src/contexts/capture/domain/ICaptureRepository.ts"; then
        pass "New method $method() added to interface"
    else
        fail "New method $method() missing from interface"
    fi
done

##############################################################################
# CHECK 8: Repository Implementation
##############################################################################
section "8. Checking CaptureRepository Implementation"

if grep -q "INNER JOIN sync_queue" "$PROJECT_ROOT/src/contexts/capture/data/CaptureRepository.ts"; then
    pass "Repository uses JOIN queries with sync_queue"
else
    fail "Repository not using JOIN queries"
fi

if ! grep -q "findBySyncStatus" "$PROJECT_ROOT/src/contexts/capture/data/CaptureRepository.ts"; then
    pass "findBySyncStatus() removed from implementation"
else
    fail "findBySyncStatus() still exists in implementation"
fi

##############################################################################
# CHECK 9: Services Refactored
##############################################################################
section "9. Checking Service Refactoring"

# OfflineSyncService
if grep -q "findPendingSync()" "$PROJECT_ROOT/src/contexts/capture/services/OfflineSyncService.ts"; then
    pass "OfflineSyncService uses findPendingSync()"
else
    fail "OfflineSyncService not refactored"
fi

# RetentionPolicyService
if grep -q "findSynced()" "$PROJECT_ROOT/src/contexts/capture/services/RetentionPolicyService.ts"; then
    pass "RetentionPolicyService uses findSynced()"
else
    fail "RetentionPolicyService not refactored"
fi

##############################################################################
# CHECK 10: Test Context Updated
##############################################################################
section "10. Checking Test Context Mocks"

if grep -q "_syncQueue" "$PROJECT_ROOT/tests/acceptance/support/test-context.ts"; then
    pass "Test context has _syncQueue mock"
else
    fail "Test context missing _syncQueue mock"
fi

if grep -q "findPendingSync()" "$PROJECT_ROOT/tests/acceptance/support/test-context.ts"; then
    pass "Test context implements findPendingSync()"
else
    fail "Test context missing findPendingSync()"
fi

##############################################################################
# CHECK 11: Gherkin Scenarios Refactored
##############################################################################
section "11. Checking Gherkin Scenario Refactoring"

GHERKIN_FILES=(
    "tests/acceptance/features/story-2-1-capture-audio.feature"
    "tests/acceptance/features/story-2-2-capture-texte.feature"
    "tests/acceptance/features/story-2-3-annuler-capture.feature"
    "tests/acceptance/features/story-2-4-stockage-offline.feature"
)

for file in "${GHERKIN_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        # Check if old syncStatus pattern exists
        if grep -q 'syncStatus.*"pending"' "$PROJECT_ROOT/$file"; then
            fail "$file still uses old syncStatus pattern"
        else
            pass "$file refactored (no old syncStatus patterns)"
        fi

        # Check if new pattern exists
        if grep -q "queue de synchronisation" "$PROJECT_ROOT/$file"; then
            pass "$file uses new sync_queue pattern"
        else
            warn "$file may not use new pattern (check manually)"
        fi
    else
        warn "$file not found"
    fi
done

##############################################################################
# CHECK 12: Step Definitions Created
##############################################################################
section "12. Checking Step Definitions"

if [ -f "$PROJECT_ROOT/tests/acceptance/support/sync-queue-steps.ts" ]; then
    pass "sync-queue-steps.ts file created"

    # Check for key step definitions
    if grep -q "la capture est dans la queue de synchronisation" "$PROJECT_ROOT/tests/acceptance/support/sync-queue-steps.ts"; then
        pass "Key step definitions implemented"
    else
        warn "Some step definitions may be missing"
    fi
else
    fail "sync-queue-steps.ts file not found"
fi

##############################################################################
# CHECK 13: TypeScript Compilation
##############################################################################
section "13. Checking TypeScript Compilation"

info "Running TypeScript type checking..."
cd "$PROJECT_ROOT"

if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
    fail "TypeScript compilation has errors"
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -n 10
else
    pass "TypeScript compilation successful (no type errors)"
fi

##############################################################################
# SUMMARY
##############################################################################
section "📊 Validation Summary"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run unit tests: npm test"
    echo "2. Run acceptance tests: npm run test:acceptance"
    echo "3. Manual testing:"
    echo "   - Create capture → verify in sync_queue"
    echo "   - Check OfflineIndicator shows correct count"
    echo "   - Delete capture → verify CASCADE removes sync_queue entry"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Validation failed with $CHECKS_FAILED error(s)${NC}"
    echo ""
    echo "Please fix the failed checks before proceeding."
    echo ""
    exit 1
fi
EOF
