# Debug Helper - Quick Fixes

## Issue 1: "You must be logged in to create a client"

**Quick Check:**
```javascript
// In browser console, check:
const user = await getCurrentUser();
console.log('Current user:', user);

// If null, check:
const supabase = window.supabaseClient;
console.log('Supabase client:', supabase);

// Check session:
if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session:', session);
}
```

**Possible Causes:**
1. User not logged in - Login first
2. Supabase client not initialized - Check console for "Supabase client initialized successfully"
3. Session expired - Try logging out and back in

**Fix:** If user is null, you need to login first.

---

## Issue 2: Footer Menu Not Showing

**Quick Check:**
```javascript
// Check if MobileFooter component is rendered
const footer = document.querySelector('.mobile-footer');
console.log('Footer element:', footer);

// Check screen size
console.log('Window width:', window.innerWidth);

// Check if authenticated
const user = await getCurrentUser();
console.log('Authenticated:', !!user);

// Check active screen
const activeScreen = document.querySelector('.screen.active');
console.log('Active screen:', activeScreen?.id);
```

**Footer shows when:**
- Window width <= 768px (mobile)
- User is authenticated
- NOT on excluded screens: 'login-screen', 'signup-screen', 'business-setup-screen'

**Fix:**
1. Resize window to mobile size (< 768px)
2. Make sure you're logged in
3. Make sure you're on home-screen or another non-excluded screen

---

## Issue 3: No Clients in Account

**Quick Check:**
```javascript
// Check IndexedDB
const clients = await window.indexedDBHelper.getClientsLocal('YOUR_USER_ID');
console.log('Clients in IndexedDB:', clients);

// Check if business exists
const user = await getCurrentUser();
const business = await getBusinessForUser(user.id);
console.log('Business:', business);

// If no business, create one first
// If business exists but no clients, try reconciliation:
if (business) {
    const result = await window.reconciliation.reconcileClients(business.id);
    console.log('Reconciliation result:', result);
}
```

**Possible Causes:**
1. IndexedDB was cleared
2. Business doesn't exist
3. Clients exist but need to be synced

**Fix:**
1. Create business first (if doesn't exist)
2. Run reconciliation to sync from Supabase
3. Check Supabase directly: `SELECT * FROM clients WHERE business_id = 'YOUR_BUSINESS_ID'`

---

## Issue 4: Cannot Create Measurement

**Quick Check:**
```javascript
// Check if business exists
const user = await getCurrentUser();
const business = await getBusinessForUser(user.id);
console.log('Business:', business);

// Check if clients exist
const clients = await getClients();
console.log('Clients:', clients);

// Try to create client manually
try {
    const client = await findOrCreateClient('Test Client', '1234567890', 'M');
    console.log('Client created:', client);
} catch (err) {
    console.error('Error creating client:', err);
}
```

**Possible Causes:**
1. Business doesn't exist - Create business first
2. Client creation failing - Check error message
3. Business not linked to user_id

**Fix:**
1. Make sure business exists: `SELECT * FROM businesses WHERE user_id = 'YOUR_USER_ID'`
2. If no business, create via UI
3. If business exists but not linked, run: `UPDATE businesses SET user_id = 'YOUR_USER_ID' WHERE id = 'BUSINESS_ID'`

---

## Quick Recovery Steps

1. **Clear Everything and Start Fresh:**
```javascript
// Clear IndexedDB
await window.indexedDBHelper.clearAllStores();

// Clear localStorage
localStorage.clear();

// Reload page
window.location.reload();
```

2. **Re-seed from Supabase:**
```javascript
const user = await getCurrentUser();
await seedIndexedDBFromSupabase(user.id);
```

3. **Manual Sync:**
```javascript
const user = await getCurrentUser();
const business = await getBusinessForUser(user.id);
if (business) {
    await window.reconciliation.reconcileAll(business.id);
}
```

---

## Common SQL Fixes

**Link existing business to user:**
```sql
UPDATE businesses 
SET user_id = 'YOUR_USER_ID_HERE' 
WHERE id = 'YOUR_BUSINESS_ID_HERE';
```

**Link existing clients to business:**
```sql
UPDATE clients 
SET business_id = 'YOUR_BUSINESS_ID_HERE',
    user_id = 'YOUR_USER_ID_HERE'
WHERE id IN ('CLIENT_ID_1', 'CLIENT_ID_2', ...);
```

**Check data:**
```sql
-- Check business
SELECT * FROM businesses WHERE user_id = 'YOUR_USER_ID_HERE';

-- Check clients
SELECT * FROM clients WHERE business_id = 'YOUR_BUSINESS_ID_HERE';

-- Check measurements
SELECT * FROM measurements WHERE business_id = 'YOUR_BUSINESS_ID_HERE';
```

