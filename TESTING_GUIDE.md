# Testing Guide - Data Integrity Implementation

## Prerequisites

1. **Run SQL Schema First**
   - Open Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
   - Copy and run `DATA_INTEGRITY_SCHEMA.sql`
   - Verify no errors

2. **Backup Your Data** (Recommended)
   - Export existing data from Supabase if needed
   - Clear IndexedDB in browser DevTools → Application → IndexedDB → Delete

---

## Test 1: Database Constraints (SQL Tests)

### Test 1.1: UNIQUE(user_id) on Businesses
```sql
-- This should SUCCEED (first business for user)
INSERT INTO businesses (user_id, name, email, phone)
VALUES ('YOUR_USER_ID_HERE', 'Test Business 1', 'test@example.com', '1234567890');

-- This should FAIL (duplicate business for same user)
INSERT INTO businesses (user_id, name, email, phone)
VALUES ('YOUR_USER_ID_HERE', 'Test Business 2', 'test2@example.com', '0987654321');
-- Expected: Error about UNIQUE constraint violation
```

### Test 1.2: UNIQUE(business_id, id) on Clients
```sql
-- Get your business_id first
SELECT id FROM businesses WHERE user_id = 'YOUR_USER_ID_HERE';

-- Insert client (should succeed)
INSERT INTO clients (id, user_id, business_id, name, phone, sex)
VALUES ('CLIENT_UUID_1', 'YOUR_USER_ID_HERE', 'YOUR_BUSINESS_ID_HERE', 'Client A', '1111111111', 'M');

-- Try duplicate (should fail)
INSERT INTO clients (id, user_id, business_id, name, phone, sex)
VALUES ('CLIENT_UUID_1', 'YOUR_USER_ID_HERE', 'YOUR_BUSINESS_ID_HERE', 'Client B', '2222222222', 'F');
-- Expected: Error about UNIQUE constraint violation
```

### Test 1.3: CHECK Constraint (measurement.business_id === client.business_id)
```sql
-- Get client_id and business_id
SELECT id, business_id FROM clients WHERE business_id = 'YOUR_BUSINESS_ID_HERE' LIMIT 1;

-- Try inserting measurement with client from different business (should fail)
INSERT INTO measurements (
    id, user_id, business_id, client_id, garment_type, shoulder, chest, waist
)
VALUES (
    'MEASUREMENT_UUID_1',
    'YOUR_USER_ID_HERE',
    'DIFFERENT_BUSINESS_ID',  -- WRONG: Different business
    'YOUR_CLIENT_ID_HERE',     -- Client belongs to YOUR_BUSINESS_ID
    'Shirt', 20, 40, 32
);
-- Expected: Error from trigger "Measurement client_id must belong to the same business_id"
```

---

## Test 2: Insert Guards (Application Tests)

### Test 2.1: Create Client Without Business (Should Fail)
```javascript
// In browser console (after login)
// Clear business from cache first
localStorage.removeItem('cached_business');

// Try to create client without business
// This should throw: "CRITICAL: Business not found. Cannot create client without valid business_id."
// Trigger via UI: Try to add a new measurement → Enter client name → Should fail
```

### Test 2.2: Create Measurement Without Client (Should Fail)
```javascript
// In browser console
// Try to create measurement directly (this should be prevented by UI, but test guards)
// The saveMeasurement function should verify client_id exists
// Expected: Error "CRITICAL: Client with id XXX not found"
```

### Test 2.3: Create Measurement with Client from Different Business (Should Fail)
```javascript
// This is prevented by:
// 1. Application guard (verifies client.business_id === measurement.business_id)
// 2. Database trigger (CHECK constraint)

// To test, try manipulating IndexedDB directly (should fail on sync):
// 1. Create a measurement with mismatched business_id/client_id in IndexedDB
// 2. Try to sync - should fail
// 3. Try to create via UI - should fail with guard error
```

### Test 2.4: Verify UUID Generation (Should Generate Once)
```javascript
// In browser console
const client1 = await findOrCreateClient('Test Client', '1234567890', 'M');
console.log('Client 1 ID:', client1.id); // Note this ID

// Create same client again - should return existing (not regenerate UUID)
const client2 = await findOrCreateClient('Test Client', '1234567890', 'M');
console.log('Client 2 ID:', client2.id); // Should be SAME as client1.id

// Verify UUIDs are preserved
if (client1.id === client2.id) {
    console.log('✅ PASS: UUID preserved');
} else {
    console.error('❌ FAIL: UUID regenerated');
}
```

