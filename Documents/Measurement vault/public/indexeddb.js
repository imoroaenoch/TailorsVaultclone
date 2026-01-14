// IndexedDB Helper Module for Local-First Architecture
// This module provides a simple interface to IndexedDB for storing clients, measurements, and sync queue

const DB_NAME = 'tailors_vault_db';
const DB_VERSION = 1;

// Store names
const STORE_CLIENTS = 'clients';
const STORE_MEASUREMENTS = 'measurements';
const STORE_SYNC_QUEUE = 'sync_queue';

let dbInstance = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[IndexedDB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            console.log('[IndexedDB] Database opened successfully');
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create clients store
            if (!db.objectStoreNames.contains(STORE_CLIENTS)) {
                const clientsStore = db.createObjectStore(STORE_CLIENTS, { keyPath: 'local_id' });
                clientsStore.createIndex('server_id', 'server_id', { unique: false });
                clientsStore.createIndex('synced', 'synced', { unique: false });
                clientsStore.createIndex('user_id', 'user_id', { unique: false });
                clientsStore.createIndex('business_id', 'business_id', { unique: false }); // STRICT: For business_id scope queries
            }
            // Note: For existing databases, business_id indexes will be created on next version upgrade.
            // getClientsByBusinessId will fallback to scanning if index doesn't exist.

            // Create measurements store
            if (!db.objectStoreNames.contains(STORE_MEASUREMENTS)) {
                const measurementsStore = db.createObjectStore(STORE_MEASUREMENTS, { keyPath: 'local_id' });
                measurementsStore.createIndex('server_id', 'server_id', { unique: false });
                measurementsStore.createIndex('synced', 'synced', { unique: false });
                measurementsStore.createIndex('user_id', 'user_id', { unique: false });
                measurementsStore.createIndex('business_id', 'business_id', { unique: false }); // STRICT: For business_id scope queries
                measurementsStore.createIndex('client_id', 'client_id', { unique: false });
                measurementsStore.createIndex('business_client', ['business_id', 'client_id'], { unique: false }); // Composite index for strict scope
            }
            // Note: For existing databases, business_id indexes will be created on next version upgrade.
            // getMeasurementsByBusinessId will fallback to scanning if index doesn't exist.

            // Create sync_queue store
            if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
                const syncQueueStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
                syncQueueStore.createIndex('type', 'type', { unique: false });
                syncQueueStore.createIndex('synced', 'synced', { unique: false });
            }
        };
    });
}

// Get database instance
async function getDB() {
    if (!dbInstance) {
        await initDB();
    }
    return dbInstance;
}

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ========== CLIENTS OPERATIONS ==========

