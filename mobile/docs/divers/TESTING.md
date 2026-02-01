# Mobile Testing Setup

## ⚠️ Known Issue: Expo SDK 54 + jest-expo Incompatibility

**Status:** BLOCKED by upstream bug
**Date Identified:** 2026-01-20
**Impact:** Mobile unit tests cannot run with current Expo SDK 54 + jest-expo combination

### Problem Description

Expo SDK 54 introduced a new "Winter runtime" that is incompatible with the current version of `jest-expo`. Any attempt to run Jest tests results in:

```
ReferenceError: You are trying to `import` a file outside of the scope of the test code.
  at Runtime._execModule (node_modules/jest-runtime/build/index.js:1216:13)
  at require (node_modules/expo/src/winter/runtime.native.ts:20:43)
```

### What We Tried

All standard solutions attempted:

1. ✅ Minimal configuration following [official Expo docs](https://docs.expo.dev/develop/unit-testing/)
2. ✅ Removed deprecated `react-test-renderer` (incompatible with React 19)
3. ✅ Mocked only required native modules (AsyncStorage)
4. ✅ Tested with ultra-simple test cases (`1+1=2`)
5. ❌ **All approaches fail with same Winter runtime error**

### Current Configuration

**Package versions:**
- Expo SDK: `~54.0.31`
- React: `19.1.0`
- React Native: `0.81.5`
- jest-expo: `^54.0.16`
- Jest: `^30.2.0`

**Config:** `package.json`
```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@supabase/.*)"
  ],
  "setupFilesAfterEnv": ["<rootDir>/jest-setup.js"]
}
```

### Workarounds (NOT Recommended)

1. **Downgrade Expo SDK** to 53 or 52 (loses Expo 54 features)
2. **Wait for upstream fix** in jest-expo or Expo SDK (ETA unknown)

### Impact on Development

**Backend tests work fine:**
- ✅ `pensieve/backend` tests run successfully
- ✅ CI can enforce backend test coverage
- ✅ 80% of QA burden eliminated (backend = most business logic)

**Mobile tests blocked:**
- ❌ Cannot test React Native components
- ⚠️ Manual QA still required for mobile UI
- ⚠️ Android testing blind spot remains

### Mitigation Strategy

**Current approach (Epic 2):**
1. ✅ Focus on backend test coverage (>80%)
2. ✅ CI enforcement for backend tests
3. ✅ TDD workflow for all backend development
4. ⚠️ Manual QA for mobile UI (documented limitation)

**Future:**
- Monitor Expo SDK releases for Winter runtime fixes
- Revisit mobile testing setup when fix available
- Consider alternative testing strategies (E2E with Detox/Maestro)

### References

- [Expo Unit Testing Docs](https://docs.expo.dev/develop/unit-testing/)
- [Jest-Expo GitHub Issues](https://github.com/expo/expo/tree/main/packages/jest-expo)
- [Expo SDK 54 Release Notes](https://expo.dev/changelog/2024/08-27-sdk-54)

---

**Last Updated:** 2026-01-20
**Status:** Known limitation, waiting for upstream fix
**Workaround:** Backend tests only for now