---

## Test 3: Background Sync Disabled

### Test 3.1: Verify No Automatic Sync
```javascript
// In browser console
// Check if sync functions are disabled
window.syncManager.startBackgroundSync();
// Expected: Console warning "[Sync] startBackgroundSync called but background sync is DISABLED"

window.syncManager.performSync();
// Expected: Console warning "[Sync] performSync called but background sync is DISABLED"
// Expected: Function returns immediately (no sync happens)
```

### Test 3.2: Verify No Sync Calls in Code
```javascript
// Check that syncManager calls are removed from app.js
// Search for "syncManager.performSync" in console
// Expected: No calls found (or only disabled functions)

// Monitor network requests
// Open DevTools → Network tab
// Create a client/measurement
// Expected: NO automatic Supabase requests (only explicit user actions)
```

---

## Test 4: Fetch Scope (business_id Only)

### Test 4.1: Verify Seed Uses business_id
```javascript
// Clear IndexedDB
// DevTools → Application → IndexedDB → Delete database
// Refresh page

// Monitor console logs during login
// Look for: "[Seed] Fetching clients by business_id: XXX"
// Look for: "[Seed] Fetching measurements by business_id: XXX"
// Expected: Logs show business_id, NOT user_id
```

### Test 4.2: Verify Reconciliation Uses business_id
```javascript
// In browser console (after login)
const business = await getBusinessForUser('YOUR_USER_ID');
console.log('Business ID:', business.id);

// Test reconciliation
const result = await window.reconciliation.reconcileClients(business.id);
console.log('Reconciliation result:', result);
// Expected: Logs show "Fetching remote clients for business_id: XXX"
// Expected: NO queries by user_id
```

---

## Test 5: Reconciliation Logic

### Test 5.1: Test Full Reconciliation
```javascript
// In browser console (after login)
const business = await getBusinessForUser('YOUR_USER_ID');
console.log('Business:', business);

// Run full reconciliation
const result = await window.reconciliation.reconcileAll(business.id);
console.log('Reconciliation:', result);
// Expected:
// {
//   clients: { pushed: X, pulled: Y, updated: Z },
//   measurements: { pushed: X, pulled: Y, updated: Z }
// }

// Verify no errors
if (result && !result.error) {
    console.log('✅ PASS: Reconciliation completed');
} else {
    console.error('❌ FAIL: Reconciliation error', result);
}
```

### Test 5.2: Test Reconciliation Diff Logic
```javascript
// Scenario: Local has unsynced client, remote has different client
// 1. Create client locally (offline)
// 2. Create different client on another device (synced)
// 3. Run reconciliation
// Expected:
// - Local-only client → pushed to remote
// - Remote-only client → pulled to local
// - No UUID regeneration
// - No merging of different UUIDs

const business = await getBusinessForUser('YOUR_USER_ID');
const result = await window.reconciliation.reconcileClients(business.id);
console.log('Diff result:', result);
// Expected: { pushed: 1, pulled: 1, updated: 0 }
```

---

## Test 6: Cross-Device Sync (Manual Test)

### Test 6.1: Device A → Device B (Explicit Sync)
1. **Device A:**
   - Login
   - Create client "Client A"
   - Create measurement for "Client A"
   - **Manually trigger reconciliation:**
     ```javascript
     const business = await getBusinessForUser('YOUR_USER_ID');
     await window.reconciliation.reconcileAll(business.id);
     ```

2. **Device B:**
   - Login with same account
   - **IndexedDB should seed from Supabase** (automatic on first load)
   - OR manually trigger reconciliation:
     ```javascript
     const business = await getBusinessForUser('YOUR_USER_ID');
     await window.reconciliation.reconcileAll(business.id);
     ```
   - Verify "Client A" and measurement appear

### Test 6.2: Device B → Device A (Explicit Sync)
1. **Device B:**
   - Create client "Client B"
   - Create measurement for "Client B"
   - **Manually trigger reconciliation**

