// Silent Background Sync Manager
// Handles syncing local IndexedDB data to Supabase without any UI indicators

const SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes
let syncIntervalId = null;
let isSyncing = false;

// Check if online
function isOnline() {
    return navigator.onLine;
}

// Get Supabase client
function getSupabase() {
    if (typeof window !== 'undefined' && window.supabaseClient) {
        return window.supabaseClient;
    }
    return null;
}

// Get current user
async function getCurrentUser() {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Get business for user
async function getBusinessForUser(userId) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();
    
    if (error || !data) return null;
    return data;
}

// Resolve client ID for sync (convert local_id to server_id if needed)
async function resolveClientIdForSync(clientId, userId) {
    if (!window.indexedDBHelper) return clientId;
    
    try {
        // If it's a UUID format, it might be a local_id
        const client = await window.indexedDBHelper.getClientLocal(clientId, userId);
        if (client && client.local_id === clientId && client.server_id && client.id !== clientId) {
            // This is a local_id, return the server_id
            return client.server_id || client.id;
        }
        // Otherwise, it's already a server_id or doesn't exist
        return clientId;
    } catch (err) {
        console.warn('[Sync] Error resolving client ID:', err);
        return clientId; // Return original ID on error
    }
}

// BACKGROUND SYNC DISABLED - This function is kept for compatibility but should not be called
// All sync must be explicit via reconciliation function
async function syncClient(client, userId, businessId) {
    console.warn('[Sync] syncClient called but background sync is DISABLED');
    return false;
    
    // CODE BELOW DISABLED - Background sync not allowed
    /*
    const supabase = getSupabase();
    if (!supabase) return false;

    // STRICT GUARD: Verify business_id exists before insert
    if (!businessId) {
        console.error('[Sync] CRITICAL: Cannot sync client without business_id');
        return false;
    }

    try {
        if (client.server_id) {
            // Update existing client - STRICT: Use business_id scope
            const { data, error } = await supabase
                .from('clients')
                .update({
                    name: client.name,
                    phone: client.phone || null,
                    sex: client.sex || null
                })
                .eq('id', client.server_id)
                .eq('business_id', businessId) // STRICT: Always use business_id scope
                .select()
                .single();

            if (error) throw error;
            return true;
        } else {
            // Create new client - STRICT: Verify business_id exists first
            // Verify business exists before insert
            const { data: businessCheck, error: businessError } = await supabase
                .from('businesses')
                .select('id')
                .eq('id', businessId)
                .single();
            
            if (businessError || !businessCheck) {
                console.error('[Sync] CRITICAL: Business not found, cannot create client');
                throw new Error('Business not found');
            }
            
            // Generate UUID ONCE (if not already set)
            const clientId = client.server_id || generateUUID();
            
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    id: clientId, // UUID generated ONCE
                    user_id: userId,
                    business_id: businessId,
                    name: client.name,
                    phone: client.phone || null,
                    sex: client.sex || null
                }])
                .select()
                .single();

            if (error) throw error;

            // Mark as synced in IndexedDB
            await window.indexedDBHelper.markClientSynced(client.local_id, data.id);
            return true;
        }
    } catch (error) {
        console.warn('[Sync] Failed to sync client:', client.local_id, error);
        return false;
    }
    */
}

