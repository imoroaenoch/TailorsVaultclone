# Insert Guards Analysis

## Files with Insert Operations:

### public/app.js
1. `findOrCreateClient` (line 1545) - Creates client
   - NEEDS GUARD: Verify business_id exists before insert
   
2. `saveMeasurement` (line 1813) - Creates/updates measurement
   - NEEDS GUARD: Verify business_id AND client_id exist before insert
   
3. Business creation (line 3774) - Creates business
   - NEEDS GUARD: Verify user_id exists, enforce UNIQUE(user_id)

### public/sync-manager.js  
4. `syncClient` (line 66) - Syncs client to Supabase
   - NEEDS GUARD: Verify business_id exists before insert
   
5. `syncMeasurement` (line 114) - Syncs measurement to Supabase
   - NEEDS GUARD: Verify business_id AND client_id exist before insert

### public/indexeddb.js
6. `saveClientLocal` (line 85) - Saves client to IndexedDB
   - NEEDS GUARD: Verify business_id is valid UUID, not null
   
7. `saveMeasurementLocal` (line 418) - Saves measurement to IndexedDB
   - NEEDS GUARD: Verify business_id AND client_id are valid UUIDs

## Fetch Query Issues:

### public/app.js - Need to fix to use business_id:
- Line 5715: Fetch clients by user_id (should use business_id)
- Line 5783: Fetch measurements by user_id (should use business_id)

## Background Sync:
- public/sync-manager.js - DISABLE completely
- Remove all syncManager calls from app.js

