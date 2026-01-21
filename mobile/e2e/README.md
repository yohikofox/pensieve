# E2E Tests Setup - Detox + React Native

## Overview

End-to-end tests using **Detox** for React Native + Expo custom dev client.

**Test Coverage**: Story 2.1 (Capture Audio 1-Tap) - 15 E2E tests covering all 5 acceptance criteria.

---

## Prerequisites

### 1. Install Detox CLI globally

```bash
npm install -g detox-cli
```

### 2. iOS Setup (macOS only)

**Install Xcode Command Line Tools:**

```bash
xcode-select --install
```

**Install applesimutils:**

```bash
brew tap wix/brew
brew install applesimutils
```

### 3. Android Setup

**Install Android SDK and Emulator:**

- Android Studio with SDK Platform 33 (API 33)
- Create AVD named `Pixel_5_API_33`

```bash
# Verify Android setup
$ANDROID_HOME/emulator/emulator -list-avds
# Should show: Pixel_5_API_33
```

---

## Installation

### 1. Install dependencies

```bash
cd pensieve/mobile
npm install
```

**This installs:**
- `detox@^20.28.3` - E2E test framework
- `jest-junit@^17.0.0` - JUnit XML reporter for CI

### 2. Prebuild Expo project

```bash
npm run prebuild:clean
```

This generates `ios/` and `android/` directories required by Detox.

### 3. Build test app

**iOS:**

```bash
npm run test:e2e:build:ios
```

**Android:**

```bash
npm run test:e2e:build:android
```

---

## Running Tests

### Run all E2E tests (iOS)

```bash
npm run test:e2e
# or
npm run test:e2e:ios
```

### Run all E2E tests (Android)

```bash
npm run test:e2e:android
```

### Run specific test file

```bash
detox test e2e/story-2-1-capture-audio.e2e.ts --configuration ios.sim.debug
```

### Run with debug output

```bash
detox test --configuration ios.sim.debug --loglevel verbose
```

### Run in headed mode (see simulator)

Detox always runs in headed mode by default (simulator visible).

---

## Test Structure

```
pensieve/mobile/
├── e2e/
│   ├── story-2-1-capture-audio.e2e.ts  # ATDD tests for Story 2.1
│   ├── support/
│   │   └── helpers.ts                  # Reusable test helpers
│   ├── setup.ts                        # Global test setup
│   ├── jest.config.js                  # Jest configuration for Detox
│   └── README.md                       # This file
├── .detoxrc.js                         # Detox configuration
└── package.json                        # Scripts and dependencies
```

---

## ATDD Workflow (Red-Green-Refactor)

### RED Phase (Current)

✅ **15 failing tests created** for Story 2.1:
- AC1: 5 tests (latency, visual feedback, haptic, entity, storage)
- AC2: 4 tests (stop, save, update entity, metadata)
- AC3: 2 tests (offline mode, sync marking)
- AC4: 2 tests (crash recovery, notification)
- AC5: 2 tests (permission prompt, recording after grant)

**All tests are expected to FAIL** until implementation is complete.

### GREEN Phase (DEV Team)

1. Implement features following Story 2.1 tasks/subtasks
2. Add required `data-testid` attributes (see checklist below)
3. Run tests frequently: `npm run test:e2e`
4. Fix implementation until all tests pass

### REFACTOR Phase (DEV Team)

1. Once all tests pass (GREEN), refactor code
2. Extract duplications, optimize performance
3. Tests provide safety net - ensure they still pass after refactor

---

## Required data-testid Attributes

**Implementation MUST add these testIDs to components:**

### Main Screen
- `main-screen` - Main screen container
- `record-button` - Record button (tap to start recording)
- `stop-button` - Stop button (tap to stop recording)

### Recording State
- `recording-indicator` - Visual indicator (pulsing red dot)
- `recording-timer` - Timer showing recording duration (e.g., "00:05")

### Capture Feed
- `capture-feed` - Feed container showing all captures
- `capture-item-{index}` - Individual capture item (e.g., `capture-item-0`)
- `capture-item-{index}-metadata` - Metadata container (duration, timestamp)
- `capture-item-{index}-duration` - Duration text (e.g., "00:02")
- `capture-item-{index}-sync-pending` - Sync pending badge/indicator

### Errors & Notifications
- `error-message` - General error message container
- `network-error` - Network-specific error message
- `permission-required-message` - Microphone permission required message
- `recovery-notification` - Crash recovery notification

---

## Performance Testing

**NFR1 Validation**: Test verifies < 500ms latency from tap to recording start.

```typescript
const latency = await measurePerformance('tap-to-record', async () => {
  await tapElement('record-button');
  await waitForElement('recording-indicator', 1000);
});

expect(latency).toBeLessThan(500); // MUST be < 500ms
```

---

## Offline Testing

Tests validate offline-first architecture (NFR7):

```typescript
await goOffline(); // Disables network
await tapElement('record-button'); // Should still work
await tapElement('stop-button');
await expectVisible('capture-item-0'); // Capture saved locally
await expectVisible('capture-item-0-sync-pending'); // Marked for sync
```

---

## Crash Recovery Testing

Tests validate NFR8 (zero data loss):

```typescript
await tapElement('record-button');
await device.sleep(2000); // Record for 2s
await terminateApp(); // Simulate crash
await launchApp();
await expectVisible('recovery-notification'); // User notified
// Partial recording should be recovered
```

---

## Troubleshooting

### Tests fail with "Cannot find element"

**Cause**: Missing `data-testid` attributes in components.

**Fix**: Add testIDs to your React Native components:

```tsx
<TouchableOpacity testID="record-button" onPress={handleRecord}>
  <Text>Record</Text>
</TouchableOpacity>
```

### iOS simulator not launching

**Fix**:

```bash
xcrun simctl list devices
# Choose available simulator
detox test --device-name="iPhone 15 Pro"
```

### Android emulator not found

**Fix**:

```bash
$ANDROID_HOME/emulator/emulator -list-avds
# Create AVD if missing or update .detoxrc.js with correct name
```

### Build fails

**Fix**: Clean and rebuild

```bash
npm run prebuild:clean
npm run test:e2e:build:ios  # or :android
```

---

## CI Integration (Future)

Add to `.github/workflows/e2e-tests.yml`:

```yaml
- name: Run E2E Tests
  run: |
    npm run test:e2e:build:ios
    npm run test:e2e:ios
```

Artifacts (screenshots, videos) saved to `e2e/test-results/`.

---

## Knowledge Base References

Tests follow TEA (Test Engineering Architect) patterns:

- **Given-When-Then** structure (`test-quality.md`)
- **Deterministic waits** - no hard sleeps except for recording duration (`timing-debugging.md`)
- **data-testid selectors** - most resilient selector strategy (`selector-resilience.md`)
- **One assertion per test** - atomic test design (`test-quality.md`)
- **Network-first** - offline testing validates NFR7 (`network-first.md`)

---

## Next Steps

1. ✅ Detox setup complete
2. ✅ 15 E2E tests created (RED phase)
3. ⏳ **Implement Story 2.1** (DEV team)
4. ⏳ Add required `data-testid` attributes
5. ⏳ Run tests until GREEN
6. ⏳ Refactor with confidence
