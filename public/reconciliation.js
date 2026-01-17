// ============================================
// RECONCILIATION MODULE - STRICT DATA INTEGRITY
// Diff-based sync with UUID identity preservation
// ============================================

// Generate UUID (must match indexeddb.js)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch (err) {
        return null;
    }
}

// Get business for user (strict: must exist)
async function getBusinessForUser(userId) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    return data;
}

// Check if online
function isOnline() {
    return navigator.onLine;
}

// ============================================
// RECONCILIATION: CLIENTS
// ============================================

/**
 * Reconcile clients between Supabase and IndexedDB
 * STRICT: Only works within business_id scope
 * NEVER creates new UUIDs, NEVER auto-merges different UUIDs
 */
async function reconcileClients(businessId) {
    if (!isOnline()) {
        console.warn('[Reconcile] Cannot reconcile while offline');
        return { pushed: 0, pulled: 0, updated: 0 };
    }

    if (!businessId) {
        throw new Error('CRITICAL: business_id is required for reconciliation');
    }

    const supabase = getSupabase();
    if (!supabase) {
        throw new Error('CRITICAL: Supabase client not available');
    }

    if (!window.indexedDBHelper) {
        throw new Error('CRITICAL: IndexedDB helper not available');
    }

    const user = await getCurrentUser();
    if (!user) {
        throw new Error('CRITICAL: User not authenticated');
    }

    try {
        // STEP 1: Fetch all remote records by business_id (STRICT SCOPE)
        console.log('[Reconcile] Fetching remote clients for business_id:', businessId);
        const { data: remoteClients, error: remoteError } = await supabase
            .from('clients')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });

        if (remoteError) {
            throw new Error(`Failed to fetch remote clients: ${remoteError.message}`);
        }

        // STEP 2: Fetch all local records by business_id (STRICT SCOPE)
        console.log('[Reconcile] Fetching local clients for business_id:', businessId);
        const allLocalClients = await window.indexedDBHelper.getClientsLocal(user.id);
        const localClients = allLocalClients.filter(c => c.business_id === businessId);

        // STEP 3: Diff by UUID (strict identity matching)
        const remoteIds = new Set((remoteClients || []).map(c => c.id));
        const localIds = new Set(localClients.map(c => c.server_id || c.id));

        // local ∖ remote → push (local-only UUIDs or unsynced items)
        const toPush = localClients.filter(local => {
            const id = local.server_id || local.id;
            // Push if: NOT in remote AND (either unsynced or created offline)
            const isUnsynced = local.synced === false || local.created_offline === true || !local.synced;
            return !remoteIds.has(id) && isUnsynced;
        });

        // remote ∖ local → pull (remote-only UUIDs)
        const toPull = (remoteClients || []).filter(remote => !localIds.has(remote.id));

        // intersection → compare updated_at (same UUID exists in both)
        const toUpdate = [];
        for (const remote of remoteClients || []) {
            const local = localClients.find(l => (l.server_id || l.id) === remote.id);
            if (local) {
                // Both exist - compare updated_at
                const remoteUpdated = new Date(remote.updated_at || remote.created_at);
                const localUpdated = new Date(local.updated_at || local.created_at || local.createdAt);

                if (remoteUpdated > localUpdated) {
                    // Remote is newer - pull (update local)
                    toUpdate.push({ action: 'pull', remote, local });
                } else if (localUpdated > remoteUpdated && !local.synced) {
                    // Local is newer and unsynced - push (update remote)
                    toUpdate.push({ action: 'push', remote, local });
                }
            }
        }

        console.log('[Reconcile] Clients diff - Push:', toPush.length, 'Pull:', toPull.length, 'Update:', toUpdate.length);

        // STEP 4: Push local-only clients
        let pushed = 0;
        for (const local of toPush) {
            try {
                // STRICT: Verify business_id exists before insert
                const { data: businessCheck } = await supabase
                    .from('businesses')
                    .select('id')
                    .eq('id', businessId)
                    .single();

                if (!businessCheck) {
                    console.error('[Reconcile] CRITICAL: Business not found, skipping client push:', local.id);
                    continue;
                }

                // Use existing UUID (NEVER generate new)
                const { data, error } = await supabase
                    .from('clients')
                    .upsert({
                        // id intentionally omitted - Supabase generates it
                        user_id: user.id,
                        business_id: businessId,
                        name: local.name,
                        phone: local.phone || null,
                        sex: local.sex || null
                    })
                    .select()
                    .maybeSingle();

                if (error) {
                    console.error('[Reconcile] Error pushing client:', error);
                    continue;
                }

                // Mark as synced in IndexedDB
                await window.indexedDBHelper.markClientSynced(local.local_id, data.id);
                pushed++;
            } catch (err) {
                console.error('[Reconcile] Error pushing client:', err);
            }
        }

        // STEP 5: Pull remote-only clients
        let pulled = 0;
        for (const remote of toPull) {
            try {
                // Save to IndexedDB with existing UUID (NEVER generate new)
                await window.indexedDBHelper.saveClientLocal({
                    server_id: remote.id, // UUID from server, NEVER regenerate
                    name: remote.name,
                    phone: remote.phone || null,
                    sex: remote.sex || null,
                    created_at: remote.created_at,
                    synced: true // Already on server
                }, user.id, businessId);
                pulled++;
            } catch (err) {
                console.error('[Reconcile] Error pulling client:', err);
            }
        }

        // STEP 6: Update conflicting records
        let updated = 0;
        for (const { action, remote, local } of toUpdate) {
            try {
                if (action === 'pull') {
                    // Update local from remote
                    await window.indexedDBHelper.updateClientLocal(local.local_id, {
                        name: remote.name,
                        phone: remote.phone || null,
                        sex: remote.sex || null
                    }, user.id);
                    // Mark as synced
                    await window.indexedDBHelper.markClientSynced(local.local_id, remote.id);
                    updated++;
                } else if (action === 'push') {
                    // Update remote from local
                    const { error } = await supabase
                        .from('clients')
                        .update({
                            name: local.name,
                            phone: local.phone || null,
                            sex: local.sex || null
                        })
                        .eq('id', remote.id)
                        .eq('business_id', businessId);

                    if (!error) {
                        await window.indexedDBHelper.markClientSynced(local.local_id, remote.id);
                        updated++;
                    }
                }
            } catch (err) {
                console.error('[Reconcile] Error updating client:', err);
            }
        }

        console.log('[Reconcile] Clients reconciliation complete - Pushed:', pushed, 'Pulled:', pulled, 'Updated:', updated);
        return { pushed, pulled, updated };
    } catch (err) {
        console.error('[Reconcile] Error reconciling clients:', err);
        throw err;
    }
}