// Save client to IndexedDB
// STRICT: business_id MUST be valid UUID before insert
async function saveClientLocal(clientData, userId, businessId) {
    // STRICT GUARD: Verify business_id is valid UUID
    if (!businessId) {
        throw new Error('CRITICAL: business_id is required');
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(businessId)) {
        throw new Error('CRITICAL: business_id must be valid UUID format');
    }
    
    // STRICT: UUID generated ONCE - use server_id if provided, otherwise generate
    // NEVER regenerate if server_id exists
    const serverId = clientData.server_id || generateUUID();
    const localId = clientData.local_id || serverId; // Use server_id as local_id if no local_id
    
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS], 'readwrite');
    const store = transaction.objectStore(STORE_CLIENTS);

    const client = {
        local_id: localId,
        server_id: serverId, // UUID generated ONCE
        user_id: userId,
        business_id: businessId, // MUST be valid UUID
        name: clientData.name,
        phone: clientData.phone || null,
        sex: clientData.sex || null,
        synced: clientData.synced !== undefined ? clientData.synced : false,
        created_at: clientData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const request = store.put(client);
        request.onsuccess = () => {
            resolve({ ...client, id: client.server_id || client.local_id });
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Get all clients from IndexedDB (by user_id - for compatibility)
async function getClientsLocal(userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS], 'readonly');
    const store = transaction.objectStore(STORE_CLIENTS);
    const index = store.index('user_id');

    return new Promise((resolve, reject) => {
        const request = index.getAll(userId);
        request.onsuccess = () => {
            const clients = request.result.map(c => ({
                id: c.server_id || c.local_id, // Prefer server_id, fallback to local_id
                server_id: c.server_id || null, // Include server_id explicitly
                local_id: c.local_id, // Always include local_id for matching
                business_id: c.business_id, // Include business_id for strict scope
                user_id: c.user_id, // Include user_id
                name: c.name,
                phone: c.phone || '',
                sex: c.sex || '',
                createdAt: c.created_at,
                synced: c.synced
            }));
            resolve(clients);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// STRICT: Get clients by business_id scope only
async function getClientsByBusinessId(businessId) {
    if (!businessId) {
        throw new Error('CRITICAL: business_id is required');
    }
    
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS], 'readonly');
    const store = transaction.objectStore(STORE_CLIENTS);

    return new Promise((resolve, reject) => {
        // Use business_id index if available, otherwise scan
        if (store.indexNames.contains('business_id')) {
            const index = store.index('business_id');
            const request = index.getAll(businessId);
            
            request.onsuccess = () => {
                const clients = request.result.map(c => ({
                    id: c.server_id || c.local_id,
                    server_id: c.server_id || null,
                    local_id: c.local_id,
                    business_id: c.business_id,
                    name: c.name,
                    phone: c.phone || '',
                    sex: c.sex || '',
                    createdAt: c.created_at,
                    synced: c.synced
                }));
                resolve(clients);
            };
            request.onerror = () => reject(request.error);
        } else {
            // Fallback: Scan all clients and filter by business_id
            const request = store.openCursor();
            const clients = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const client = cursor.value;
                    if (client.business_id === businessId) {
                        clients.push({
                            id: client.server_id || client.local_id,
                            server_id: client.server_id || null,
                            local_id: client.local_id,
                            business_id: client.business_id,
                            name: client.name,
                            phone: client.phone || '',
                            sex: client.sex || '',
                            createdAt: client.created_at,
                            synced: client.synced
                        });
                    }
                    cursor.continue();
                } else {
                    resolve(clients);
                }
            };
            request.onerror = () => reject(request.error);
        }
    });
}

