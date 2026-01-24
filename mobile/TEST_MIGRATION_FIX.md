# Test Migration Fix

## Clear App Data

```bash
# iOS - Uninstall from all simulators
xcrun simctl uninstall booted com.pensieve.mobile 2>/dev/null || true

# OR manually: iOS Simulator → Device → Erase All Content and Settings
```

## Rebuild and Run

```bash
cd /Users/yoannlorho/ws/pensine/pensieve/mobile

# Clear Metro cache
npm start -- --reset-cache

# In separate terminal, build and run
npx react-native run-ios --simulator="iPhone 16 Pro"
```

## Watch for Migration Logs

You should see in Metro logs:

```
[DB] Current version: 0, Target version: 2
[DB] 🔄 Running migration v1: Initial schema - captures table with sync_status
[DB] ✅ Migration v1: Initial schema (v1) created
[DB] 🔄 Running migration v2: Remove sync_status column - use sync_queue as single source of truth
[DB] 🔍 Migration v2: Pre-migration validation
[DB] 🔄 Step 1/12: Creating captures_new without sync_status
... (12 steps)
[DB] 🔍 Migration v2: Post-migration validation
[DB] ✅ Migration v2: All validations passed
[DB] ✅ Applied 2 migration(s)
```

## ✅ Success Indicators

1. App starts without "Database initialization" error
2. Both migrations complete successfully
3. No crashes during startup
4. Can create captures and see them in the feed

## ❌ If Still Failing

Check Metro logs for the specific error and share the exact error message.