// ============================================
// RECONCILIATION: MEASUREMENTS
// ============================================

/**
 * Reconcile measurements between Supabase and IndexedDB
 * STRICT: Only works within business_id scope
 * NEVER creates new UUIDs, NEVER auto-merges different UUIDs
 */
async function reconcileMeasurements(businessId, clientId = null) {
    if (!isOnline()) {
        console.warn('[Reconcile] Cannot reconcile while offline');
        return { pushed: 0, pulled: 0, updated: 0 };
    }

    if (!businessId) {
        throw new Error('CRITICAL: business_id is required for reconciliation');
    }

    const supabase = getSupabase();
    if (!supabase) {
        throw new Error('CRITICAL: Supabase client not available');
    }

    if (!window.indexedDBHelper) {
        throw new Error('CRITICAL: IndexedDB helper not available');
    }

    const user = await getCurrentUser();
    if (!user) {
        throw new Error('CRITICAL: User not authenticated');
    }

    try {
        // STEP 1: Fetch all remote records by business_id (STRICT SCOPE)
        // If clientId provided, filter by client_id as well
        console.log('[Reconcile] Fetching remote measurements for business_id:', businessId, clientId ? `client_id: ${clientId}` : '');
        let query = supabase
            .from('measurements')
            .select('*')
            .eq('business_id', businessId);

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        const { data: remoteMeasurements, error: remoteError } = await query.order('created_at', { ascending: false });

        if (remoteError) {
            throw new Error(`Failed to fetch remote measurements: ${remoteError.message}`);
        }

        // STEP 2: Fetch all local records by business_id (STRICT SCOPE)
        console.log('[Reconcile] Fetching local measurements for business_id:', businessId);
        const allLocalMeasurements = await window.indexedDBHelper.getMeasurementsLocal(user.id);
        let localMeasurements = allLocalMeasurements.filter(m => {
            // Match by business_id from IndexedDB
            // Note: IndexedDB stores business_id, so we need to check if it matches
            return m.business_id === businessId;
        });

        // If clientId provided, filter local as well
        if (clientId) {
            localMeasurements = localMeasurements.filter(m => m.client_id === clientId || (m.server_id && m.client_id === clientId));
        }

        // STEP 3: Diff by UUID (strict identity matching)
        const remoteIds = new Set((remoteMeasurements || []).map(m => m.id));
        const localIds = new Set(localMeasurements.map(m => m.server_id || m.id));

        // local ∖ remote → push (local-only UUIDs or unsynced items)
        const toPush = localMeasurements.filter(local => {
            const id = local.server_id || local.id;
            // Push if: NOT in remote AND (either unsynced or created offline)
            const isUnsynced = local.synced === false || local.created_offline === true || !local.synced;
            return !remoteIds.has(id) && isUnsynced;
        });

        // remote ∖ local → pull (remote-only UUIDs)
        const toPull = (remoteMeasurements || []).filter(remote => !localIds.has(remote.id));

        // intersection → compare updated_at (same UUID exists in both)
        const toUpdate = [];
        for (const remote of remoteMeasurements || []) {
            const local = localMeasurements.find(l => (l.server_id || l.id) === remote.id);
            if (local) {
                // Both exist - compare updated_at
                const remoteUpdated = new Date(remote.updated_at || remote.created_at);
                const localUpdated = new Date(local.updated_at || local.date_created || local.created_at);

                if (remoteUpdated > localUpdated) {
                    // Remote is newer - pull (update local)
                    toUpdate.push({ action: 'pull', remote, local });
                } else if (localUpdated > remoteUpdated && !local.synced) {
                    // Local is newer and unsynced - push (update remote)
                    toUpdate.push({ action: 'push', remote, local });
                }
            }
        }

        console.log('[Reconcile] Measurements diff - Push:', toPush.length, 'Pull:', toPull.length, 'Update:', toUpdate.length);

        // STEP 4: Push local-only measurements
        let pushed = 0;
        for (const local of toPush) {
            try {
                // STRICT: Verify business_id and client_id exist before insert
                const [businessCheck, clientCheck] = await Promise.all([
                    supabase.from('businesses').select('id').eq('id', businessId).single(),
                    supabase.from('clients').select('id, business_id').eq('id', local.client_id).eq('business_id', businessId).single()
                ]);

                if (!businessCheck.data || !clientCheck.data || clientCheck.data.business_id !== businessId) {
                    console.error('[Reconcile] CRITICAL: Parent verification failed, skipping measurement push:', local.id);
                    continue;
                }

                // Use existing UUID (NEVER generate new)
                const { data, error } = await supabase
                    .from('measurements')
                    .upsert({
                        // id intentionally omitted - Supabase generates it
                        user_id: user.id,
                        business_id: businessId,
                        client_id: local.client_id,
                        garment_type: local.garment_type || null,
                        shoulder: local.shoulder || null,
                        chest: local.chest || null,
                        waist: local.waist || null,
                        sleeve: local.sleeve || null,
                        length: local.length || null,
                        neck: local.neck || null,
                        hip: local.hip || null,
                        inseam: local.inseam || null,
                        thigh: local.thigh || null,
                        seat: local.seat || null,
                        notes: local.notes || null,
                        custom_fields: local.customFields || local.custom_fields || {}
                    })
                    .select()
                    .maybeSingle();

                if (error) {
                    console.error('[Reconcile] Error pushing measurement:', error);
                    continue;
                }

                // Mark as synced in IndexedDB
                await window.indexedDBHelper.markMeasurementSynced(local.local_id, data.id);
                pushed++;
            } catch (err) {
                console.error('[Reconcile] Error pushing measurement:', err);
            }
        }

        // STEP 5: Pull remote-only measurements
        let pulled = 0;
        for (const remote of toPull) {
            try {
                // Save to IndexedDB with existing UUID (NEVER generate new)
                await window.indexedDBHelper.saveMeasurementLocal({
                    server_id: remote.id, // UUID from server, NEVER regenerate
                    client_id: remote.client_id,
                    garment_type: remote.garment_type || null,
                    shoulder: remote.shoulder || null,
                    chest: remote.chest || null,
                    waist: remote.waist || null,
                    sleeve: remote.sleeve || null,
                    length: remote.length || null,
                    neck: remote.neck || null,
                    hip: remote.hip || null,
                    inseam: remote.inseam || null,
                    thigh: remote.thigh || null,
                    seat: remote.seat || null,
                    notes: remote.notes || null,
                    custom_fields: remote.custom_fields || {},
                    created_at: remote.created_at,
                    synced: true // Already on server
                }, user.id, businessId);
                pulled++;
            } catch (err) {
                console.error('[Reconcile] Error pulling measurement:', err);
            }
        }

        // STEP 6: Update conflicting records
        let updated = 0;
        for (const { action, remote, local } of toUpdate) {
            try {
                if (action === 'pull') {
                    // Update local from remote
                    await window.indexedDBHelper.updateMeasurementLocal(local.local_id, {
                        garment_type: remote.garment_type || null,
                        shoulder: remote.shoulder || null,
                        chest: remote.chest || null,
                        waist: remote.waist || null,
                        sleeve: remote.sleeve || null,
                        length: remote.length || null,
                        neck: remote.neck || null,
                        hip: remote.hip || null,
                        inseam: remote.inseam || null,
                        thigh: remote.thigh || null,
                        seat: remote.seat || null,
                        notes: remote.notes || null,
                        custom_fields: remote.custom_fields || {}
                    }, user.id);
                    // Mark as synced
                    await window.indexedDBHelper.markMeasurementSynced(local.local_id, remote.id);
                    updated++;
                } else if (action === 'push') {
                    // Update remote from local
                    // Update remote from local using upsert to avoid PGRST116
                    const { error } = await supabase
                        .from('measurements')
                        .upsert({
                            id: remote.id,
                            user_id: user.id,
                            business_id: businessId,
                            client_id: local.client_id || remote.client_id,
                            garment_type: local.garment_type || null,
                            shoulder: local.shoulder || null,
                            chest: local.chest || null,
                            waist: local.waist || null,
                            sleeve: local.sleeve || null,
                            length: local.length || null,
                            neck: local.neck || null,
                            hip: local.hip || null,
                            inseam: local.inseam || null,
                            thigh: local.thigh || null,
                            seat: local.seat || null,
                            notes: local.notes || null,
                            custom_fields: local.customFields || local.custom_fields || {}
                        });

                    if (!error) {
                        await window.indexedDBHelper.markMeasurementSynced(local.local_id, remote.id);
                        updated++;
                    }
                }
            } catch (err) {
                console.error('[Reconcile] Error updating measurement:', err);
            }
        }

        console.log('[Reconcile] Measurements reconciliation complete - Pushed:', pushed, 'Pulled:', pulled, 'Updated:', updated);
        return { pushed, pulled, updated };
    } catch (err) {
        console.error('[Reconcile] Error reconciling measurements:', err);
        throw err;
    }
}

// ============================================
// RECONCILIATION: FULL SYNC (All entities)
// ============================================

/**
 * Full reconciliation - clients first, then measurements
 * STRICT: Only works within business_id scope
 */
async function reconcileAll(businessId) {
    if (!businessId) {
        throw new Error('CRITICAL: business_id is required for reconciliation');
    }

    console.log('[Reconcile] Starting full reconciliation for business_id:', businessId);

    // Reconcile clients first (measurements depend on clients)
    const clientsResult = await reconcileClients(businessId);

    // Then reconcile measurements
    const measurementsResult = await reconcileMeasurements(businessId);

    console.log('[Reconcile] Full reconciliation complete:', {
        clients: clientsResult,
        measurements: measurementsResult
    });

    return {
        clients: clientsResult,
        measurements: measurementsResult
    };
}

// Export reconciliation functions
if (typeof window !== 'undefined') {
    window.reconciliation = {
        reconcileClients,
        reconcileMeasurements,
        reconcileAll
    };
}

