# Quick Testing Guide - Get Started in 5 Minutes

## Step 1: Run SQL Schema (Required)

1. Go to Supabase Dashboard → SQL Editor
2. Open `DATA_INTEGRITY_SCHEMA.sql`
3. Copy entire file and paste into SQL Editor
4. Click "Run" (or F5)
5. ✅ **Expected:** No errors, see "Success. No rows returned"

---

## Step 2: Test Database Constraints (2 minutes)

### Test UNIQUE Constraint on Businesses:
```sql
-- Replace YOUR_USER_ID with your actual user ID from auth.users table
SELECT id FROM auth.users LIMIT 1; -- Get your user ID

-- This should fail if you already have a business:
INSERT INTO businesses (user_id, name, email, phone)
VALUES (
    'YOUR_USER_ID_HERE', 
    'Duplicate Business Test', 
    'test@example.com', 
    '1234567890'
);
```
✅ **Expected:** Error "duplicate key value violates unique constraint 'businesses_user_id_unique'"

---

## Step 3: Test in Browser Console (3 minutes)

Open your app in browser, open DevTools Console (F12), then run:

### Test 3.1: Verify Background Sync is Disabled
```javascript
// Run this:
window.syncManager.performSync();

// ✅ Expected: Console warning "[Sync] performSync called but background sync is DISABLED"
```

### Test 3.2: Test Reconciliation Function
```javascript
// First, get your business
const user = await getCurrentUser();
const business = await getBusinessForUser(user.id);

// Test reconciliation
const result = await window.reconciliation.reconcileAll(business.id);

// ✅ Expected: Object with { clients: { pushed, pulled, updated }, measurements: { ... } }
console.log('Reconciliation result:', result);
```

### Test 3.3: Verify Insert Guards Work
```javascript
// Try to find/create client - should work if business exists
// If business doesn't exist, should fail with CRITICAL error

// Via UI: Try adding a measurement
// ✅ Expected: If no business, error "CRITICAL: Business not found"
```

---

## Step 4: Test Cross-Device Sync (Manual)

**Important:** Background sync is disabled, so you must manually trigger sync.

### On Device A:
1. Login
2. Create a client via UI
3. **Manually sync:**
   ```javascript
   const user = await getCurrentUser();
   const business = await getBusinessForUser(user.id);
   await window.reconciliation.reconcileAll(business.id);
   ```

### On Device B:
1. Login with same account
2. Data should seed automatically on first load
3. If not, **manually sync:**
   ```javascript
   const user = await getCurrentUser();
   const business = await getBusinessForUser(user.id);
   await window.reconciliation.reconcileAll(business.id);
   ```
4. ✅ **Expected:** Client from Device A appears on Device B

---

## Step 5: Verify UUID Preservation

```javascript
// Create a client and note its ID
const client = await findOrCreateClient('Test UUID', '123', 'M');
const originalId = client.id;
console.log('Client ID:', originalId);

// Clear IndexedDB and re-seed
await window.indexedDBHelper.clearAllStores();
await seedIndexedDBFromSupabase('YOUR_USER_ID');

// Get client again
const clients = await getClients();
const foundClient = clients.find(c => c.name === 'Test UUID');

if (foundClient && foundClient.id === originalId) {
    console.log('✅ PASS: UUID preserved');
} else {
    console.error('❌ FAIL: UUID changed');
}
```

---

## Common Issues & Quick Fixes

### Issue: "Business not found"
**Fix:** 
1. Make sure you have a business linked to your user_id
2. Run this in Supabase SQL Editor to check:
   ```sql
   SELECT * FROM businesses WHERE user_id = 'YOUR_USER_ID';
   ```
3. If no business, create one via UI first

### Issue: Reconciliation returns empty results
**Fix:** 
- Make sure you have data in Supabase
- Check console for errors
- Verify business_id exists

### Issue: Constraint violation errors
**Fix:** 
- Make sure you ran `DATA_INTEGRITY_SCHEMA.sql`
- Check that constraints exist:
  ```sql
  SELECT conname FROM pg_constraint 
  WHERE conrelid = 'businesses'::regclass;
  ```

---

## Verification Checklist

Quick checklist to verify everything works:

- [ ] SQL schema runs without errors
- [ ] Console shows: "Supabase client initialized successfully"
- [ ] `window.reconciliation` exists (type it in console)
- [ ] `window.syncManager.performSync()` shows warning (sync disabled)
- [ ] Can create client via UI
- [ ] Can create measurement via UI  
- [ ] Reconciliation function runs without errors
- [ ] Data appears after manual reconciliation

---

## Next Steps

If all tests pass:
1. ✅ Data integrity is working
2. ✅ Background sync is disabled
3. ✅ Reconciliation is available for manual sync
4. ✅ UUIDs are preserved

If tests fail:
1. Check console for errors
2. Verify SQL schema was run
3. Check that business exists and is linked to user_id
4. Review `TESTING_GUIDE.md` for detailed tests

