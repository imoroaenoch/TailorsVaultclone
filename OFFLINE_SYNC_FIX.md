# Offline Sync Fix - Analysis & Solution

## Problem Analysis

### Issue: Offline-created measurements don't sync when connectivity returns

**Current Flow:**
1. ✅ **Offline Creation**: Item saved to IndexedDB with `synced: false` and `created_offline: true`
2. ❌ **On Reconnect**: No automatic trigger to sync unsynced items
3. ❌ **On Reload**: No check for unsynced items on page load
4. ❌ **Result**: Items remain unsynced, don't appear on other devices

### Root Causes

1. **No Online Event Listener**: When coming online, nothing triggers reconciliation
2. **No Unsynced Check on Load**: On page load, code doesn't check for unsynced items
3. **Reconciliation Never Called**: Reconciliation function exists but isn't called automatically

## Solution

### Fix 1: Add Online Event Listener

When connectivity returns:
- Check for unsynced items
- Automatically trigger reconciliation
- Sync all offline-created items

### Fix 2: Check on Page Load

On page load (if online):
- Check for unsynced items
- Trigger reconciliation automatically
- Sync all offline-created items

### Fix 3: Verify Reconciliation Handles Unsynced Items

The reconciliation function already filters for `!local.synced`, so it will pick up offline-created items. We just need to ensure it's called automatically.