// BACKGROUND SYNC DISABLED - This function is kept for compatibility but should not be called
// All sync must be explicit via reconciliation function
async function syncMeasurement(measurement, userId, businessId) {
    console.warn('[Sync] syncMeasurement called but background sync is DISABLED');
    return false;
    
    // CODE BELOW DISABLED - Background sync not allowed
    /*
    const supabase = getSupabase();
    if (!supabase) return false;

    // STRICT GUARD: Verify business_id and client_id exist before insert
    if (!businessId) {
        console.error('[Sync] CRITICAL: Cannot sync measurement without business_id');
        return false;
    }

    try {
        // Resolve client_id (convert local_id to server_id if needed)
        const resolvedClientId = await resolveClientIdForSync(measurement.client_id, userId);
        if (!resolvedClientId) {
            console.error('[Sync] CRITICAL: Cannot sync measurement: client_id not found');
            return false;
        }

        // STRICT GUARD: Verify client belongs to business
        const { data: clientCheck, error: clientError } = await supabase
            .from('clients')
            .select('id, business_id')
            .eq('id', resolvedClientId)
            .eq('business_id', businessId)
            .single();
        
        if (clientError || !clientCheck || clientCheck.business_id !== businessId) {
            console.error('[Sync] CRITICAL: Client does not belong to business');
            return false;
        }

        if (measurement.server_id) {
            // Update existing measurement - STRICT: Use business_id scope
            const { data, error } = await supabase
                .from('measurements')
                .update({
                    garment_type: measurement.garment_type || null,
                    shoulder: measurement.shoulder ? parseFloat(measurement.shoulder) : null,
                    chest: measurement.chest ? parseFloat(measurement.chest) : null,
                    waist: measurement.waist ? parseFloat(measurement.waist) : null,
                    sleeve: measurement.sleeve ? parseFloat(measurement.sleeve) : null,
                    length: measurement.length ? parseFloat(measurement.length) : null,
                    neck: measurement.neck ? parseFloat(measurement.neck) : null,
                    hip: measurement.hip ? parseFloat(measurement.hip) : null,
                    inseam: measurement.inseam ? parseFloat(measurement.inseam) : null,
                    thigh: measurement.thigh ? parseFloat(measurement.thigh) : null,
                    seat: measurement.seat ? parseFloat(measurement.seat) : null,
                    notes: measurement.notes || null,
                    custom_fields: measurement.custom_fields || {}
                })
                .eq('id', measurement.server_id)
                .eq('business_id', businessId) // STRICT: Always use business_id scope
                .select()
                .single();

            if (error) throw error;
            return true;
        } else {
            // Create new measurement - STRICT: Verify parent UUIDs exist
            // Generate UUID ONCE (if not already set)
            const measurementId = measurement.server_id || generateUUID();
            
            const { data, error } = await supabase
                .from('measurements')
                .insert([{
                    id: measurementId, // UUID generated ONCE
                    user_id: userId,
                    business_id: businessId,
                    client_id: resolvedClientId,
                    garment_type: measurement.garment_type || null,
                    shoulder: measurement.shoulder ? parseFloat(measurement.shoulder) : null,
                    chest: measurement.chest ? parseFloat(measurement.chest) : null,
                    waist: measurement.waist ? parseFloat(measurement.waist) : null,
                    sleeve: measurement.sleeve ? parseFloat(measurement.sleeve) : null,
                    length: measurement.length ? parseFloat(measurement.length) : null,
                    neck: measurement.neck ? parseFloat(measurement.neck) : null,
                    hip: measurement.hip ? parseFloat(measurement.hip) : null,
                    inseam: measurement.inseam ? parseFloat(measurement.inseam) : null,
                    thigh: measurement.thigh ? parseFloat(measurement.thigh) : null,
                    seat: measurement.seat ? parseFloat(measurement.seat) : null,
                    notes: measurement.notes || null,
                    custom_fields: measurement.custom_fields || {}
                }])
                .select()
                .single();

            if (error) throw error;

            // Mark as synced in IndexedDB
            await window.indexedDBHelper.markMeasurementSynced(measurement.local_id, data.id);
            return true;
        }
    } catch (error) {
        console.warn('[Sync] Failed to sync measurement:', measurement.local_id, error);
        return false;
    }
    */
}

// BACKGROUND SYNC DISABLED - All functions below return immediately
// All sync must be explicit via reconciliation function

// Sync all unsynced clients - DISABLED
async function syncClients(userId, businessId) {
    console.warn('[Sync] syncClients called but background sync is DISABLED');
    return;
}

// Sync all unsynced measurements - DISABLED
async function syncMeasurements(userId, businessId) {
    console.warn('[Sync] syncMeasurements called but background sync is DISABLED');
    return;
}

// Main sync function - DISABLED
async function performSync() {
    console.warn('[Sync] performSync called but background sync is DISABLED');
    return;
}

// Start background sync - DISABLED
function startBackgroundSync() {
    console.warn('[Sync] startBackgroundSync called but background sync is DISABLED');
    // Do nothing - background sync is disabled
}

// Stop background sync - DISABLED
function stopBackgroundSync() {
    console.warn('[Sync] stopBackgroundSync called but background sync is DISABLED');
    // Do nothing - background sync is disabled
}

// Export functions
if (typeof window !== 'undefined') {
    window.syncManager = {
        startBackgroundSync,
        stopBackgroundSync,
        performSync
    };
}

