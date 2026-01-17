// ============================================
// IMMEDIATE SYNC - Push to Supabase on Creation
// This is NOT background sync - it's immediate sync when creating data
// ============================================

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

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch (err) {
        return null;
    }
}

// Check if online
function isOnline() {
    return navigator.onLine;
}

/**
 * Immediately sync client to Supabase after creation
 * This ensures data is available on other devices
 */
async function syncClientImmediately(client, userId, businessId) {
    if (!isOnline()) {
        console.log('[ImmediateSync] Offline - client will sync later via reconciliation');
        return { synced: false, id: client.server_id || client.local_id };
    }

    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[ImmediateSync] Supabase not available');
        return { synced: false, id: client.server_id || client.local_id };
    }

    try {
        // STRICT: Verify business exists before inserting client
        const { data: businessCheck, error: businessError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', businessId)
            .single();

        if (businessError || !businessCheck) {
            console.error('[ImmediateSync] Business not found, cannot sync client:', businessError);
            return { synced: false, id: client.server_id || client.local_id };
        }

        // UPSERT logic: Use server_id if it exists, otherwise omit to let Supabase generate it
        const payload = {
            user_id: userId,
            business_id: businessId,
            name: client.name,
            phone: client.phone || null,
            sex: client.sex || null
        };
        if (client.server_id) {
            payload.id = client.server_id;
        }

        const { data, error } = await supabase
            .from('clients')
            .upsert(payload)
            .select()
            .maybeSingle();

        if (error) {
            console.error('[ImmediateSync] Error syncing client:', error);
            return { synced: false, id: client.server_id || client.local_id };
        }

        if (data) {
            // Mark as synced in IndexedDB
            await window.indexedDBHelper.markClientSynced(client.local_id, data.id);
            console.log('[ImmediateSync] Client synced to Supabase:', data.id);
            return { synced: true, id: data.id };
        }

        return { synced: false, id: client.server_id || client.local_id };
    } catch (err) {
        console.error('[ImmediateSync] Error syncing client:', err);
        return { synced: false, id: client.server_id || client.local_id };
    }
}

/**
 * Immediately sync measurement to Supabase after creation
 * This ensures data is available on other devices
 */
async function syncMeasurementImmediately(measurement, userId, businessId, clientId) {
    if (!isOnline()) {
        console.log('[ImmediateSync] Offline - measurement will sync later via reconciliation');
        return { synced: false, id: measurement.server_id || measurement.local_id };
    }

    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[ImmediateSync] Supabase not available');
        return { synced: false, id: measurement.server_id || measurement.local_id };
    }

    try {
        // STRICT: Verify business and client exist before inserting measurement
        const [businessCheck, clientCheck] = await Promise.all([
            supabase.from('businesses').select('id').eq('id', businessId).single(),
            supabase.from('clients').select('id, business_id').eq('id', clientId).eq('business_id', businessId).single()
        ]);

        if (businessCheck.error || !businessCheck.data) {
            console.error('[ImmediateSync] Business not found, cannot sync measurement');
            return { synced: false, id: measurement.server_id || measurement.local_id };
        }

        if (clientCheck.error || !clientCheck.data || clientCheck.data.business_id !== businessId) {
            console.error('[ImmediateSync] Client not found or belongs to different business, cannot sync measurement');
            return { synced: false, id: measurement.server_id || measurement.local_id };
        }

        const measurementId = measurement.server_id || measurement.local_id;

        const measurementData = {
            user_id: userId,
            business_id: businessId,
            client_id: clientId,
            garment_type: measurement.garment_type || null,
            shoulder: measurement.shoulder || null,
            chest: measurement.chest || null,
            waist: measurement.waist || null,
            sleeve: measurement.sleeve || null,
            length: measurement.length || null,
            neck: measurement.neck || null,
            hip: measurement.hip || null,
            inseam: measurement.inseam || null,
            thigh: measurement.thigh || null,
            seat: measurement.seat || null,
            notes: measurement.notes || null,
            custom_fields: measurement.custom_fields || {}
        };

        let data, error;

        // If the measurement already has a server_id and was synced, update it
        if (measurement.synced && measurement.server_id) {
            console.log('[ImmediateSync] Upserting existing measurement:', measurementId);
            const updateResult = await supabase
                .from('measurements')
                .upsert({ id: measurement.server_id, ...measurementData })
                .select()
                .maybeSingle();
            data = updateResult.data;
            error = updateResult.error;
        } else {
            // Brand new measurement or retry of unsynced insert
            console.log('[ImmediateSync] Upserting new measurement');
            const insertResult = await supabase
                .from('measurements')
                .upsert(measurementData) // id omitted
                .select()
                .maybeSingle();
            data = insertResult.data;
            error = insertResult.error;

            if (error && error.code === '23505' && measurement.server_id) {
                console.log('[ImmediateSync] Conflict detected on insert, retrying with ID');
                const retryResult = await supabase
                    .from('measurements')
                    .upsert({ id: measurement.server_id, ...measurementData })
                    .select()
                    .maybeSingle();
                data = retryResult.data;
                error = retryResult.error;
            }
        }

        if (error) {
            console.error('[ImmediateSync] Error syncing measurement:', error);
            return { synced: false, id: measurementId };
        }

        if (data) {
            // Mark as synced in IndexedDB
            await window.indexedDBHelper.markMeasurementSynced(measurement.local_id, data.id);
            console.log('[ImmediateSync] Measurement synced to Supabase:', data.id);
            return { synced: true, id: data.id };
        }

        return { synced: false, id: measurement.server_id || measurement.local_id };
    } catch (err) {
        console.error('[ImmediateSync] Error syncing measurement:', err);
        return { synced: false, id: measurement.server_id || measurement.local_id };
    }
}

// Export functions
if (typeof window !== 'undefined') {
    window.immediateSync = {
        syncClientImmediately,
        syncMeasurementImmediately
    };
}