// Get client by local_id or server_id
async function getClientLocal(identifier, userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS], 'readonly');
    const store = transaction.objectStore(STORE_CLIENTS);

    return new Promise((resolve, reject) => {
        // Try by local_id first
        const request = store.get(identifier);
        request.onsuccess = () => {
            if (request.result && (!userId || request.result.user_id === userId)) {
                const client = request.result;
                resolve({
                    id: client.server_id || client.local_id, // Prefer server_id, fallback to local_id
                    server_id: client.server_id || null, // Include server_id explicitly
                    local_id: client.local_id, // Always include local_id for matching
                    business_id: client.business_id, // Include business_id (CRITICAL)
                    user_id: client.user_id, // Include user_id (CRITICAL)
                    name: client.name,
                    phone: client.phone || '',
                    sex: client.sex || '',
                    createdAt: client.created_at,
                    synced: client.synced
                });
            } else {
                // Try by server_id
                if (store.indexNames.contains('server_id')) {
                    const index = store.index('server_id');
                    const indexRequest = index.getAll(identifier);
                    indexRequest.onsuccess = () => {
                        const client = indexRequest.result.find(c => !userId || c.user_id === userId);
                        if (client) {
                            resolve({
                                id: client.server_id || client.local_id, // Prefer server_id, fallback to local_id
                                server_id: client.server_id || null, // Include server_id explicitly
                                local_id: client.local_id, // Always include local_id for matching
                                business_id: client.business_id, // Include business_id (CRITICAL)
                                user_id: client.user_id, // Include user_id (CRITICAL)
                                name: client.name,
                                phone: client.phone || '',
                                sex: client.sex || '',
                                createdAt: client.created_at,
                                synced: client.synced
                            });
                        } else {
                            resolve(null);
                        }
                    };
                    indexRequest.onerror = () => reject(indexRequest.error);
                } else {
                    resolve(null);
                }
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Update client in IndexedDB
async function updateClientLocal(localId, updates, userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS], 'readwrite');
    const store = transaction.objectStore(STORE_CLIENTS);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(localId);
        getRequest.onsuccess = () => {
            const client = getRequest.result;
            if (!client || client.user_id !== userId) {
                reject(new Error('Client not found or access denied'));
                return;
            }

            const updated = {
                ...client,
                ...updates,
                updated_at: new Date().toISOString(),
                synced: false // Mark as unsynced when updated
            };

            const putRequest = store.put(updated);
            putRequest.onsuccess = () => {
                resolve({
                    id: updated.server_id || updated.local_id,
                    local_id: updated.local_id,
                    name: updated.name,
                    phone: updated.phone || '',
                    sex: updated.sex || '',
                    createdAt: updated.created_at,
                    synced: updated.synced
                });
            };
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Delete client from IndexedDB
async function deleteClientLocal(localId, userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS], 'readwrite');
    const store = transaction.objectStore(STORE_CLIENTS);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(localId);
        getRequest.onsuccess = () => {
            const client = getRequest.result;
            if (!client || client.user_id !== userId) {
                reject(new Error('Client not found or access denied'));
                return;
            }

            const deleteRequest = store.delete(localId);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Get unsynced clients
async function getUnsyncedClients(userId) {
    try {
        const db = await getDB();
        if (!db) {
            console.warn('[IndexedDB] Database not initialized');
            return [];
        }
        
        const transaction = db.transaction([STORE_CLIENTS], 'readonly');
        const store = transaction.objectStore(STORE_CLIENTS);
        
        // Guard: Check if index exists
        if (!store.indexNames.contains('user_id')) {
            console.warn('[IndexedDB] user_id index not found');
            return [];
        }
        
        const index = store.index('user_id');

        return new Promise((resolve, reject) => {
            // Get all clients for this user, then filter by synced === false
            const request = index.getAll(userId);
            request.onsuccess = () => {
                const clients = request.result.filter(c => c.synced === false);
                resolve(clients);
            };
            request.onerror = () => {
                console.warn('[IndexedDB] Error getting unsynced clients:', request.error);
                resolve([]); // Return empty array instead of rejecting
            };
        });
    } catch (err) {
        console.warn('[IndexedDB] Error in getUnsyncedClients:', err);
        return [];
    }
}

// Mark client as synced
async function markClientSynced(localId, serverId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_CLIENTS, STORE_MEASUREMENTS], 'readwrite');
    const clientsStore = transaction.objectStore(STORE_CLIENTS);
    const measurementsStore = transaction.objectStore(STORE_MEASUREMENTS);

    return new Promise((resolve, reject) => {
        const getRequest = clientsStore.get(localId);
        getRequest.onsuccess = () => {
            const client = getRequest.result;
            if (!client) {
                reject(new Error('Client not found'));
                return;
            }

            const updated = {
                ...client,
                server_id: serverId,
                synced: true,
                updated_at: new Date().toISOString()
            };

            const putRequest = clientsStore.put(updated);
            putRequest.onsuccess = () => {
                // CRITICAL: Update all measurements that reference this client's local_id
                // Update their client_id to use server_id instead
                try {
                    // Check if client_id index exists
                    if (measurementsStore.indexNames.contains('client_id')) {
                        const measurementsIndex = measurementsStore.index('client_id');
                        const measurementsRequest = measurementsIndex.getAll(localId);
                        
                        measurementsRequest.onsuccess = () => {
                            const measurements = measurementsRequest.result;
                            if (measurements.length > 0) {
                                // Update each measurement's client_id to server_id
                                let updateCount = 0;
                                const total = measurements.length;
                                
                                if (total === 0) {
                                    resolve(updated);
                                    return;
                                }
                                
                                measurements.forEach(measurement => {
                                    const updatedMeasurement = {
                                        ...measurement,
                                        client_id: serverId, // Update to server_id
                                        updated_at: new Date().toISOString()
                                    };
                                    const measurementPutRequest = measurementsStore.put(updatedMeasurement);
                                    measurementPutRequest.onsuccess = () => {
                                        updateCount++;
                                        if (updateCount === total) {
                                            resolve(updated);
                                        }
                                    };
                                    measurementPutRequest.onerror = () => {
                                        console.warn('[IndexedDB] Error updating measurement client_id:', measurementPutRequest.error);
                                        updateCount++;
                                        if (updateCount === total) {
                                            resolve(updated);
                                        }
                                    };
                                });
                            } else {
                                resolve(updated);
                            }
                        };
                        measurementsRequest.onerror = () => {
                            // If index query fails, still resolve (client is synced)
                            console.warn('[IndexedDB] Error querying measurements:', measurementsRequest.error);
                            resolve(updated);
                        };
                    } else {
                        // No client_id index - scan all measurements (less efficient but works)
                        const allMeasurementsRequest = measurementsStore.openCursor();
                        let updateCount = 0;
                        let totalToUpdate = 0;
                        
                        allMeasurementsRequest.onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                const measurement = cursor.value;
                                if (measurement.client_id === localId) {
                                    totalToUpdate++;
                                    const updatedMeasurement = {
                                        ...measurement,
                                        client_id: serverId,
                                        updated_at: new Date().toISOString()
                                    };
                                    cursor.update(updatedMeasurement);
                                    updateCount++;
                                }
                                cursor.continue();
                            } else {
                                // Cursor finished
                                resolve(updated);
                            }
                        };
                        allMeasurementsRequest.onerror = () => {
                            console.warn('[IndexedDB] Error scanning measurements:', allMeasurementsRequest.error);
                            resolve(updated);
                        };
                    }
                } catch (err) {
                    console.warn('[IndexedDB] Error updating measurements:', err);
                    resolve(updated); // Still resolve - client is synced
                }
            };
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// ========== MEASUREMENTS OPERATIONS ==========

// Save measurement to IndexedDB
// STRICT: business_id AND client_id MUST be valid UUIDs before insert
async function saveMeasurementLocal(measurementData, userId, businessId) {
    // STRICT GUARD: Verify business_id is valid UUID
    if (!businessId) {
        throw new Error('CRITICAL: business_id is required');
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(businessId)) {
        throw new Error('CRITICAL: business_id must be valid UUID format');
    }
    
    // STRICT GUARD: Verify client_id is valid UUID
    if (!measurementData.client_id) {
        throw new Error('CRITICAL: client_id is required');
    }
    
    if (!uuidRegex.test(measurementData.client_id)) {
        throw new Error('CRITICAL: client_id must be valid UUID format');
    }
    
    // STRICT: UUID generated ONCE - use server_id if provided, otherwise generate
    // NEVER regenerate if server_id exists
    const serverId = measurementData.server_id || generateUUID();
    const localId = measurementData.local_id || serverId; // Use server_id as local_id if no local_id
    
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readwrite');
    const store = transaction.objectStore(STORE_MEASUREMENTS);

    const measurement = {
        local_id: localId,
        server_id: serverId, // UUID generated ONCE
        user_id: userId,
        business_id: businessId, // MUST be valid UUID
        client_id: measurementData.client_id, // MUST be valid UUID
        garment_type: measurementData.garment_type || null,
        shoulder: measurementData.shoulder || null,
        chest: measurementData.chest || null,
        waist: measurementData.waist || null,
        sleeve: measurementData.sleeve || null,
        length: measurementData.length || null,
        neck: measurementData.neck || null,
        hip: measurementData.hip || null,
        inseam: measurementData.inseam || null,
        thigh: measurementData.thigh || null,
        seat: measurementData.seat || null,
        notes: measurementData.notes || null,
        custom_fields: measurementData.custom_fields || {},
        synced: measurementData.synced !== undefined ? measurementData.synced : false,
        created_at: measurementData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const request = store.put(measurement);
        request.onsuccess = () => {
            resolve({ ...measurement, id: measurement.server_id || measurement.local_id });
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Get all measurements from IndexedDB (by user_id - for compatibility)
async function getMeasurementsLocal(userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readonly');
    const store = transaction.objectStore(STORE_MEASUREMENTS);
    const index = store.index('user_id');

    return new Promise((resolve, reject) => {
        const request = index.getAll(userId);
        request.onsuccess = () => {
            const measurements = request.result.map(m => ({
                id: m.server_id || m.local_id,
                local_id: m.local_id,
                business_id: m.business_id, // Include business_id for strict scope
                client_id: m.client_id,
                garment_type: m.garment_type || null,
                date_created: m.created_at,
                shoulder: m.shoulder || null,
                chest: m.chest || null,
                waist: m.waist || null,
                sleeve: m.sleeve || null,
                length: m.length || null,
                neck: m.neck || null,
                hip: m.hip || null,
                inseam: m.inseam || null,
                thigh: m.thigh || null,
                seat: m.seat || null,
                notes: m.notes || null,
                customFields: m.custom_fields || {},
                synced: m.synced
            }));
            // Sort by date_created descending
            measurements.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
            resolve(measurements);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// STRICT: Get measurements by business_id scope only (optional: client_id filter)
async function getMeasurementsByBusinessId(businessId, clientId = null) {
    if (!businessId) {
        throw new Error('CRITICAL: business_id is required');
    }
    
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readonly');
    const store = transaction.objectStore(STORE_MEASUREMENTS);

    return new Promise((resolve, reject) => {
        // Use business_id index if available, otherwise scan
        if (store.indexNames.contains('business_id')) {
            const index = store.index('business_id');
            const request = index.getAll(businessId);
            
            request.onsuccess = () => {
                let measurements = request.result.map(m => ({
                    id: m.server_id || m.local_id,
                    local_id: m.local_id,
                    business_id: m.business_id,
                    client_id: m.client_id,
                    garment_type: m.garment_type || null,
                    date_created: m.created_at,
                    shoulder: m.shoulder || null,
                    chest: m.chest || null,
                    waist: m.waist || null,
                    sleeve: m.sleeve || null,
                    length: m.length || null,
                    neck: m.neck || null,
                    hip: m.hip || null,
                    inseam: m.inseam || null,
                    thigh: m.thigh || null,
                    seat: m.seat || null,
                    notes: m.notes || null,
                    customFields: m.custom_fields || {},
                    synced: m.synced
                }));
                
                // Filter by client_id if provided
                if (clientId) {
                    measurements = measurements.filter(m => m.client_id === clientId);
                }
                
                // Sort by date_created descending
                measurements.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
                resolve(measurements);
            };
            request.onerror = () => reject(request.error);
        } else {
            // Fallback: Scan all measurements and filter by business_id
            const request = store.openCursor();
            const measurements = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const measurement = cursor.value;
                    // Filter by business_id (required) and optionally client_id
                    if (measurement.business_id === businessId && (!clientId || measurement.client_id === clientId)) {
                        measurements.push({
                            id: measurement.server_id || measurement.local_id,
                            local_id: measurement.local_id,
                            business_id: measurement.business_id,
                            client_id: measurement.client_id,
                            garment_type: measurement.garment_type || null,
                            date_created: measurement.created_at,
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
                            customFields: measurement.custom_fields || {},
                            synced: measurement.synced
                        });
                    }
                    cursor.continue();
                } else {
                    // Sort by date_created descending
                    measurements.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
                    resolve(measurements);
                }
            };
            request.onerror = () => reject(request.error);
        }
    });
}

// Get measurement by local_id or server_id
async function getMeasurementLocal(identifier, userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readonly');
    const store = transaction.objectStore(STORE_MEASUREMENTS);

    return new Promise((resolve, reject) => {
        const request = store.get(identifier);
        request.onsuccess = () => {
            if (request.result && request.result.user_id === userId) {
                const m = request.result;
                resolve({
                    id: m.server_id || m.local_id,
                    local_id: m.local_id,
                    client_id: m.client_id,
                    garment_type: m.garment_type || null,
                    date_created: m.created_at,
                    shoulder: m.shoulder || null,
                    chest: m.chest || null,
                    waist: m.waist || null,
                    sleeve: m.sleeve || null,
                    length: m.length || null,
                    neck: m.neck || null,
                    hip: m.hip || null,
                    inseam: m.inseam || null,
                    thigh: m.thigh || null,
                    seat: m.seat || null,
                    notes: m.notes || null,
                    customFields: m.custom_fields || {},
                    synced: m.synced
                });
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Update measurement in IndexedDB
async function updateMeasurementLocal(localId, updates, userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readwrite');
    const store = transaction.objectStore(STORE_MEASUREMENTS);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(localId);
        getRequest.onsuccess = () => {
            const measurement = getRequest.result;
            if (!measurement || measurement.user_id !== userId) {
                reject(new Error('Measurement not found or access denied'));
                return;
            }

            const updated = {
                ...measurement,
                ...updates,
                updated_at: new Date().toISOString(),
                synced: false // Mark as unsynced when updated
            };

            const putRequest = store.put(updated);
            putRequest.onsuccess = () => {
                const m = updated;
                resolve({
                    id: m.server_id || m.local_id,
                    local_id: m.local_id,
                    client_id: m.client_id,
                    garment_type: m.garment_type || null,
                    date_created: m.created_at,
                    shoulder: m.shoulder || null,
                    chest: m.chest || null,
                    waist: m.waist || null,
                    sleeve: m.sleeve || null,
                    length: m.length || null,
                    neck: m.neck || null,
                    hip: m.hip || null,
                    inseam: m.inseam || null,
                    thigh: m.thigh || null,
                    seat: m.seat || null,
                    notes: m.notes || null,
                    customFields: m.custom_fields || {},
                    synced: m.synced
                });
            };
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Delete measurement from IndexedDB
async function deleteMeasurementLocal(localId, userId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readwrite');
    const store = transaction.objectStore(STORE_MEASUREMENTS);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(localId);
        getRequest.onsuccess = () => {
            const measurement = getRequest.result;
            if (!measurement || measurement.user_id !== userId) {
                reject(new Error('Measurement not found or access denied'));
                return;
            }

            const deleteRequest = store.delete(localId);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Get unsynced measurements
async function getUnsyncedMeasurements(userId) {
    try {
        const db = await getDB();
        if (!db) {
            console.warn('[IndexedDB] Database not initialized');
            return [];
        }
        
        const transaction = db.transaction([STORE_MEASUREMENTS], 'readonly');
        const store = transaction.objectStore(STORE_MEASUREMENTS);
        
        // Guard: Check if index exists
        if (!store.indexNames.contains('user_id')) {
            console.warn('[IndexedDB] user_id index not found');
            return [];
        }
        
        const index = store.index('user_id');

        return new Promise((resolve, reject) => {
            // Get all measurements for this user, then filter by synced === false
            const request = index.getAll(userId);
            request.onsuccess = () => {
                const measurements = request.result.filter(m => m.synced === false);
                resolve(measurements);
            };
            request.onerror = () => {
                console.warn('[IndexedDB] Error getting unsynced measurements:', request.error);
                resolve([]); // Return empty array instead of rejecting
            };
        });
    } catch (err) {
        console.warn('[IndexedDB] Error in getUnsyncedMeasurements:', err);
        return [];
    }
}

// Mark measurement as synced
async function markMeasurementSynced(localId, serverId) {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEASUREMENTS], 'readwrite');
    const store = transaction.objectStore(STORE_MEASUREMENTS);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(localId);
        getRequest.onsuccess = () => {
            const measurement = getRequest.result;
            if (!measurement) {
                reject(new Error('Measurement not found'));
                return;
            }

            const updated = {
                ...measurement,
                server_id: serverId,
                synced: true,
                updated_at: new Date().toISOString()
            };

            const putRequest = store.put(updated);
            putRequest.onsuccess = () => resolve(updated);
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Export functions
if (typeof window !== 'undefined') {
    window.indexedDBHelper = {
        initDB,
        getDB,
        // Clients
        saveClientLocal,
        getClientsLocal,
        getClientsByBusinessId, // STRICT: Fetch by business_id scope
        getClientLocal,
        updateClientLocal,
        deleteClientLocal,
        getUnsyncedClients,
        markClientSynced,
        // Measurements
        saveMeasurementLocal,
        getMeasurementsLocal,
        getMeasurementsByBusinessId, // STRICT: Fetch by business_id scope (optional client_id)
        getMeasurementLocal,
        updateMeasurementLocal,
        deleteMeasurementLocal,
        getUnsyncedMeasurements,
        markMeasurementSynced
    };
}

