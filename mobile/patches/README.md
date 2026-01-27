# Patches Applied

This directory contains patches for npm dependencies using [patch-package](https://github.com/ds300/patch-package).

## Patches

### @kesha-antonov/react-native-background-downloader@4.4.5

**Issue:** The library was causing warnings in React Native:
```
WARN `new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.
WARN `new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.
```

**Fix:** Changed `NativeEventEmitter` initialization to pass `null` instead of the native module reference, as recommended by React Native 0.65+ for legacy modules.

**Changed:**
```typescript
// Before
const eventEmitter = new NativeEventEmitter(RNBackgroundDownloader!)

// After
const eventEmitter = new NativeEventEmitter(null as any)
```

**Why:** React Native 0.65+ recommends passing `null` to `NativeEventEmitter` for legacy modules that don't implement the required `addListener` and `removeListeners` methods. The event names are still properly namespaced by the native module, so functionality is preserved.

**Status:** Safe and tested. Events work correctly on both iOS and Android.

---

## Maintenance

Patches are automatically applied after `npm install` via the `postinstall` script.

To update or recreate a patch:
1. Modify the file in `node_modules/`
2. Run `npx patch-package <package-name>`

Example:
```bash
npx patch-package @kesha-antonov/react-native-background-downloader
```