2. **Device A:**
   - **Manually trigger reconciliation** (won't auto-sync)
   - Verify "Client B" and measurement appear

**Note:** Background sync is DISABLED, so you must manually call `reconcileAll()` for cross-device sync.

---

## Test 7: Identity Preservation

### Test 7.1: UUID Never Regenerated
```javascript
// Create client and note UUID
const client1 = await findOrCreateClient('Test', '123', 'M');
const originalId = client1.id;
console.log('Original ID:', originalId);

// Clear IndexedDB
await window.indexedDBHelper.clearAllStores();

// Seed from Supabase (should preserve UUID)
await seedIndexedDBFromSupabase('YOUR_USER_ID');

// Get client again
const clients = await getClients();
const client2 = clients.find(c => c.name === 'Test');

if (client2 && client2.id === originalId) {
    console.log('✅ PASS: UUID preserved across seed');
} else {
    console.error('❌ FAIL: UUID changed', { original: originalId, current: client2?.id });
}
```

### Test 7.2: No Duplicate UUIDs
```sql
-- In Supabase SQL Editor
-- Check for duplicate IDs (should be 0)

-- Check clients
SELECT id, COUNT(*) as count
FROM clients
GROUP BY id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check measurements
SELECT id, COUNT(*) as count
FROM measurements
GROUP BY id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check businesses
SELECT user_id, COUNT(*) as count
FROM businesses
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

---

## Test 8: Error Handling

### Test 8.1: Invalid business_id (Should Fail)
```javascript
// In browser console
try {
    await window.indexedDBHelper.saveClientLocal(
        { name: 'Test', phone: '123', sex: 'M' },
        'USER_ID',
        'INVALID-UUID-FORMAT' // Not a valid UUID
    );
    console.error('❌ FAIL: Should have thrown error');
} catch (err) {
    if (err.message.includes('CRITICAL')) {
        console.log('✅ PASS: Error caught for invalid business_id');
    } else {
        console.error('❌ FAIL: Wrong error', err);
    }
}
```

### Test 8.2: Missing Parent UUID (Should Fail)
```javascript
// Try to create measurement without valid client
// This should be prevented by:
// 1. UI validation
// 2. Application guards
// 3. Database foreign key constraint

// Expected: Error at each level if guard is bypassed
```

---

## Quick Test Checklist

- [ ] SQL schema runs without errors
- [ ] UNIQUE constraint prevents duplicate businesses per user
- [ ] UNIQUE constraint prevents duplicate clients per business
- [ ] CHECK constraint prevents cross-scope measurements
- [ ] Insert guards verify parent UUIDs exist
- [ ] UUIDs are generated once and preserved
- [ ] Background sync is disabled (no automatic sync)
- [ ] All fetches use business_id scope (not user_id)
- [ ] Reconciliation works (push/pull/update)
- [ ] Cross-device sync works with manual reconciliation
- [ ] No duplicate UUIDs in database
- [ ] Error handling catches invalid UUIDs

---

## Debugging Tips

1. **Check Console Logs:**
   - Look for `[CRITICAL]` errors - these are guard failures
   - Look for `[Sync]` warnings - background sync is disabled
   - Look for `[Reconcile]` logs - reconciliation progress

2. **Check Network Tab:**
   - Supabase requests should use `business_id` in WHERE clause
   - No automatic sync requests after creating data

3. **Check IndexedDB:**
   - DevTools → Application → IndexedDB
   - Verify `business_id` is stored on all records
   - Verify UUIDs match between `local_id` and `server_id`

4. **Check Supabase:**
   - SQL Editor → Verify constraints exist
   - Table Editor → Verify data has `business_id` set
   - Verify no duplicate UUIDs

---

## Common Issues & Fixes

### Issue: "Business not found" error
**Fix:** Make sure business exists and is linked to user_id. Run `UPDATE_EXISTING_RECORDS.sql` if needed.

### Issue: Reconciliation not syncing
**Fix:** Background sync is disabled. You must manually call `window.reconciliation.reconcileAll(business.id)`.

### Issue: Duplicate data after reconciliation
**Fix:** Check that UUIDs are preserved. Clear IndexedDB and re-seed if needed.

### Issue: Constraint violation errors
**Fix:** Run `DATA_INTEGRITY_SCHEMA.sql` in Supabase to add constraints.

---

## Manual Testing Scenarios

### Scenario 1: New Device (First Time)
1. Login on Device B (new)
2. IndexedDB seeds from Supabase automatically
3. Verify data appears
4. ✅ PASS if data syncs

### Scenario 2: Offline Creation → Online Sync
1. Go offline (DevTools → Network → Offline)
2. Create client/measurement
3. Go online
4. Manually call `reconcileAll()`
5. Verify data syncs to Supabase
6. ✅ PASS if data appears on server

### Scenario 3: Conflicting Edits
1. Edit same measurement on Device A and B
2. Device A has newer timestamp
3. Run reconciliation on Device B
4. Verify Device B gets Device A's version
5. ✅ PASS if latest version wins

