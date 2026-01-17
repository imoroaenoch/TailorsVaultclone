// Data Storage Key (single key for all data)
const VAULT_DATA_KEY = 'measurement_vault_data';

// Legacy Keys (for migration)
const LEGACY_CLIENTS_KEY = 'measurement_vault_clients';
const LEGACY_MEASUREMENTS_KEY = 'measurement_vault_measurements';

// Logout state key
const LOGOUT_STATE_KEY = 'measurement_vault_logged_out';

// Current business session ID key
const CURRENT_BUSINESS_ID_KEY = 'measurement_vault_current_business_id';

// Device ID removed - using Supabase auth.user.id instead

// ========== LOCALSTORAGE CACHE KEYS ==========
const CACHE_BUSINESS_KEY = 'measurement_vault_cache_business';
const CACHE_CLIENTS_KEY = 'measurement_vault_cache_clients';
const CACHE_MEASUREMENTS_KEY = 'measurement_vault_cache_measurements';
const CACHE_TIMESTAMP_KEY = 'measurement_vault_cache_timestamp';

// ========== OFFLINE SYNC QUEUE KEY ==========
const PENDING_SYNC_QUEUE_KEY = 'measurement_vault_pending_sync';

// ========== IN-MEMORY STATE MANAGEMENT ==========
// Cache for clients and measurements to avoid unnecessary re-fetching
let clientsCache = null;
let measurementsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Syncing state tracking (removed - using silent background sync)
// const syncingClients = new Set(); // Track clients being synced
// const syncingMeasurements = new Set(); // Track measurements being synced
let pendingMeasurementsRetryInterval = null; // Interval for retrying pending measurements (deprecated - will be removed)

// App ready state
let appReady = false;
let isHydrated = false;

// Auth ready state - tracks ONLY Supabase auth resolution (not business/data loading)
let authReady = false;
let authTimeoutId = null;
const AUTH_TIMEOUT_MS = 2000; // 2 seconds hard timeout - always show UI after this
const LOADING_SCREEN_TIMEOUT_MS = 1500; // 1.5 seconds max for loading screen

// Performance: Cache DOM elements
let cachedScreens = null;
let businessDataCache = null;
let businessDataCacheTime = 0;
const BUSINESS_CACHE_DURATION = 30000; // 30 seconds

// ========== LOCALSTORAGE CACHE FUNCTIONS ==========
// Safe JSON parsing with fallback
function safeJsonParse(jsonString, fallback = null) {
    if (!jsonString) return fallback;
    try {
        return JSON.parse(jsonString);
    } catch (err) {
        console.warn('Error parsing JSON from localStorage:', err);
        return fallback;
    }
}

// Safe JSON stringify
function safeJsonStringify(data, fallback = null) {
    try {
        return JSON.stringify(data);
    } catch (err) {
        console.warn('Error stringifying data for localStorage:', err);
        return fallback;
    }
}

// Read business from localStorage cache
function getCachedBusiness() {
    const cached = localStorage.getItem(CACHE_BUSINESS_KEY);
    return safeJsonParse(cached, null);
}

// Write business to localStorage cache
function setCachedBusiness(business) {
    if (!business) {
        localStorage.removeItem(CACHE_BUSINESS_KEY);
        return;
    }
    const json = safeJsonStringify(business);
    if (json) {
        localStorage.setItem(CACHE_BUSINESS_KEY, json);
    }
}

// Read clients from localStorage cache
function getCachedClients() {
    const cached = localStorage.getItem(CACHE_CLIENTS_KEY);
    const parsed = safeJsonParse(cached, null);
    return Array.isArray(parsed) ? parsed : [];
}

// Write clients to localStorage cache
function setCachedClients(clients) {
    if (!Array.isArray(clients)) {
        localStorage.removeItem(CACHE_CLIENTS_KEY);
        return;
    }
    const json = safeJsonStringify(clients);
    if (json) {
        localStorage.setItem(CACHE_CLIENTS_KEY, json);
    }
}

// Read measurements from localStorage cache
function getCachedMeasurements() {
    const cached = localStorage.getItem(CACHE_MEASUREMENTS_KEY);
    const parsed = safeJsonParse(cached, null);
    return Array.isArray(parsed) ? parsed : [];
}

// Write measurements to localStorage cache
function setCachedMeasurements(measurements) {
    if (!Array.isArray(measurements)) {
        localStorage.removeItem(CACHE_MEASUREMENTS_KEY);
        return;
    }
    const json = safeJsonStringify(measurements);
    if (json) {
        localStorage.setItem(CACHE_MEASUREMENTS_KEY, json);
    }
}

// Get cache timestamp
function getCacheTimestamp() {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
}

// Set cache timestamp
function setCacheTimestamp(timestamp = null) {
    if (timestamp === null) {
        timestamp = Date.now();
    }
    localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());
}

// Clear all localStorage cache
function clearLocalStorageCache() {
    localStorage.removeItem(CACHE_BUSINESS_KEY);
    localStorage.removeItem(CACHE_CLIENTS_KEY);
    localStorage.removeItem(CACHE_MEASUREMENTS_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

// ========== OFFLINE SYNC QUEUE FUNCTIONS ==========
// Get pending sync queue
function getPendingSyncQueue() {
    const queue = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
    return safeJsonParse(queue, []);
}

// Save pending sync queue
function savePendingSyncQueue(queue) {
    const json = safeJsonStringify(queue);
    if (json) {
        localStorage.setItem(PENDING_SYNC_QUEUE_KEY, json);
    }
}

// Maximum retry attempts before showing error to user
const MAX_SYNC_RETRIES = 5;

// Add item to pending sync queue
function addToPendingSyncQueue(action, data) {
    const queue = getPendingSyncQueue();
    const item = {
        id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        action: action, // 'create_client', 'update_client', 'delete_client', 'create_measurement', 'update_measurement', 'delete_measurement'
        data: data,
        timestamp: Date.now(),
        retryCount: 0 // Track retry attempts
    };
    queue.push(item);
    savePendingSyncQueue(queue);
    // updateSyncStatusIndicator(); // REMOVED - silent sync
    return item.id;
}

// Remove item from pending sync queue
function removeFromPendingSyncQueue(itemId) {
    const queue = getPendingSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    savePendingSyncQueue(filtered);
    // updateSyncStatusIndicator(); // REMOVED - silent sync
}

// Clear pending sync queue
function clearPendingSyncQueue() {
    localStorage.removeItem(PENDING_SYNC_QUEUE_KEY);
    // updateSyncStatusIndicator(); // REMOVED - silent sync
}

// Check if online
function isOnline() {
    return navigator.onLine;
}

// Update sync status indicator - REMOVED (silent background sync)
// function updateSyncStatusIndicator() { ... }

// ========== TOAST NOTIFICATION SYSTEM ==========
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add styles if not already added
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--bg-card);
                color: var(--text-primary);
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: var(--shadow-md);
                z-index: 10000;
                font-size: 14px;
                max-width: 90%;
                text-align: center;
                animation: toastSlideIn 0.3s ease-out;
            }
            .toast-error {
                background: #ef4444;
                color: white;
            }
            .toast-success {
                background: #10b981;
                color: white;
            }
            @keyframes toastSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
}

// ========== LOADING STATE MANAGEMENT ==========
function showLoadingScreen() {
    const loader = document.createElement('div');
    loader.id = 'app-loader';
    loader.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        ">
            <div style="
                text-align: center;
                color: var(--text-primary);
            ">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--bg-secondary);
                    border-top-color: var(--accent-yellow);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 16px;
                "></div>
                <div>Loading...</div>
            </div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loader);
}

function hideLoadingScreen() {
    // Hide overlay loader
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s';
        setTimeout(() => loader.remove(), 300);
    }
    // Hide static loading screen div
    const loadingScreen = document.getElementById('app-loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
    isHydrated = true;
}

// Garment Types by Sex (including Custom option)
const GARMENT_TYPES = {
    Male: [
        'Shirt',
        'Trousers / Pants',
        'Kaftan',
        'Senator',
        'Suit',
        'Shorts',
        'Blazer',
        'Custom'
    ],
    Female: [
        'Dress / Gown',
        'Skirt',
        'Blouse / Top',
        'Trousers / Pants',
        'Kaftan / Traditional',
        'Suit',
        'Shorts',
        'Custom'
    ]
};

// Smart Fields by Garment Type
const GARMENT_FIELDS = {
    // Shirt / Blouse / Top / Kaftan / Suit Jackets / Blazer
    'Shirt': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],
    'Blouse / Top': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],
    'Kaftan': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],
    'Kaftan / Traditional': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],
    'Senator': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],
    'Suit': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],
    'Blazer': ['shoulder', 'chest', 'sleeve', 'length', 'neck'],

    // Trousers / Pants / Shorts
    'Trousers / Pants': ['waist', 'hip', 'inseam', 'length', 'thigh', 'seat'],
    'Shorts': ['waist', 'hip', 'inseam', 'length', 'thigh', 'seat'],

    // Skirt
    'Skirt': ['waist', 'hip', 'length'],

    // Dress / Gown
    'Dress / Gown': ['shoulder', 'chest', 'waist', 'hip', 'sleeve', 'length', 'neck']
};

// Get Supabase client (initialized in page.tsx)
// Returns a promise that resolves when Supabase is ready
async function getSupabaseAsync() {
    if (typeof window === 'undefined') {
        return null;
    }

    // If already initialized, return immediately
    if (window.supabaseClient) {
        return window.supabaseClient;
    }

    // Wait for Supabase to be initialized (max 2 seconds - don't block too long)
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max (20 * 100ms)
    while (!window.supabaseClient && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (window.supabaseClient) {
        return window.supabaseClient;
    }

    // Don't warn if offline - this is expected
    if (navigator.onLine) {
        console.warn('[Supabase] Client not initialized after waiting. May be offline or still loading.');
    }
    return null;
}

// Synchronous version - returns null if not ready (for non-critical calls)
function getSupabase() {
    if (typeof window !== 'undefined' && window.supabaseClient) {
        return window.supabaseClient;
    }
    return null;
}

// Check if business exists for current authenticated user
async function hasBusiness() {
    const user = await getCurrentUser();
    if (!user) {
        return false;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        return false;
    }

    // Query business by user_id only
    const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

    return !error && data && data.id;
}

// Get business for current authenticated user (single source of truth)
// NOTE: Always checks cache first, only queries Supabase if online
async function getBusiness(useCache = true) {
    // ALWAYS check localStorage cache first (offline-first)
    const cachedBusiness = getCachedBusiness();
    if (cachedBusiness) {
        // Update in-memory cache
        businessDataCache = cachedBusiness;
        businessDataCacheTime = Date.now();
        return cachedBusiness;
    }

    // Check in-memory cache
    if (useCache && businessDataCache && (Date.now() - businessDataCacheTime) < BUSINESS_CACHE_DURATION) {
        return businessDataCache;
    }

    // Do NOT query Supabase if offline
    if (!isOnline()) {
        console.log('[getBusiness] Offline - returning cached business');
        return cachedBusiness || null;
    }

    const user = await getCurrentUser();
    if (!user) {
        return null;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        return null;
    }

    try {
        // Query business by user_id only - NO fallbacks
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (error) {
            console.warn('[getBusiness] Supabase query error:', error);
            // Return cached business if available
            return cachedBusiness || null;
        }

        if (!data) {
            return cachedBusiness || null;
        }

        // Return business data
        const business = {
            id: data.id,
            name: data.name,
            email: data.email || null,
            phone: data.phone,
            createdAt: data.created_at
        };

        // Cache the result (both in-memory and localStorage)
        businessDataCache = business;
        businessDataCacheTime = Date.now();
        setCachedBusiness(business);

        return business;
    } catch (err) {
        console.warn('[getBusiness] Network error:', err);
        // Return cached business if available
        return cachedBusiness || null;
    }
}

// Clear business cache (call after updates)
function clearBusinessCache() {
    businessDataCache = null;
    businessDataCacheTime = 0;
}

// Check if an ID is a temporary ID (starts with "temp_")
function isTempId(id) {
    return id && typeof id === 'string' && id.startsWith('temp_');
}

// Get real client ID from cache if temp ID is provided
function getRealClientId(clientId) {
    if (!isTempId(clientId)) {
        return clientId; // Already a real ID
    }

    // Try to find the real client ID in cache
    const clients = getCachedClients();
    const tempClient = clients.find(c => c.id === clientId);
    if (tempClient) {
        // Check if there's a real client with the same name/phone
        const realClient = clients.find(c =>
            !isTempId(c.id) &&
            c.name === tempClient.name &&
            c.phone === tempClient.phone
        );
        if (realClient) {
            return realClient.id;
        }
    }

    return null; // Real ID not found yet
}

// Generate a UUID v4
function generateUUID() {
    // Use browser's native crypto.randomUUID() if available (more reliable)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback to manual generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Device ID function removed - using Supabase auth.user.id instead

// Create business for authenticated user (removed - use createBusinessForUser in business setup form)
// This function is kept for backward compatibility but should not be used
async function createBusiness(name, email, phone) {
    console.warn('createBusiness() is deprecated - business creation is handled in business setup form');
    return null;
}

// Update business details
async function updateBusiness(name, email, phone) {
    const supabase = getSupabase();
    if (!supabase) return null;

    // Get current business ID
    const currentBusiness = await getBusiness();
    if (!currentBusiness) return null;

    // Email is optional - use null if empty
    const updateData = {
        name: name.trim(),
        phone: phone.trim()
    };

    const emailTrimmed = email.trim();
    if (emailTrimmed) {
        updateData.email = emailTrimmed;
    } else {
        updateData.email = null;
    }

    const { data, error } = await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', currentBusiness.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating business:', error);
        return null;
    }

    // Convert to match old format
    const updatedBusiness = {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        email_verified: data.email_verified || false,
        createdAt: data.created_at
    };

    // Update cache with new data immediately (don't clear - update with new values)
    setCachedBusiness(updatedBusiness);
    businessDataCache = updatedBusiness;
    businessDataCacheTime = Date.now();

    return updatedBusiness;
}

// ========== EMAIL LINKING FUNCTIONS ==========

// Request email verification using Supabase Auth magic link
async function requestEmailVerification(email) {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        alert('Unable to connect to database. Please try again.');
        return false;
    }

    const business = await getBusiness();
    if (!business) {
        alert('No business found. Please create a business first.');
        return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return false;
    }

    try {
        // Store the email temporarily in business record (unverified)
        const { error: updateError } = await supabase
            .from('businesses')
            .update({
                email: email.trim().toLowerCase(),
                email_verified: false
            })
            .eq('id', business.id);

        if (updateError) {
            console.error('Error updating business email:', updateError);
            alert('Failed to update email. Please try again.');
            return false;
        }

        // Send magic link using Supabase Auth
        // This is for linking email to existing device-based account
        // Note: Supabase requires "Enable sign ups" to be ON for OTP to work
        const { error: authError } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: {
                // Set redirect URL to current page - Supabase will handle the callback
                emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
                // Allow creating user if they don't exist (required for OTP to work)
                shouldCreateUser: true
            }
        });

        if (authError) {
            console.error('Error sending magic link:', authError);
            console.error('Error details:', JSON.stringify(authError, null, 2));

            // Handle specific error codes
            if (authError.code === 'otp_disabled' || authError.message?.includes('otp') || authError.message?.includes('Signups not allowed')) {
                alert(
                    'Email verification is not enabled in your Supabase project.\n\n' +
                    'To fix this:\n' +
                    '1. Go to your Supabase Dashboard\n' +
                    '2. Navigate to Authentication > Providers > Email\n' +
                    '3. Enable "Enable sign ups"\n' +
                    '4. Enable "Confirm email" (optional but recommended)\n' +
                    '5. Save the changes\n\n' +
                    'Then try again.'
                );
                return false;
            }

            // Show the actual error message to help debug
            const errorMsg = authError.message || 'Unknown error';
            alert(`Failed to send verification email: ${errorMsg}\n\nPlease check the console for more details.`);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Exception in requestEmailVerification:', err);
        alert('An error occurred. Please try again.');
        return false;
    }
}

// Link verified email to current business - email-first authentication
// When email is verified, it becomes the primary identifier and locks in the account
async function linkEmailToBusiness(email) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return false;

    const business = await getBusiness();
    if (!business) {
        console.warn('No business found to link email to');
        return false;
    }

    try {
        // Re-fetch the authenticated user to get real verification status from Supabase Auth
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
            console.error('Error getting authenticated user:', userError);
            return false;
        }

        // Check if email is verified in Supabase Auth (email_confirmed_at is set)
        const isEmailVerified = user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined;

        // Check if another business with this verified email already exists
        if (isEmailVerified) {
            const { data: existingBusiness, error: checkError } = await supabase
                .from('businesses')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .eq('email_verified', true)
                .neq('id', business.id) // Exclude current business
                .limit(1)
                .single();

            if (!checkError && existingBusiness) {
                // Another business with verified email exists - merge data instead of creating duplicate
                console.log('Business with verified email exists, merging data...');
                await mergeBusinessData(business.id, existingBusiness.id);
                // Switch to existing business
                localStorage.setItem(CURRENT_BUSINESS_ID_KEY, existingBusiness.id);
                setCachedBusiness({
                    id: existingBusiness.id,
                    name: existingBusiness.name,
                    email: existingBusiness.email,
                    phone: existingBusiness.phone,
                    email_verified: true,
                    createdAt: existingBusiness.created_at
                });
                return true;
            }
        }

        // Update current business with verified email (email becomes primary identifier)
        const { error } = await supabase
            .from('businesses')
            .update({
                email: email.trim().toLowerCase(),
                email_verified: isEmailVerified, // Use real Supabase Auth verification status
                // Clear old token fields if they exist (backward compatibility)
                verification_token: null,
                verification_token_expires_at: null
            })
            .eq('id', business.id);

        if (error) {
            console.error('Error linking email to business:', error);
            return false;
        }

        // If email is verified, sync all local data to this email-based account
        if (isEmailVerified) {
            await syncLocalDataToEmailAccount(business.id);
        }

        return isEmailVerified;
    } catch (err) {
        console.error('Exception in linkEmailToBusiness:', err);
        return false;
    }
}

// Merge data from source business to target business (prevent duplicates)
async function mergeBusinessData(sourceBusinessId, targetBusinessId) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        // Get all clients and measurements from source business
        const { data: sourceClients } = await supabase
            .from('clients')
            .select('*')
            .eq('business_id', sourceBusinessId);

        const { data: sourceMeasurements } = await supabase
            .from('measurements')
            .select('*')
            .eq('business_id', sourceBusinessId);

        // Get existing clients and measurements from target business
        const { data: targetClients } = await supabase
            .from('clients')
            .select('*')
            .eq('business_id', targetBusinessId);

        // Merge clients (avoid duplicates by name+phone)
        if (sourceClients && sourceClients.length > 0) {
            for (const sourceClient of sourceClients) {
                const exists = targetClients?.some(tc =>
                    tc.name === sourceClient.name && tc.phone === sourceClient.phone
                );

                if (!exists) {
                    // Move client to target business
                    await supabase
                        .from('clients')
                        .update({ business_id: targetBusinessId })
                        .eq('id', sourceClient.id);
                } else {
                    // Delete duplicate client
                    await supabase
                        .from('clients')
                        .delete()
                        .eq('id', sourceClient.id);
                }
            }
        }

        // Move all measurements to target business
        if (sourceMeasurements && sourceMeasurements.length > 0) {
            for (const measurement of sourceMeasurements) {
                // Find corresponding client in target business
                const targetClient = targetClients?.find(tc =>
                    tc.name === (sourceClients?.find(sc => sc.id === measurement.client_id)?.name || '')
                );

                if (targetClient) {
                    await supabase
                        .from('measurements')
                        .update({
                            business_id: targetBusinessId,
                            client_id: targetClient.id
                        })
                        .eq('id', measurement.id);
                } else {
                    // Delete measurement if no matching client
                    await supabase
                        .from('measurements')
                        .delete()
                        .eq('id', measurement.id);
                }
            }
        }

        // Delete source business (data has been merged)
        await supabase
            .from('businesses')
            .delete()
            .eq('id', sourceBusinessId);
    } catch (err) {
        console.error('Error merging business data:', err);
    }
}

// Sync local data to email-based account - REMOVED (using user_id now, no sync needed)
async function syncLocalDataToEmailAccount(businessId) {
    console.warn('syncLocalDataToEmailAccount() is deprecated - data is automatically synced via user_id');
}

// Sync data from email (for new devices)
async function syncDataFromEmail(email) {
    const supabase = getSupabase();
    if (!supabase) {
        alert('Unable to connect to database. Please try again.');
        return false;
    }

    try {
        // Find business with verified email
        const { data: businesses, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('email', email.trim().toLowerCase())
            .eq('email_verified', true)
            .limit(1);

        if (error || !businesses || businesses.length === 0) {
            alert('No verified business found with this email address.');
            return false;
        }

        const sourceBusiness = businesses[0];
        const currentDeviceId = getDeviceId();

        // Check if current device already has a business
        const currentBusiness = await getBusiness();

        if (currentBusiness) {
            // Merge data: copy clients and measurements from source to current
            // First, get all clients from source business
            const { data: sourceClients } = await supabase
                .from('clients')
                .select('*')
                .eq('business_id', sourceBusiness.id);

            if (sourceClients && sourceClients.length > 0) {
                // Create a mapping of old client IDs to new client IDs
                const clientIdMap = new Map();

                // Copy clients
                for (const sourceClient of sourceClients) {
                    const { data: newClient } = await supabase
                        .from('clients')
                        .insert([{
                            business_id: currentBusiness.id,
                            name: sourceClient.name,
                            phone: sourceClient.phone,
                            sex: sourceClient.sex
                        }])
                        .select()
                        .single();

                    if (newClient) {
                        clientIdMap.set(sourceClient.id, newClient.id);
                    }
                }

                // Copy measurements
                const { data: sourceMeasurements } = await supabase
                    .from('measurements')
                    .select('*')
                    .eq('business_id', sourceBusiness.id);

                if (sourceMeasurements && sourceMeasurements.length > 0) {
                    for (const sourceMeasurement of sourceMeasurements) {
                        const newClientId = clientIdMap.get(sourceMeasurement.client_id);
                        if (newClientId) {
                            await supabase
                                .from('measurements')
                                .insert([{
                                    business_id: currentBusiness.id,
                                    client_id: newClientId,
                                    garment_type: sourceMeasurement.garment_type,
                                    sex: sourceMeasurement.sex,
                                    shoulder: sourceMeasurement.shoulder,
                                    chest: sourceMeasurement.chest,
                                    waist: sourceMeasurement.waist,
                                    sleeve: sourceMeasurement.sleeve,
                                    length: sourceMeasurement.length,
                                    neck: sourceMeasurement.neck,
                                    hip: sourceMeasurement.hip,
                                    inseam: sourceMeasurement.inseam,
                                    thigh: sourceMeasurement.thigh,
                                    seat: sourceMeasurement.seat,
                                    custom_fields: sourceMeasurement.custom_fields,
                                    notes: sourceMeasurement.notes
                                }]);
                        }
                    }
                }
            }

            // Link current business to email
            await supabase
                .from('businesses')
                .update({
                    email: sourceBusiness.email,
                    email_verified: true
                })
                .eq('id', currentBusiness.id);
        } else {
            // No current business - update source business to use current user_id
            await supabase
                .from('businesses')
                .update({
                    user_id: user.id
                })
                .eq('id', sourceBusiness.id);
        }

        return true;
    } catch (err) {
        console.error('Exception in syncDataFromEmail:', err);
        alert('An error occurred while syncing data. Please try again.');
        return false;
    }
}

// Render email linking status in settings
async function renderEmailLinkingStatus() {
    const business = await getBusiness();
    if (!business) return;

    const statusContainer = document.getElementById('email-linking-status');
    const formContainer = document.getElementById('email-linking-form');
    const pendingContainer = document.getElementById('email-verification-pending');

    if (!statusContainer || !formContainer || !pendingContainer) return;

    // Check Supabase Auth user for real verification status
    const supabase = await getSupabaseAsync();
    let isEmailVerified = business.email_verified || false;

    if (supabase && business.email) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email === business.email.toLowerCase()) {
                // Email matches - check Supabase Auth verification status
                isEmailVerified = user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined;

                // Update database if status changed
                if (isEmailVerified !== business.email_verified) {
                    await supabase
                        .from('businesses')
                        .update({ email_verified: isEmailVerified })
                        .eq('id', business.id);
                }
            }
        } catch (err) {
            console.warn('Error checking Supabase Auth user status:', err);
            // Fall back to database status
        }
    }

    // Check if there's a pending verification
    const hasPendingVerification = business.email && !isEmailVerified;

    if (isEmailVerified && business.email) {
        // Email is verified
        statusContainer.innerHTML = `
            <div class="email-status-verified">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style="color: #10b981; margin-right: 8px;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>Email verified: ${escapeHtml(business.email)}</span>
            </div>
        `;
        formContainer.style.display = 'none';
        pendingContainer.style.display = 'none';
    } else if (hasPendingVerification) {
        // Verification pending
        statusContainer.innerHTML = `
            <div class="email-status-pending">
                <span>Verification pending for: ${escapeHtml(business.email)}</span>
            </div>
        `;
        formContainer.style.display = 'none';
        pendingContainer.style.display = 'block';
    } else {
        // No email linked
        statusContainer.innerHTML = `
            <div class="email-status-unlinked">
                <span>No email linked</span>
            </div>
        `;
        formContainer.style.display = 'block';
        pendingContainer.style.display = 'none';
    }
}

// Check if business credentials match (for login)
// Email is optional - only match if both are provided or both are empty/null
async function matchBusiness(name, email, phone) {
    const business = await getBusiness();
    if (!business) return false;

    // Name and phone must match
    const nameMatch = business.name.toLowerCase().trim() === name.toLowerCase().trim();
    const phoneMatch = business.phone.trim() === phone.trim();

    // Email matching: if email is provided, it must match; if not provided, business email can be null/empty
    const emailTrimmed = email.trim();
    const businessEmail = business.email ? business.email.toLowerCase().trim() : '';
    const emailMatch = emailTrimmed ? (businessEmail === emailTrimmed.toLowerCase()) : (!businessEmail);

    return nameMatch && phoneMatch && emailMatch;
}

// Find business by credentials (for login) - only for current device
// Email is optional - only match if provided
async function findBusinessByCredentials(name, email, phone) {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        console.error('Supabase client not available for findBusinessByCredentials');
        return null;
    }

    const deviceId = getDeviceId();

    try {
        // Build query - email is optional
        let query = supabase
            .from('businesses')
            .select('*')
            .eq('name', name.trim())
            .eq('phone', phone.trim())
            .eq('device_id', deviceId);

        // Only match email if provided
        const emailTrimmed = email.trim();
        if (emailTrimmed) {
            query = query.eq('email', emailTrimmed.toLowerCase());
        } else {
            // If no email provided, match businesses with null or empty email
            query = query.or('email.is.null,email.eq.');
        }

        const { data, error } = await query.limit(1);

        // Check if we got results and no error
        if (error || !data || data.length === 0) {
            return null;
        }

        const business = data[0];

        // Store the business ID for session tracking
        localStorage.setItem(CURRENT_BUSINESS_ID_KEY, business.id);

        // Convert to match old format
        const businessObj = {
            id: business.id,
            name: business.name,
            email: business.email,
            phone: business.phone,
            email_verified: business.email_verified || false,
            createdAt: business.created_at
        };

        // Cache business in localStorage
        setCachedBusiness(businessObj);

        return businessObj;
    } catch (err) {
        console.error('Exception in findBusinessByCredentials:', err);
        return null;
    }
}

// Logout - Set logged out state without deleting data
async function logoutBusiness() {
    // CRITICAL: Set logout flag FIRST before signing out
    // This ensures auth state listener knows it's an explicit logout
    localStorage.setItem(LOGOUT_STATE_KEY, 'true');

    // Clear cached session
    clearCachedSession();

    // Sign out from Supabase (this clears auth session)
    try {
        const supabase = await getSupabaseAsync();
        if (supabase && isOnline()) {
            await supabase.auth.signOut();
        }
    } catch (err) {
        console.warn('[Logout] Error signing out from Supabase:', err);
        // Continue with logout even if Supabase fails
    }

    // Clear business cache
    clearBusinessCache();

    // Clear only auth-related localStorage keys (preserve IndexedDB data)
    const authKeys = [
        CACHE_BUSINESS_KEY,
        CACHE_CLIENTS_KEY,
        CACHE_MEASUREMENTS_KEY,
        CACHE_TIMESTAMP_KEY,
        CURRENT_BUSINESS_ID_KEY,
        PENDING_SYNC_QUEUE_KEY
    ];

    authKeys.forEach(key => {
        localStorage.removeItem(key);
    });

    // Clear Supabase auth storage (handled by signOut, but ensure it's cleared)
    try {
        // Supabase stores auth in localStorage with specific keys
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase.auth')) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('Error clearing Supabase auth storage:', e);
    }

    // Clear cache
    clearCache();

    // Clear DOM caches
    cachedScreens = null;

    // Reset all in-memory variables
    currentClientId = null;
    currentMeasurementId = null;
    currentMeasurementDetailId = null;

    // Stop background sync
    if (window.syncManager) {
        window.syncManager.stopBackgroundSync();
    }
    previousScreen = 'home-screen';
    recentMeasurementsOffset = 0;
    recentMeasurementsExpanded = false;

    // Reset all forms
    const businessLoginForm = document.getElementById('business-login-form');
    if (businessLoginForm) {
        businessLoginForm.reset();
    }

    const businessSetupForm = document.getElementById('business-setup-form');
    if (businessSetupForm) {
        businessSetupForm.reset();
    }

    const measurementForm = document.getElementById('measurement-form');
    if (measurementForm) {
        measurementForm.reset();
        // Also reset the form state
        resetMeasurementForm();
    }

    const editBusinessForm = document.getElementById('edit-business-form');
    if (editBusinessForm) {
        editBusinessForm.reset();
    }

    const editClientForm = document.getElementById('edit-client-form');
    if (editClientForm) {
        editClientForm.reset();
    }
}

function loginBusiness() {
    // Clear logout state from localStorage
    localStorage.removeItem(LOGOUT_STATE_KEY);
    // Note: Business ID is already set when business is found/created
}

function isUserLoggedOut() {
    // Check localStorage for logout state (persists across refreshes)
    return localStorage.getItem(LOGOUT_STATE_KEY) === 'true';
}

// Reset - Clear all data permanently
function resetBusiness() {
    localStorage.removeItem(VAULT_DATA_KEY);
    localStorage.removeItem(LEGACY_CLIENTS_KEY);
    localStorage.removeItem(LEGACY_MEASUREMENTS_KEY);
    // Clear current business session ID
    localStorage.removeItem(CURRENT_BUSINESS_ID_KEY);
    // Clear logout state as well (user will need to register again)
    localStorage.removeItem(LOGOUT_STATE_KEY);

    // Clear sessionStorage
    try {
        sessionStorage.clear();
    } catch (e) {
        console.warn('Error clearing sessionStorage:', e);
    }

    // Clear cache
    clearCache();
}

// Initialize data structures if they don't exist
async function initStorage() {
    // Step 1: Check if user is logged out (check localStorage for measurement_vault_logged_out)
    // If logged out, always show Business Registration screen (regardless of existing business)
    if (isUserLoggedOut()) {
        showScreen('business-setup-screen');
        return false;
    }

    // Step 2: User is not logged out - check if business exists in Supabase
    const hasBiz = await hasBusiness();
    if (!hasBiz) {
        // No business exists - show business registration screen
        showScreen('business-setup-screen');
        return false;
    }

    // Step 3: Valid session exists - user is logged in and business exists
    // Continue to dashboard (normal flow)
    return true;
}

// Get all clients (with caching) - REMOVED (using new getClients() that uses user_id)

// Add client to cache (optimistic update)
function addClientToCache(client) {
    if (!clientsCache) clientsCache = [];
    clientsCache.unshift(client); // Add to beginning
    cacheTimestamp = Date.now();
    setCacheTimestamp(cacheTimestamp);

    // Update localStorage cache
    setCachedClients(clientsCache);
}

// Update client in cache
function updateClientInCache(clientId, updates) {
    if (!clientsCache) return;
    const index = clientsCache.findIndex(c => c.id === clientId);
    if (index !== -1) {
        clientsCache[index] = { ...clientsCache[index], ...updates };
        cacheTimestamp = Date.now();
        setCacheTimestamp(cacheTimestamp);

        // Update localStorage cache
        setCachedClients(clientsCache);
    }
}

// Remove client from cache
function removeClientFromCache(clientId) {
    if (!clientsCache) return;
    clientsCache = clientsCache.filter(c => c.id !== clientId);
    cacheTimestamp = Date.now();
    setCacheTimestamp(cacheTimestamp);

    // Update localStorage cache
    setCachedClients(clientsCache);
}

// Get all measurements (with caching) - REMOVED (using new getMeasurements() that uses user_id)

// Add measurement to cache (optimistic update)
function addMeasurementToCache(measurement) {
    if (!measurementsCache) measurementsCache = [];
    measurementsCache.unshift(measurement); // Add to beginning
    cacheTimestamp = Date.now();
    setCacheTimestamp(cacheTimestamp);

    // Update localStorage cache
    setCachedMeasurements(measurementsCache);
}

// Update measurement in cache
function updateMeasurementInCache(measurementId, updates) {
    if (!measurementsCache) return;
    const index = measurementsCache.findIndex(m => m.id === measurementId);
    if (index !== -1) {
        measurementsCache[index] = { ...measurementsCache[index], ...updates };
        cacheTimestamp = Date.now();
        setCacheTimestamp(cacheTimestamp);

        // Update localStorage cache
        setCachedMeasurements(measurementsCache);
    }
}

// Remove measurement from cache
function removeMeasurementFromCache(measurementId) {
    if (!measurementsCache) return;
    measurementsCache = measurementsCache.filter(m => m.id !== measurementId);
    cacheTimestamp = Date.now();
    setCacheTimestamp(cacheTimestamp);

    // Update localStorage cache
    setCachedMeasurements(measurementsCache);
}

// Clear cache (for logout or business change)
function clearCache() {
    clientsCache = null;
    measurementsCache = null;
    cacheTimestamp = null;

    // Clear localStorage cache
    clearLocalStorageCache();
}

// Save clients (legacy function - kept for compatibility but will use individual operations)
async function saveClients(clients) {
    // This function is kept for compatibility but shouldn't be used
    // Use individual insert/update/delete operations instead
    console.warn('saveClients is deprecated - use individual operations');
}

// Update client
async function updateClient(clientId, name, phone, sex) {
    const user = await getCurrentUser();
    if (!user) {
        console.error('[UpdateClient] No user found');
        return null;
    }

    // Find client in IndexedDB first to get local_id
    let client = null;
    try {
        client = await window.indexedDBHelper.getClientLocal(clientId, user.id);
    } catch (err) {
        console.error('[UpdateClient] Error finding client in IndexedDB:', err);
        // Try to find in cache as fallback
        client = clientsCache?.find(c => c.id === clientId);
    }

    if (!client) {
        console.error('[UpdateClient] Client not found:', clientId);
        return null;
    }

    // Prepare update data
    const updateData = {
        name: name.trim(),
        phone: phone ? phone.trim() : '',
        sex: sex || ''
    };

    // Update IndexedDB immediately (local-first)
    let updatedClient = null;
    try {
        if (client.local_id && window.indexedDBHelper) {
            updatedClient = await window.indexedDBHelper.updateClientLocal(client.local_id, updateData, user.id);
            // Normalize the returned client
            updatedClient = {
                id: updatedClient.id || client.server_id || client.local_id,
                server_id: client.server_id || null,
                local_id: updatedClient.local_id || client.local_id,
                business_id: client.business_id,
                user_id: client.user_id,
                name: updatedClient.name,
                phone: updatedClient.phone || '',
                sex: updatedClient.sex || '',
                createdAt: updatedClient.createdAt || client.createdAt,
                synced: updatedClient.synced !== undefined ? updatedClient.synced : false
            };
        }
    } catch (err) {
        console.error('[UpdateClient] Error updating client in IndexedDB:', err);
        // Continue with cache update even if IndexedDB update fails
    }

    // If IndexedDB update failed, create updated client from existing
    if (!updatedClient) {
        updatedClient = {
            ...client,
            ...updateData
        };
    }

    // Update cache immediately
    updateClientInCache(clientId, updatedClient);

    // Sync with Supabase in background (non-blocking) or queue if offline
    (async () => {
        // If offline, add to sync queue
        if (!isOnline()) {
            addToPendingSyncQueue('update_client', {
                clientId: clientId,
                name: name.trim(),
                phone: phone ? phone.trim() : null,
                sex: sex || null
            });
            return;
        }

        const supabase = await getSupabaseAsync();
        if (!supabase) {
            // Supabase not available, queue for later
            addToPendingSyncQueue('update_client', {
                clientId: clientId,
                name: name.trim(),
                phone: phone ? phone.trim() : null,
                sex: sex || null
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('clients')
                .update({
                    name: name.trim(),
                    phone: phone ? phone.trim() : null,
                    sex: sex || null
                })
                .eq('id', clientId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Update IndexedDB and cache with server response (mark as synced)
            if (data && client.local_id && window.indexedDBHelper) {
                try {
                    await window.indexedDBHelper.updateClientLocal(client.local_id, {
                        name: data.name,
                        phone: data.phone || '',
                        sex: data.sex || '',
                        synced: true
                    }, user.id);

                    // Update cache with synced data
                    updateClientInCache(clientId, {
                        id: data.id,
                        name: data.name,
                        phone: data.phone || '',
                        sex: data.sex || '',
                        synced: true
                    });
                } catch (err) {
                    console.error('[UpdateClient] Error updating IndexedDB after sync:', err);
                }
            }
        } catch (err) {
            console.error('Error updating client in background:', err);
            // If error, queue for retry
            addToPendingSyncQueue('update_client', {
                clientId: clientId,
                name: name.trim(),
                phone: phone ? phone.trim() : null,
                sex: sex || null
            });
        }
    })();

    // Return updated client immediately (from IndexedDB update)
    return updatedClient;
}

// Delete client and all associated measurements - uses user_id, requires internet
async function deleteClient(clientId) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('You must be logged in to delete a client.');
    }

    // Initialize IndexedDB if needed
    if (!window.indexedDBHelper) {
        await window.indexedDBHelper.initDB();
    }

    try {
        // LOCAL-FIRST: Delete from IndexedDB first
        // Find client by local_id or server_id to get local_id
        const client = await window.indexedDBHelper.getClientLocal(clientId, user.id);
        if (!client) {
            throw new Error('Client not found');
        }

        const localId = client.local_id;

        // Delete all measurements for this client from IndexedDB first
        const measurements = await window.indexedDBHelper.getMeasurementsByBusinessId(client.business_id, clientId);
        for (const measurement of measurements) {
            try {
                await window.indexedDBHelper.deleteMeasurementLocal(measurement.local_id, user.id);
            } catch (err) {
                console.warn('[DeleteClient] Error deleting measurement from IndexedDB:', err);
            }
        }

        // Delete client from IndexedDB
        await window.indexedDBHelper.deleteClientLocal(localId, user.id);

        // Remove from cache
        removeClientFromCache(clientId);
        if (measurementsCache) {
            measurementsCache = measurementsCache.filter(m => m.client_id !== clientId);
            setCachedMeasurements(measurementsCache);
        }

        // Update UI immediately
        if (typeof renderClientsList === 'function') {
            renderClientsList();
        }

        showToast('Client deleted', 'success', 2000);

        // Sync deletion to Supabase if online (non-blocking)
        if (isOnline()) {
            (async () => {
                const supabase = await getSupabaseAsync();
                if (supabase) {
                    try {
                        // Delete measurements first (cascade should handle this, but being explicit)
                        await supabase
                            .from('measurements')
                            .delete()
                            .eq('client_id', clientId)
                            .eq('user_id', user.id);

                        // Delete client
                        const { error } = await supabase
                            .from('clients')
                            .delete()
                            .eq('id', clientId)
                            .eq('user_id', user.id);

                        if (error) {
                            console.error('[DeleteClient] Error syncing deletion to Supabase:', error);
                            // Don't show error to user - deletion already succeeded locally
                        } else {
                            console.log('[DeleteClient] Client deletion synced to Supabase');
                        }
                    } catch (err) {
                        console.error('[DeleteClient] Error syncing deletion to Supabase:', err);
                        // Don't show error to user - deletion already succeeded locally
                    }
                }
            })();
        }
    } catch (err) {
        console.error('Error deleting client:', err);
        showToast(err.message || 'Failed to delete client. Please try again.', 'error', 4000);
        // Re-fetch to restore correct state
        getClients(true).then(() => {
            if (typeof renderClientsList === 'function') {
                renderClientsList();
            }
        });
        throw err;
    }
}

// Save measurements (legacy function - kept for compatibility but will use individual operations)
async function saveMeasurements(legacyMeasurements) {
    // This function is kept for compatibility but shouldn't be used
    // Use individual insert/update/delete operations instead
    console.warn('saveMeasurements is deprecated - use individual operations');
}

// Find or create client - LOCAL-FIRST: saves to IndexedDB immediately
async function findOrCreateClient(name, phone, sex) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('You must be logged in to create a client.');
    }

    // Initialize IndexedDB if needed
    if (!window.indexedDBHelper) {
        await window.indexedDBHelper.initDB();
    }

    const phoneNormalized = phone ? phone.trim() : '';
    const nameTrimmed = name.trim();

    // Get business for this user (required for business_id)
    // CRITICAL: Use cached business when offline, never call Supabase
    let business = getCachedBusiness();

    // Only query Supabase if online AND we don't have cached business
    if (isOnline() && !business) {
        try {
            business = await getBusinessForUser(user.id);
            if (business) {
                // Cache the business for offline use
                setCachedBusiness(business);
            }
        } catch (err) {
            console.warn('[findOrCreateClient] Error fetching business:', err);
            // Continue with cached business if available
        }
    }

    // STRICT GUARD: business_id MUST exist and be valid UUID
    if (!business || !business.id) {
        throw new Error('CRITICAL: Business not found. Cannot create client without valid business_id.');
    }

    // STRICT GUARD: Verify business_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(business.id)) {
        throw new Error('CRITICAL: Invalid business_id format. Must be valid UUID.');
    }

    // STRICT GUARD: If offline, verify business exists locally (parent UUID confirmed)
    if (!isOnline()) {
        // Use cached business (which should be set on login)
        const cachedBusiness = getCachedBusiness();
        if (!cachedBusiness || cachedBusiness.id !== business.id) {
            throw new Error('CRITICAL: Cannot create client offline without confirmed parent business UUID.');
        }
    }

    // Try to find existing client in IndexedDB first (within same business scope)
    const allClients = await window.indexedDBHelper.getClientsLocal(user.id);
    const existingClient = allClients.find(c => {
        // Match by name+phone within same business scope
        const nameMatch = c.name.toLowerCase() === nameTrimmed.toLowerCase();
        const businessMatch = c.business_id === business.id;
        if (phoneNormalized) {
            return businessMatch && nameMatch && c.phone === phoneNormalized;
        } else {
            return businessMatch && nameMatch && !c.phone;
        }
    });

    if (existingClient) {
        // Client exists - update if needed
        let needsUpdate = false;
        const updates = {};

        if (phoneNormalized && existingClient.phone !== phoneNormalized) {
            updates.phone = phoneNormalized;
            needsUpdate = true;
        }

        if (sex && existingClient.sex !== sex) {
            updates.sex = sex;
            needsUpdate = true;
        }

        if (needsUpdate) {
            await window.indexedDBHelper.updateClientLocal(existingClient.local_id, updates, user.id);
            // Refresh from IndexedDB
            const updated = await window.indexedDBHelper.getClientLocal(existingClient.local_id, user.id);
            return updated;
        }

        return existingClient;
    }

    // Create new client - STRICT: Only if business_id confirmed
    // STRICT GUARD: Do NOT insert if fetch failed or business_id invalid
    if (!isOnline() && !business.id) {
        throw new Error('CRITICAL: Cannot create client offline without valid business_id.');
    }

    try {
        // STRICT: Generate UUID ONCE at creation, NEVER regenerate
        const clientId = generateUUID();

        // Determine if this is an offline save
        const isOffline = !isOnline();

        // Mark as synced if online (will be verified/reconciled later)
        // Don't block on verification - let reconciliation handle sync verification
        const synced = isOnline() && !isOffline;

        const clientData = {
            server_id: clientId, // UUID generated ONCE
            name: nameTrimmed,
            phone: phoneNormalized || null,
            sex: sex || null,
            synced: synced,
            created_offline: isOffline,
            created_at: new Date().toISOString()
        };

        // STRICT GUARD: business_id MUST be valid UUID before insert
        const savedClient = await window.indexedDBHelper.saveClientLocal(clientData, user.id, business.id);

        // IMMEDIATE SYNC: Push to Supabase right away (if online) for cross-device sync
        // This is NOT background sync - it's immediate sync on creation
        if (window.immediateSync && isOnline()) {
            try {
                const syncResult = await window.immediateSync.syncClientImmediately(savedClient, user.id, business.id);
                if (syncResult.synced) {
                    console.log('[findOrCreateClient] Client immediately synced to Supabase:', syncResult.id);
                } else {
                    console.log('[findOrCreateClient] Client saved locally, will sync later via reconciliation');
                }
            } catch (syncErr) {
                console.warn('[findOrCreateClient] Immediate sync failed (will sync later):', syncErr);
                // Don't block - client is saved locally, will sync later
            }
        }

        // Update UI immediately
        if (typeof renderClientsList === 'function') {
            renderClientsList();
        }

        // Re-render measurements in case any were showing "Loading..." for this client
        if (typeof renderRecentMeasurements === 'function') {
            setTimeout(() => {
                renderRecentMeasurements(false).catch(() => { }); // Silent failure
            }, 100);
        }

        return savedClient;
    } catch (err) {
        console.error('Error creating client locally:', err);
        showToast('Failed to create client. Please try again.', 'error', 4000);
        throw err;
    }
}

// Update garment type dropdown based on sex
function updateGarmentTypes(sex) {
    const garmentSelect = document.getElementById('garment-type');
    const currentValue = garmentSelect.value;

    // Clear existing options except the first one
    garmentSelect.innerHTML = '<option value="">Select garment type</option>';

    if (sex && GARMENT_TYPES[sex]) {
        GARMENT_TYPES[sex].forEach(garment => {
            const option = document.createElement('option');
            option.value = garment;
            option.textContent = garment;
            garmentSelect.appendChild(option);
        });

        // Try to restore previous selection if it's still valid
        if (currentValue && GARMENT_TYPES[sex].includes(currentValue)) {
            garmentSelect.value = currentValue;
            updateMeasurementFields(currentValue);
            handleCustomGarmentVisibility(currentValue);
            handleAddFieldButtonVisibility(currentValue);
        } else {
            // Clear fields if garment type is not valid
            updateMeasurementFields('');
            handleCustomGarmentVisibility('');
            handleAddFieldButtonVisibility('');
        }
    } else {
        updateMeasurementFields('');
        handleCustomGarmentVisibility('');
        handleAddFieldButtonVisibility('');
    }
}

// Handle Custom garment input visibility
function handleCustomGarmentVisibility(garmentType) {
    const customGarmentGroup = document.getElementById('custom-garment-group');
    const customGarmentInput = document.getElementById('custom-garment-name');

    if (garmentType === 'Custom') {
        customGarmentGroup.style.display = 'block';
        customGarmentInput.required = true;
    } else {
        customGarmentGroup.style.display = 'none';
        customGarmentInput.required = false;
        customGarmentInput.value = '';
    }
}

// Handle Add Measurement Field button visibility
function handleAddFieldButtonVisibility(garmentType) {
    const addFieldWrapper = document.getElementById('add-custom-field-wrapper');

    if (garmentType && garmentType !== '') {
        // Show the Add Measurement Field button when any garment type is selected
        addFieldWrapper.style.display = 'flex';
    } else {
        // Hide when no garment type selected
        addFieldWrapper.style.display = 'none';
    }
}

// Update measurement fields visibility based on garment type
function updateMeasurementFields(garmentType) {
    const allFields = ['shoulder', 'chest', 'waist', 'sleeve', 'length', 'neck', 'hip', 'inseam', 'thigh', 'seat'];

    // For Custom garment type, show ALL fields
    if (garmentType === 'Custom') {
        allFields.forEach(field => {
            const fieldElement = document.getElementById(field);
            if (fieldElement) {
                fieldElement.closest('.form-group').style.display = 'block';
            }
        });
        return;
    }

    if (!garmentType || !GARMENT_FIELDS[garmentType]) {
        // Hide all fields if no garment type selected
        allFields.forEach(field => {
            const fieldElement = document.getElementById(field);
            if (fieldElement) {
                fieldElement.closest('.form-group').style.display = 'none';
            }
        });
        return;
    }

    const requiredFields = GARMENT_FIELDS[garmentType];

    // Show/hide fields based on garment type
    allFields.forEach(field => {
        const fieldElement = document.getElementById(field);
        if (fieldElement) {
            const formGroup = fieldElement.closest('.form-group');
            if (requiredFields.includes(field)) {
                formGroup.style.display = 'block';
            } else {
                formGroup.style.display = 'none';
                // Clear value when hiding
                fieldElement.value = '';
            }
        }
    });
}

// Check if client exists and update form accordingly
async function checkExistingClient() {
    const nameInput = document.getElementById('client-name');
    const name = nameInput.value.trim();
    const sexSelect = document.getElementById('client-sex');
    const phoneInput = document.getElementById('phone-number');

    if (!name) {
        sexSelect.disabled = false;
        sexSelect.required = true;
        updateGarmentTypes('');
        return;
    }

    const clients = await getClients();
    if (!Array.isArray(clients)) return;

    const existingClient = clients.find(c =>
        c.name.toLowerCase() === name.toLowerCase()
    );

    if (existingClient) {
        // Client exists - pre-fill sex and phone
        if (existingClient.sex) {
            sexSelect.value = existingClient.sex;
            sexSelect.disabled = true; // Don't allow changing sex for existing client
            sexSelect.required = false;
            updateGarmentTypes(existingClient.sex);
        } else {
            // Old client without sex - allow setting it
            sexSelect.disabled = false;
            sexSelect.required = true;
            updateGarmentTypes('');
        }
        if (existingClient.phone && !phoneInput.value) {
            phoneInput.value = existingClient.phone;
        }
    } else {
        // New client - enable sex selection
        sexSelect.disabled = false;
        sexSelect.required = true;
        if (!sexSelect.value) {
            updateGarmentTypes('');
        }
    }
}

// Save measurement (create or update) - LOCAL-FIRST: saves to IndexedDB immediately
async function saveMeasurement(clientId, formData, measurementId = null) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('You must be logged in to save a measurement.');
    }

    // Initialize IndexedDB if needed
    if (!window.indexedDBHelper) {
        await window.indexedDBHelper.initDB();
    }

    // Get business for this user (required for business_id)
    // CRITICAL: Use cached business when offline, never call Supabase
    let business = getCachedBusiness();

    // Only query Supabase if online AND we don't have cached business
    if (isOnline() && !business) {
        try {
            business = await getBusinessForUser(user.id);
            if (business) {
                // Cache the business for offline use
                setCachedBusiness(business);
            }
        } catch (err) {
            console.warn('[saveMeasurement] Error fetching business:', err);
            // Continue with cached business if available
        }
    }

    // STRICT GUARD: business_id MUST exist and be valid UUID
    if (!business || !business.id) {
        throw new Error('CRITICAL: Business not found. Cannot create measurement without valid business_id.');
    }

    // STRICT GUARD: Verify business_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(business.id)) {
        throw new Error('CRITICAL: Invalid business_id format. Must be valid UUID.');
    }

    // STRICT GUARD: client_id MUST exist and be valid UUID
    if (!clientId) {
        throw new Error('CRITICAL: client_id is required. Cannot create measurement without valid client_id.');
    }

    // Resolve client_id and verify it exists within same business scope
    let resolvedClientId = clientId;
    const client = await window.indexedDBHelper.getClientLocal(clientId, user.id);

    if (!client) {
        throw new Error(`CRITICAL: Client with id ${clientId} not found. Cannot create measurement with invalid client_id.`);
    }

    // STRICT GUARD: Verify client belongs to same business
    // Check both possible field names for business_id
    const clientBusinessId = client.business_id || client.businessId;
    const currentBusinessId = business.id || business.business_id;

    // If client has no business_id or it doesn't match, fix it
    if (!clientBusinessId || clientBusinessId !== currentBusinessId) {
        // Debug: Log the mismatch for troubleshooting
        console.warn('[saveMeasurement] Client business_id missing or mismatch:', {
            clientBusinessId: clientBusinessId || 'MISSING',
            currentBusinessId,
            client: {
                id: client.id,
                server_id: client.server_id,
                local_id: client.local_id,
                business_id: client.business_id,
                businessId: client.businessId,
                user_id: client.user_id
            },
            business: {
                id: business.id,
                business_id: business.business_id,
                user_id: business.user_id,
                name: business.name
            },
            user_id: user.id
        });

        // Always fix if business_id is missing or different (client belongs to this user)
        console.log('[saveMeasurement] Fixing client business_id and user_id to match current business');
        try {
            // Update client's business_id and user_id to match current business/user
            const updates = {
                business_id: currentBusinessId,
                user_id: user.id // Also ensure user_id is set
            };
            await window.indexedDBHelper.updateClientLocal(client.local_id, updates, user.id);
            // Update local client object for current operation
            client.business_id = currentBusinessId;
            client.user_id = user.id;
            console.log('[saveMeasurement] Client business_id and user_id updated successfully');
        } catch (updateErr) {
            console.error('[saveMeasurement] Failed to update client business_id/user_id:', updateErr);
            throw new Error(`CRITICAL: Client business_id/user_id missing and cannot be fixed. Please recreate the client. Error: ${updateErr.message}`);
        }
    }

    // STRICT GUARD: Verify client_id is a valid UUID
    const clientServerId = client.server_id || client.id;
    if (!uuidRegex.test(clientServerId)) {
        throw new Error('CRITICAL: Invalid client_id format. Must be valid UUID.');
    }

    resolvedClientId = clientServerId; // Use server_id for Supabase, ensure it's valid UUID

    if (measurementId) {
        // Update existing measurement - LOCAL-FIRST
        try {
            // Find measurement by local_id or server_id
            let localId = measurementId;
            const existingMeasurement = await window.indexedDBHelper.getMeasurementLocal(measurementId, user.id);
            if (existingMeasurement) {
                localId = existingMeasurement.local_id;
            }

            const updates = {
                garment_type: formData.garmentType || null,
                shoulder: formData.shoulder || null,
                chest: formData.chest || null,
                waist: formData.waist || null,
                sleeve: formData.sleeve || null,
                length: formData.length || null,
                neck: formData.neck || null,
                hip: formData.hip || null,
                inseam: formData.inseam || null,
                thigh: formData.thigh || null,
                seat: formData.seat || null,
                notes: formData.notes || null,
                custom_fields: formData.customFields || {}
            };

            const updated = await window.indexedDBHelper.updateMeasurementLocal(localId, updates, user.id);

            // Normalize the returned measurement
            const normalizedMeasurement = {
                id: updated.id || existingMeasurement.server_id || existingMeasurement.local_id,
                server_id: existingMeasurement.server_id || null,
                local_id: updated.local_id || existingMeasurement.local_id,
                client_id: updated.client_id || existingMeasurement.client_id,
                business_id: existingMeasurement.business_id,
                user_id: existingMeasurement.user_id,
                garment_type: updated.garment_type || null,
                date_created: updated.date_created || existingMeasurement.created_at,
                shoulder: updated.shoulder || null,
                chest: updated.chest || null,
                waist: updated.waist || null,
                sleeve: updated.sleeve || null,
                length: updated.length || null,
                neck: updated.neck || null,
                hip: updated.hip || null,
                inseam: updated.inseam || null,
                thigh: updated.thigh || null,
                seat: updated.seat || null,
                notes: updated.notes || null,
                customFields: updated.customFields || {},
                synced: updated.synced !== undefined ? updated.synced : false
            };

            // Update cache immediately
            // Ensure cache is initialized
            if (!measurementsCache) {
                measurementsCache = [];
            }
            // Update or add to cache
            const cacheIndex = measurementsCache.findIndex(m => m.id === normalizedMeasurement.id);
            if (cacheIndex !== -1) {
                measurementsCache[cacheIndex] = normalizedMeasurement;
            } else {
                measurementsCache.push(normalizedMeasurement);
            }
            cacheTimestamp = Date.now();
            setCacheTimestamp(cacheTimestamp);
            setCachedMeasurements(measurementsCache);

            // IMMEDIATE SYNC: Push to Supabase right away (if online) for cross-device sync
            // This is NOT background sync - it's immediate sync on update
            if (window.immediateSync && isOnline() && business) {
                try {
                    const syncResult = await window.immediateSync.syncMeasurementImmediately(normalizedMeasurement, user.id, business.id, normalizedMeasurement.client_id);
                    if (syncResult.synced) {
                        console.log('[saveMeasurement] Measurement update immediately synced to Supabase:', syncResult.id);
                        // Mark as synced in IndexedDB
                        if (normalizedMeasurement.local_id && window.indexedDBHelper) {
                            await window.indexedDBHelper.updateMeasurementLocal(normalizedMeasurement.local_id, { synced: true }, user.id);
                            normalizedMeasurement.synced = true;
                            updateMeasurementInCache(normalizedMeasurement.id, { synced: true });
                        }
                    } else {
                        console.log('[saveMeasurement] Measurement update saved locally, will sync later via reconciliation');
                    }
                } catch (syncErr) {
                    console.warn('[saveMeasurement] Immediate sync failed (will sync later):', syncErr);
                    // Don't block - measurement is updated locally, will sync later
                }
            }

            // Show success message
            showToast('Measurement updated successfully!', 'success', 2000);

            // Update UI immediately
            const currentScreen = document.querySelector('.screen.active');
            if (currentScreen?.id === 'home-screen') {
                renderRecentMeasurements();
            }

            return normalizedMeasurement;
        } catch (err) {
            console.error('Error updating measurement locally:', err);
            showToast('Failed to update measurement. Please try again.', 'error', 4000);
            throw err;
        }
    } else {
        // Create new measurement - STRICT: Only if parent UUIDs confirmed
        // STRICT GUARD: Do NOT insert if fetch failed or parent UUIDs invalid
        if (!isOnline() && (!business.id || !resolvedClientId)) {
            throw new Error('CRITICAL: Cannot create measurement offline without confirmed parent UUIDs.');
        }

        try {
            // STRICT: Generate UUID ONCE at creation, NEVER regenerate
            const measurementId = generateUUID();

            // Determine if this is an offline save
            const isOffline = !isOnline();

            // Mark as synced if online (will be verified/reconciled later)
            // Don't block on verification - let reconciliation handle sync verification
            const synced = isOnline() && !isOffline;

            const measurementData = {
                server_id: measurementId, // UUID generated ONCE
                client_id: resolvedClientId,
                garment_type: formData.garmentType || null,
                shoulder: formData.shoulder || null,
                chest: formData.chest || null,
                waist: formData.waist || null,
                sleeve: formData.sleeve || null,
                length: formData.length || null,
                neck: formData.neck || null,
                hip: formData.hip || null,
                inseam: formData.inseam || null,
                thigh: formData.thigh || null,
                seat: formData.seat || null,
                notes: formData.notes || null,
                custom_fields: formData.customFields || {},
                synced: synced,
                created_offline: isOffline,
                created_at: new Date().toISOString()
            };

            const savedMeasurement = await window.indexedDBHelper.saveMeasurementLocal(measurementData, user.id, business.id);

            // IMMEDIATE SYNC: Push to Supabase right away (if online) for cross-device sync
            // This is NOT background sync - it's immediate sync on creation
            if (window.immediateSync && isOnline()) {
                try {
                    const syncResult = await window.immediateSync.syncMeasurementImmediately(savedMeasurement, user.id, business.id, resolvedClientId);
                    if (syncResult.synced) {
                        console.log('[saveMeasurement] Measurement immediately synced to Supabase:', syncResult.id);
                    } else {
                        console.log('[saveMeasurement] Measurement saved locally, will sync later via reconciliation');
                    }
                } catch (syncErr) {
                    console.warn('[saveMeasurement] Immediate sync failed (will sync later):', syncErr);
                    // Don't block - measurement is saved locally, will sync later
                }
            }

            // Update UI immediately
            const currentScreen = document.querySelector('.screen.active');
            if (currentScreen?.id === 'home-screen') {
                renderRecentMeasurements(false); // Don't reset pagination
            }

            return savedMeasurement;
        } catch (err) {
            console.error('Error creating measurement locally:', err);
            // STRICT: HARD FAIL if parent UUIDs invalid
            if (err.message && (err.message.includes('CRITICAL') || err.message.includes('Business') || err.message.includes('Client'))) {
                throw err; // Re-throw critical errors
            }
            // Only throw error if it's a real database error (not offline-related)
            if (isOnline() && err.message && !err.message.includes('offline')) {
                showToast('Failed to create measurement. Please try again.', 'error', 4000);
                throw err;
            } else {
                // Offline save failed - HARD FAIL if parent UUIDs not confirmed
                console.error('[saveMeasurement] Offline save failed:', err);
                throw new Error('CRITICAL: Cannot create measurement offline without confirmed parent UUIDs.');
            }
        }
    }
}

// Edit measurement
async function editMeasurement(measurementId, clientId) {
    const measurements = await getMeasurements();
    const clients = await getClients();

    if (!Array.isArray(measurements)) {
        alert('Error loading measurements');
        return;
    }
    if (!Array.isArray(clients)) {
        alert('Error loading clients');
        return;
    }

    const measurement = measurements.find(m => m.id === measurementId);
    const client = clients.find(c => c.id === clientId);

    if (!measurement || !client) {
        alert('Measurement or client not found');
        return;
    }

    currentMeasurementId = measurementId;
    currentClientId = clientId;

    // Update form header
    document.querySelector('#new-measurement-screen h2').textContent = 'Edit Measurement';

    // Pre-fill form with measurement data
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-name').disabled = true;
    document.getElementById('phone-number').value = client.phone || '';

    if (client.sex) {
        document.getElementById('client-sex').value = client.sex;
        document.getElementById('client-sex').disabled = true;
        document.getElementById('client-sex').required = false;
        updateGarmentTypes(client.sex);
    }

    // Set garment type and update fields
    if (measurement.garment_type) {
        const garmentSelect = document.getElementById('garment-type');
        const isCustomGarment = !GARMENT_TYPES[client.sex]?.includes(measurement.garment_type);

        if (isCustomGarment) {
            // This is a custom garment type - set dropdown to "Custom" and fill in the name
            garmentSelect.value = 'Custom';
            handleCustomGarmentVisibility('Custom');
            document.getElementById('custom-garment-name').value = measurement.garment_type;
            updateMeasurementFields('Custom');
        } else {
            garmentSelect.value = measurement.garment_type;
            updateMeasurementFields(measurement.garment_type);
        }
        handleAddFieldButtonVisibility(measurement.garment_type || 'Custom');
    }

    // Fill in all measurement values
    document.getElementById('shoulder').value = measurement.shoulder || '';
    document.getElementById('chest').value = measurement.chest || '';
    document.getElementById('waist').value = measurement.waist || '';
    document.getElementById('sleeve').value = measurement.sleeve || '';
    document.getElementById('length').value = measurement.length || '';
    document.getElementById('neck').value = measurement.neck || '';
    document.getElementById('hip').value = measurement.hip || '';
    document.getElementById('inseam').value = measurement.inseam || '';
    document.getElementById('thigh').value = measurement.thigh || '';
    document.getElementById('seat').value = measurement.seat || '';
    document.getElementById('notes').value = measurement.notes || '';

    // Load custom fields
    const customFieldsContainer = document.getElementById('custom-fields-container');
    customFieldsContainer.innerHTML = '';
    if (measurement.customFields && typeof measurement.customFields === 'object') {
        Object.entries(measurement.customFields).forEach(([name, value]) => {
            if (name && value !== null && value !== undefined) {
                addCustomFieldRow(name, value);
            }
        });
    }

    // Show measurement form
    showScreen('new-measurement-screen');
}

// Delete measurement (optimistic)
async function deleteMeasurement(measurementId, clientId) {
    if (!confirm('Are you sure you want to delete this measurement?')) {
        return;
    }

    const user = await getCurrentUser();
    if (!user) {
        showToast('You must be logged in to delete a measurement.', 'error', 4000);
        return;
    }

    // Initialize IndexedDB if needed
    if (!window.indexedDBHelper) {
        await window.indexedDBHelper.initDB();
    }

    try {
        // LOCAL-FIRST: Delete from IndexedDB first
        // Find measurement by local_id or server_id to get local_id
        const measurement = await window.indexedDBHelper.getMeasurementLocal(measurementId, user.id);
        if (!measurement) {
            throw new Error('Measurement not found');
        }

        const localId = measurement.local_id;

        // Delete from IndexedDB
        await window.indexedDBHelper.deleteMeasurementLocal(localId, user.id);

        // Remove from cache immediately
        removeMeasurementFromCache(measurementId);

        // Update UI immediately
        showToast('Measurement deleted', 'success', 2000);

        // Update client details view
        if (clientId) {
            showClientDetails(clientId, previousScreen).catch(err => {
                console.warn('Error showing client details:', err);
            });
        } else {
            // If no clientId, refresh recent measurements
            const currentScreen = document.querySelector('.screen.active');
            if (currentScreen?.id === 'home-screen') {
                renderRecentMeasurements();
            }
        }

        // Sync deletion to Supabase if online (non-blocking)
        if (isOnline()) {
            (async () => {
                const supabase = await getSupabaseAsync();
                if (supabase) {
                    try {
                        const { error } = await supabase
                            .from('measurements')
                            .delete()
                            .eq('id', measurementId);

                        if (error) {
                            console.error('[DeleteMeasurement] Error syncing deletion to Supabase:', error);
                            // Don't show error to user - deletion already succeeded locally
                        } else {
                            console.log('[DeleteMeasurement] Measurement deletion synced to Supabase');
                        }
                    } catch (err) {
                        console.error('[DeleteMeasurement] Error syncing deletion to Supabase:', err);
                        // Don't show error to user - deletion already succeeded locally
                    }
                }
            })();
        }
    } catch (err) {
        console.error('Error deleting measurement:', err);
        showToast(err.message || 'Failed to delete measurement. Please try again.', 'error', 4000);
        // Re-fetch to restore correct state
        getMeasurements(true).then(() => {
            if (clientId) {
                showClientDetails(clientId, previousScreen);
            } else {
                const currentScreen = document.querySelector('.screen.active');
                if (currentScreen?.id === 'home-screen') {
                    renderRecentMeasurements();
                }
            }
        });
    }
}

// Update business header name (async - fetches from Supabase)
async function updateBusinessHeader() {
    const headerElement = document.getElementById('business-header-name');
    if (headerElement) {
        const business = await getBusiness();
        updateBusinessHeaderSync(business);
    }
}

// Update business header name (sync - uses provided business object)
function updateBusinessHeaderSync(business) {
    const headerElement = document.getElementById('business-header-name');
    if (headerElement) {
        // If business is null/undefined, try to get from cache
        if (!business) {
            business = getCachedBusiness();
        }
        if (business && business.name && !isUserLoggedOut()) {
            const businessName = business.name;
            headerElement.textContent = businessName;
            headerElement.setAttribute('title', businessName);
        } else {
            headerElement.textContent = 'Tailors Vault';
            headerElement.removeAttribute('title');
        }
    }
}

// Update business name in all navbar instances (async - fetches from Supabase)
async function updateNavbarBusinessName() {
    const business = await getBusiness();
    updateNavbarBusinessNameSync(business);
}

// Update business name in all navbar instances (sync - uses provided business object)
function updateNavbarBusinessNameSync(business) {
    // If business is null/undefined, try to get from cache
    if (!business) {
        business = getCachedBusiness();
    }
    const businessName = (business && business.name && !isUserLoggedOut()) ? business.name : 'Tailors Vault';

    document.querySelectorAll('.navbar-business-name').forEach(element => {
        element.textContent = businessName;
        if (business && business.name) {
            element.setAttribute('title', businessName);
        } else {
            element.removeAttribute('title');
        }
    });

    // Update dashboard greeting business name
    const dashboardBusinessName = document.getElementById('dashboard-business-name');
    if (dashboardBusinessName) {
        dashboardBusinessName.textContent = businessName;
    }
}

// Screen Navigation (Optimized)
function showScreen(screenId) {
    try {
        // Cache screens on first use
        if (!cachedScreens) {
            cachedScreens = Array.from(document.querySelectorAll('.screen'));
        }

        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
            // Hide all screens (batch DOM updates)
            cachedScreens.forEach(screen => {
                screen.classList.remove('active');
                screen.style.display = '';
            });

            // Show the requested screen
            const targetScreen = document.getElementById(screenId);
            if (!targetScreen) {
                console.error(`Screen not found: ${screenId}`);
                // Fallback to login screen if screen doesn't exist
                const loginScreen = document.getElementById('login-screen');
                if (loginScreen) {
                    loginScreen.classList.add('active');
                    loginScreen.style.display = '';
                } else {
                    console.error('Login screen also not found!');
                }
                return;
            }

            targetScreen.classList.add('active');
            targetScreen.style.display = '';

            // Defer heavy operations to next frame for instant screen switch
            requestAnimationFrame(() => {
                // Update business header when showing home screen (deferred)
                if (screenId === 'home-screen') {
                    try {
                        updateBusinessHeader();
                    } catch (err) {
                        console.warn('Error updating business header:', err);
                    }
                }

                // Update business name in all navbar instances (deferred)
                try {
                    updateNavbarBusinessName();
                } catch (err) {
                    console.warn('Error updating navbar business name:', err);
                }
            });
        });
    } catch (err) {
        console.error('Error in showScreen:', err);
        // Try to show login screen as fallback
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.classList.add('active');
        }
    }
}

// Navigation Event Listeners
document.getElementById('new-measurement-btn').addEventListener('click', () => {
    // Show screen immediately
    showScreen('new-measurement-screen');

    // Defer heavy operations
    requestAnimationFrame(() => {
        resetMeasurementForm();
        const h2 = document.querySelector('#new-measurement-screen h2');
        if (h2) h2.textContent = 'New Measurement';
        const clientNameInput = document.getElementById('client-name');
        if (clientNameInput) clientNameInput.focus();
    });
});

document.getElementById('search-measurements-btn').addEventListener('click', () => {
    // Show screen immediately
    showScreen('search-screen');

    // Defer operations
    requestAnimationFrame(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            renderSearchResults('');
        }
    });
});


document.getElementById('back-from-search-btn').addEventListener('click', () => {
    // Show screen immediately
    showScreen('home-screen');

    // Defer operations
    requestAnimationFrame(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        renderRecentMeasurements();
    });
});

// Track previous screen for back navigation
let previousScreen = 'home-screen';

document.getElementById('back-from-details-btn').addEventListener('click', () => {
    showScreen(previousScreen);
});

// Clients Screen Navigation
document.getElementById('clients-btn').addEventListener('click', async () => {
    // Show screen immediately
    showScreen('clients-screen');

    // Load data asynchronously after screen is shown
    requestAnimationFrame(async () => {
        await renderClientsList();
    });
});

document.getElementById('back-from-clients-btn').addEventListener('click', () => {
    showScreen('home-screen');
    renderRecentMeasurements();
});

// Track current client ID when viewing details (for adding measurements)
let currentClientId = null;
// Track current measurement ID when editing
let currentMeasurementId = null;

// Form Submission
document.getElementById('measurement-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Handle custom garment type
    let garmentType = document.getElementById('garment-type').value;
    if (garmentType === 'Custom') {
        const customGarmentName = document.getElementById('custom-garment-name').value.trim();
        if (!customGarmentName) {
            alert('Please enter a custom garment name');
            return;
        }
        garmentType = customGarmentName;
    }

    // Collect custom fields from inline inputs
    const customFields = {};
    const customFieldGroups = document.querySelectorAll('#custom-fields-container .custom-field-group');
    customFieldGroups.forEach(group => {
        const input = group.querySelector('.custom-field-input');
        if (input) {
            const fieldName = input.getAttribute('data-field-name');
            const fieldValue = input.value.trim() || null;
            if (fieldName && fieldValue !== null) {
                customFields[fieldName] = fieldValue;
            }
        }
    });

    const formData = {
        clientName: document.getElementById('client-name').value.trim(),
        phone: document.getElementById('phone-number').value.trim(),
        sex: document.getElementById('client-sex').value,
        garmentType: garmentType,
        shoulder: document.getElementById('shoulder').value.trim() || null,
        chest: document.getElementById('chest').value.trim() || null,
        waist: document.getElementById('waist').value.trim() || null,
        sleeve: document.getElementById('sleeve').value.trim() || null,
        length: document.getElementById('length').value.trim() || null,
        neck: document.getElementById('neck').value.trim() || null,
        hip: document.getElementById('hip').value.trim() || null,
        inseam: document.getElementById('inseam').value.trim() || null,
        thigh: document.getElementById('thigh').value.trim() || null,
        seat: document.getElementById('seat').value.trim() || null,
        notes: document.getElementById('notes').value.trim(),
        customFields: customFields
    };

    if (!formData.clientName) {
        alert('Client name is required');
        return;
    }

    if (!formData.sex) {
        alert('Sex is required');
        return;
    }

    // Disable submit button for instant feedback
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    // Find or create client (optimistic - returns immediately)
    // Wrap in try/catch to handle offline gracefully
    let client;
    try {
        client = await findOrCreateClient(formData.clientName, formData.phone, formData.sex);
        if (!client) {
            throw new Error('Failed to create/find client');
        }
    } catch (err) {
        console.error('[Measurement Form] Error creating/finding client:', err);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
        // Only show error if we're online - offline saves should work silently
        if (isOnline()) {
            showToast('Error creating/finding client', 'error');
        } else {
            showToast('Please check your connection and try again', 'error');
        }
        return;
    }

    // Save measurement (optimistic - returns immediately, syncs in background)
    // Wrap in try/catch to handle offline gracefully
    let measurement;
    try {
        measurement = await saveMeasurement(client.id, formData, currentMeasurementId);
    } catch (err) {
        console.error('[Measurement Form] Error saving measurement:', err);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
        // Never show errors for offline saves - they should always succeed
        // Only show error if it's a real error (not offline)
        if (isOnline() && err.message && !err.message.includes('offline')) {
            showToast('Failed to save measurement. Please try again.', 'error');
        } else {
            // Offline save - show success anyway (saved locally)
            showToast('Measurement saved! (Will sync when online)', 'success', 2000);
            // Clear the in-progress flag
            localStorage.removeItem('measurement-in-progress');
            // Reset form and continue
            resetMeasurementForm();
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            // Return to appropriate screen
            if (currentClientId && currentClientId === client.id) {
                showClientDetails(client.id, previousScreen).catch(() => {
                    showScreen('home-screen');
                    renderRecentMeasurements();
                });
            } else {
                showScreen('home-screen');
                renderRecentMeasurements();
            }
        }
        return;
    }

    // Reset form immediately
    resetMeasurementForm();

    // Clear the in-progress flag since measurement was saved successfully
    localStorage.removeItem('measurement-in-progress');

    // Show success feedback
    showToast('Measurement saved!', 'success', 2000);

    // Re-enable button
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }

    // Return to appropriate screen (non-blocking)
    if (currentClientId && currentClientId === client.id) {
        // We were adding/editing a measurement from client detail view
        showClientDetails(client.id, previousScreen).catch(err => {
            console.error('Error showing client details:', err);
            showScreen('home-screen');
            renderRecentMeasurements();
        });
    } else {
        // Normal flow - return to home
        showScreen('home-screen');
        // Use cache, don't re-fetch
        renderRecentMeasurements();
    }
});

// Reset measurement form
function resetMeasurementForm() {
    document.getElementById('measurement-form').reset();
    document.getElementById('client-name').disabled = false;
    document.getElementById('client-sex').disabled = false;
    document.getElementById('client-sex').required = true;
    currentClientId = null;
    currentMeasurementId = null;
    updateGarmentTypes('');
    updateMeasurementFields('');
    handleCustomGarmentVisibility('');
    handleAddFieldButtonVisibility('');

    // Clear custom fields
    const customFieldsContainer = document.getElementById('custom-fields-container');
    if (customFieldsContainer) {
        customFieldsContainer.innerHTML = '';
    }

    // Reset form header
    const header = document.querySelector('#new-measurement-screen h2');
    if (header) {
        header.textContent = 'New Measurement';
    }

    // Initially hide all measurement fields
    const allFields = ['shoulder', 'chest', 'waist', 'sleeve', 'length', 'neck', 'hip', 'inseam', 'thigh', 'seat'];
    allFields.forEach(field => {
        const fieldElement = document.getElementById(field);
        if (fieldElement) {
            fieldElement.closest('.form-group').style.display = 'none';
        }
    });
}

// Event listeners for form fields
document.getElementById('client-name').addEventListener('input', checkExistingClient);
document.getElementById('client-name').addEventListener('blur', checkExistingClient);

document.getElementById('client-sex').addEventListener('change', (e) => {
    updateGarmentTypes(e.target.value);
});

// Add Measurement button from Client Detail View
document.getElementById('add-measurement-from-details-btn').addEventListener('click', async () => {
    if (!currentClientId) {
        alert('Client not found');
        return;
    }

    const clients = await getClients();
    if (!Array.isArray(clients)) return;

    const client = clients.find(c => c.id === currentClientId);

    if (!client) {
        alert('Client not found');
        return;
    }

    // Reset form first
    resetMeasurementForm();
    currentClientId = client.id;

    // Update form header
    document.querySelector('#new-measurement-screen h2').textContent = 'New Measurement';

    // Pre-fill form with client data
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-name').disabled = true;
    document.getElementById('phone-number').value = client.phone || '';

    if (client.sex) {
        document.getElementById('client-sex').value = client.sex;
        document.getElementById('client-sex').disabled = true;
        document.getElementById('client-sex').required = false;
        updateGarmentTypes(client.sex);
    } else {
        document.getElementById('client-sex').value = '';
        document.getElementById('client-sex').disabled = false;
        document.getElementById('client-sex').required = true;
        updateGarmentTypes('');
    }

    // Show measurement form
    showScreen('new-measurement-screen');
});

// Garment type change listener
document.getElementById('garment-type').addEventListener('change', async (e) => {
    const garmentType = e.target.value;
    updateMeasurementFields(garmentType);
    handleCustomGarmentVisibility(garmentType);
    handleAddFieldButtonVisibility(garmentType);
});

// Update back button from new measurement
document.getElementById('back-from-new-btn').addEventListener('click', async () => {
    // Clear the in-progress flag when user explicitly navigates away
    localStorage.removeItem('measurement-in-progress');

    if (currentClientId) {
        // If we were adding/editing from client detail view, return there
        const clientId = currentClientId;
        resetMeasurementForm();
        await showClientDetails(clientId, previousScreen);
    } else {
        // Normal flow - return to home
        resetMeasurementForm();
        showScreen('home-screen');
        await renderRecentMeasurements();
    }
    // Reset form header
    document.querySelector('#new-measurement-screen h2').textContent = 'New Measurement';
});

// Search Functionality
async function searchClients(query) {
    const clients = await getClients();
    const measurements = await getMeasurements();

    if (!Array.isArray(clients)) return [];
    if (!Array.isArray(measurements)) return [];

    const queryLower = query.toLowerCase().trim();

    if (!queryLower) {
        return [];
    }

    // Filter clients by name or phone
    const matchingClients = clients.filter(client => {
        const nameMatch = client.name.toLowerCase().includes(queryLower);
        const phoneMatch = client.phone && client.phone.includes(queryLower);
        return nameMatch || phoneMatch;
    });

    // Add measurement count to each client
    return matchingClients.map(client => {
        const clientMeasurements = measurements.filter(m => m.client_id === client.id);
        return {
            ...client,
            measurementCount: clientMeasurements.length
        };
    });
}

async function renderSearchResults(query) {
    const resultsContainer = document.getElementById('search-results');
    const clients = await searchClients(query);

    if (!Array.isArray(clients)) {
        resultsContainer.innerHTML = '<div class="no-results">Error loading clients</div>';
        return;
    }

    if (!query.trim()) {
        resultsContainer.innerHTML = '<div class="no-results">Start typing to search for clients...</div>';
        return;
    }

    if (clients.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No clients found</div>';
        return;
    }

    resultsContainer.innerHTML = clients.map((client, index) => {
        // Get initials from client name (same as client list)
        const getInitials = (name) => {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };
        const initials = getInitials(client.name);

        // Secondary text: measurement count or phone
        const secondaryText = client.measurementCount > 0
            ? `${client.measurementCount} measurement${client.measurementCount !== 1 ? 's' : ''}`
            : (client.phone || 'No measurements');

        return `
            <div class="client-leaderboard-card" data-client-id="${client.id}">
                <div class="client-card-index">
                    <span class="client-index-badge">${index + 1}</span>
                </div>
                <div class="client-card-main">
                    <div class="client-avatar">
                        <span class="client-avatar-initials">${initials}</span>
                    </div>
                    <div class="client-card-info">
                        <div class="client-card-name">${escapeHtml(client.name)}</div>
                        <div class="client-card-secondary">${escapeHtml(secondaryText)}</div>
                    </div>
                </div>
                <div class="client-card-right">
                    <div class="client-card-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"></path>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners to client cards (same as client list)
    resultsContainer.querySelectorAll('.client-leaderboard-card').forEach(card => {
        card.addEventListener('click', async () => {
            const clientId = card.getAttribute('data-client-id');
            await showClientDetails(clientId, 'search-screen');
        });
    });
}

// Search input listener
document.getElementById('search-input').addEventListener('input', async (e) => {
    await renderSearchResults(e.target.value);
});

// Show Client Details
async function showClientDetails(clientId, fromScreen = 'search-screen') {
    previousScreen = fromScreen;
    currentClientId = clientId;
    const clients = await getClients();
    const measurements = await getMeasurements();

    if (!Array.isArray(clients)) return;
    if (!Array.isArray(measurements)) return;

    const client = clients.find(c => c.id === clientId);
    if (!client) {
        alert('Client not found');
        return;
    }

    const clientMeasurements = measurements
        .filter(m => m.client_id === clientId)
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

    // Set client name in header
    document.getElementById('client-details-name').textContent = client.name;

    // Render client details
    const detailsContainer = document.getElementById('client-details-content');

    // Always show client info (name, phone, sex)
    let html = `
        <div class="client-info">
            <div class="client-info-item">
                <span class="client-info-label">Name:</span>
                <span>${escapeHtml(client.name)}</span>
            </div>
            ${client.phone ? `
                <div class="client-info-item">
                    <span class="client-info-label">Phone:</span>
                    <span>${escapeHtml(client.phone)}</span>
                </div>
            ` : ''}
            ${client.sex ? `
                <div class="client-info-item">
                    <span class="client-info-label">Sex:</span>
                    <span>${escapeHtml(client.sex)}</span>
                </div>
            ` : ''}
        </div>
    `;

    if (clientMeasurements.length === 0) {
        html += `
            <div class="empty-state" style="margin-top: 30px;">
                <div class="empty-state-icon">📏</div>
                <div class="empty-state-text">No measurements recorded yet</div>
            </div>
        `;
    } else {
        // Show all measurements as individual records (most recent first)
        html += '<div class="measurements-list" style="margin-top: 30px;">';
        clientMeasurements.forEach(measurement => {
            html += `
                <div class="measurement-record">
                    <div class="measurement-record-header">
                        <div class="measurement-garment">${measurement.garment_type || 'No garment type'}</div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="measurement-date">${formatDate(measurement.date_created)}</div>
                            <div class="measurement-menu-wrapper">
                                <button class="btn-menu measurement-menu-btn" aria-label="Measurement actions" data-measurement-id="${measurement.id}">⋮</button>
                                <div class="menu-dropdown measurement-menu-dropdown" data-measurement-id="${measurement.id}">
                                    <button class="menu-item edit-measurement-btn" data-measurement-id="${measurement.id}">Edit Measurement</button>
                                    <button class="menu-item menu-item-danger delete-measurement-btn" data-measurement-id="${measurement.id}">Delete Measurement</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="measurement-values">
                        ${renderMeasurementValue('Shoulder', measurement.shoulder)}
                        ${renderMeasurementValue('Chest', measurement.chest)}
                        ${renderMeasurementValue('Waist', measurement.waist)}
                        ${renderMeasurementValue('Sleeve', measurement.sleeve)}
                        ${renderMeasurementValue('Length', measurement.length)}
                        ${renderMeasurementValue('Neck', measurement.neck)}
                        ${renderMeasurementValue('Hip', measurement.hip)}
                        ${renderMeasurementValue('Inseam', measurement.inseam)}
                        ${renderMeasurementValue('Thigh', measurement.thigh)}
                        ${renderMeasurementValue('Seat', measurement.seat)}
                        ${renderCustomFields(measurement.customFields)}
                    </div>
                    ${measurement.notes ? `
                        <div class="measurement-notes" style="margin-top: 12px;">
                            <strong>Notes:</strong> ${escapeHtml(measurement.notes)}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';
    }

    detailsContainer.innerHTML = html;
    showScreen('client-details-screen');

    // Add event listeners for measurement menu buttons
    detailsContainer.querySelectorAll('.measurement-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const measurementId = e.target.getAttribute('data-measurement-id');
            const dropdown = detailsContainer.querySelector(`.measurement-menu-dropdown[data-measurement-id="${measurementId}"]`);
            toggleMenuDropdown(dropdown);
        });
    });

    // Add event listeners for Edit measurement
    detailsContainer.querySelectorAll('.edit-measurement-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const measurementId = e.target.getAttribute('data-measurement-id');
            closeAllMenuDropdowns();
            await editMeasurement(measurementId, clientId);
        });
    });

    // Add event listeners for Delete measurement
    detailsContainer.querySelectorAll('.delete-measurement-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const measurementId = e.target.getAttribute('data-measurement-id');
            closeAllMenuDropdowns();
            deleteMeasurement(measurementId, clientId);
        });
    });
}

// Group measurements by date
function groupMeasurementsByDate(measurements) {
    const groups = {};

    measurements.forEach(measurement => {
        const date = new Date(measurement.date_created);
        const dateKey = date.toDateString();

        if (!groups[dateKey]) {
            groups[dateKey] = {
                date: measurement.date_created,
                garmentType: measurement.garment_type,
                shoulder: measurement.shoulder,
                chest: measurement.chest,
                waist: measurement.waist,
                sleeve: measurement.sleeve,
                length: measurement.length,
                neck: measurement.neck,
                notes: measurement.notes
            };
        }
    });

    return Object.values(groups);
}

// Render measurement value
function renderMeasurementValue(label, value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    return `
        <div class="measurement-item">
            <span class="measurement-label">${label}</span>
            <span class="measurement-value">${value}</span>
        </div>
    `;
}

// Render custom fields
function renderCustomFields(customFields) {
    if (!customFields || typeof customFields !== 'object' || Object.keys(customFields).length === 0) {
        return '';
    }

    return Object.entries(customFields).map(([name, value]) => {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        // Capitalize first letter of field name
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        return `
            <div class="measurement-item custom-measurement-item">
                <span class="measurement-label">${escapeHtml(displayName)}</span>
                <span class="measurement-value">${escapeHtml(String(value))}</span>
            </div>
        `;
    }).join('');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Get recent measurements (most recent first, with pagination)
// Resolve client for measurement - handles both local_id and server_id mapping
async function resolveClientForMeasurement(measurementClientId, userId) {
    if (!measurementClientId) return null;

    const clients = await getClients();
    if (!Array.isArray(clients) || clients.length === 0) {
        return null; // Clients not loaded yet
    }

    // Try multiple matching strategies
    let client = clients.find(c => {
        // Strategy 1: Direct match by id (server_id or local_id)
        if (c.id === measurementClientId) return true;
        // Strategy 2: Match by server_id
        if (c.server_id && c.server_id === measurementClientId) return true;
        // Strategy 3: Match by local_id
        if (c.local_id && c.local_id === measurementClientId) return true;
        return false;
    });

    if (client) {
        return client;
    }

    // If not found in clients array, try to resolve via IndexedDB (for offline-created data)
    if (window.indexedDBHelper) {
        try {
            // Try to find client by local_id or server_id in IndexedDB
            let dbClient = await window.indexedDBHelper.getClientLocal(measurementClientId, userId);

            // If not found by local_id, try by server_id
            if (!dbClient) {
                // Try to find by server_id (need to scan or use different approach)
                const allClients = await window.indexedDBHelper.getClientsLocal(userId);
                dbClient = allClients.find(c => c.server_id === measurementClientId || c.id === measurementClientId);
            }

            if (dbClient) {
                // Check if this client exists in our clients array with a different ID
                const matchedClient = clients.find(c => {
                    // Match by local_id
                    if (c.local_id === dbClient.local_id) return true;
                    // Match by server_id if client was synced
                    if (dbClient.server_id && (c.server_id === dbClient.server_id || c.id === dbClient.server_id)) return true;
                    // Match by name and phone (fallback for offline data)
                    if (c.name === dbClient.name && c.phone === dbClient.phone) return true;
                    return false;
                });
                if (matchedClient) {
                    return matchedClient;
                }
                // Return the IndexedDB client formatted for display
                return {
                    id: dbClient.server_id || dbClient.local_id,
                    server_id: dbClient.server_id || null,
                    local_id: dbClient.local_id,
                    name: dbClient.name,
                    phone: dbClient.phone || '',
                    sex: dbClient.sex || '',
                    createdAt: dbClient.created_at,
                    synced: dbClient.synced
                };
            }
        } catch (err) {
            console.warn('[Resolve] Error resolving client ID:', err);
        }
    }

    return null;
}

async function getRecentMeasurements(limit = null, offset = 0) {
    const user = await getCurrentUser();
    if (!user) return { measurements: [], total: 0, hasMore: false };

    // CRITICAL: Load clients FIRST, then measurements
    const clients = await getClients();
    const measurements = await getMeasurements();

    if (!Array.isArray(measurements)) return { measurements: [], total: 0, hasMore: false };
    if (!Array.isArray(clients)) {
        // Clients not loaded yet - return empty with flag
        return { measurements: [], total: 0, hasMore: false, clientsNotReady: true };
    }

    // Sort by date, most recent first
    const sorted = measurements
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

    // Apply pagination if limit is specified
    const paginated = limit ? sorted.slice(offset, offset + limit) : sorted.slice(offset);

    // Map to include client info - resolve client IDs properly
    // Use synchronous lookup first (from already-loaded clients array) for speed
    const clientMap = new Map();
    clients.forEach(c => {
        // Map by id, server_id, and local_id for fast lookup
        if (c.id) clientMap.set(c.id, c);
        if (c.server_id) clientMap.set(c.server_id, c);
        if (c.local_id) clientMap.set(c.local_id, c);
    });

    // First pass: synchronous lookup (fast) - no async blocking
    const measurementsWithClients = paginated.map((measurement) => {
        // Try synchronous lookup first (instant)
        let client = clientMap.get(measurement.client_id);

        // If not found synchronously, we'll resolve async later (non-blocking)
        const clientName = client ? client.name : null;

        return {
            ...measurement,
            clientName: clientName,
            clientId: measurement.client_id,
            clientResolved: !!client,
            _needsAsyncResolve: !client
        };
    });

    // Second pass: async resolve only for measurements that need it (non-blocking)
    // This allows the UI to render immediately with cached data
    Promise.all(
        measurementsWithClients
            .filter(m => m._needsAsyncResolve)
            .map(async (measurement) => {
                const client = await resolveClientForMeasurement(measurement.client_id, user.id);
                if (client) {
                    measurement.clientName = client.name;
                    measurement.clientResolved = true;
                    // Update the UI if this measurement is visible
                    const container = document.getElementById('recent-measurements');
                    if (container) {
                        const row = container.querySelector(`[data-measurement-id="${measurement.id}"]`);
                        if (row) {
                            const clientNameEl = row.querySelector('.recent-measurement-client');
                            if (clientNameEl) {
                                clientNameEl.textContent = client.name;
                            }
                        }
                    }
                }
                delete measurement._needsAsyncResolve;
            })
    ).catch(err => {
        console.warn('[GetRecentMeasurements] Error resolving clients:', err);
    });

    // Clean up temporary property
    measurementsWithClients.forEach(m => delete m._needsAsyncResolve);

    return {
        measurements: measurementsWithClients,
        total: sorted.length,
        hasMore: limit ? (offset + limit < sorted.length) : false
    };
}

// Render Recent Measurements on Home Screen with pagination
let recentMeasurementsOffset = 0;
let recentMeasurementsLimit = 4; // Initial limit
let recentMeasurementsExpanded = false;

async function renderRecentMeasurements(resetPagination = true) {
    const container = document.getElementById('recent-measurements');
    if (!container) return;

    // Reset offset when rendering from scratch (unless explicitly continuing pagination)
    if (resetPagination) {
        recentMeasurementsOffset = 0;
    }
    const limit = recentMeasurementsExpanded ? 15 : recentMeasurementsLimit;

    // Use cache - don't force refresh (optimistic updates handle cache)
    const result = await getRecentMeasurements(limit, recentMeasurementsOffset);

    // If clients not ready, show loading state
    if (result.clientsNotReady) {
        container.innerHTML = '<div class="recent-empty">Loading client data...</div>';
        // Retry after a short delay
        setTimeout(() => {
            renderRecentMeasurements(resetPagination);
        }, 500);
        return;
    }

    if (result.measurements.length === 0) {
        container.innerHTML = '<div class="recent-empty">No measurements yet. Start by adding a new measurement.</div>';
        return;
    }

    let html = result.measurements.map(item => {
        // Determine if measurement is new (created within last 24 hours)
        const isNew = item.date_created && (new Date() - new Date(item.date_created)) < 24 * 60 * 60 * 1000;
        const badgeText = isNew ? 'New' : 'Updated';
        const badgeClass = isNew ? 'badge-new' : 'badge-updated';

        // Show placeholder if client not resolved yet (not "Unknown client")
        const clientName = item.clientName || (item.clientResolved === false ? 'Loading...' : 'Loading...');

        return `
        <div class="recent-measurement-row" data-measurement-id="${item.id}" data-client-id="${item.clientId}">
            <div class="recent-measurement-icon">
                <div class="measurement-icon-circle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
            </div>
        </div>
            <div class="recent-measurement-info">
                <div class="recent-measurement-client">${escapeHtml(clientName)}</div>
                <div class="recent-measurement-garment">${escapeHtml(item.garment_type || 'No garment type')}</div>
                <div class="recent-measurement-date">${formatDateShort(item.date_created)}</div>
            </div>
            <div class="recent-measurement-badge">
                <span class="measurement-badge ${badgeClass}">${badgeText}</span>
            </div>
        </div>
    `;
    }).join('');

    container.innerHTML = html;

    // If any clients were not resolved, retry rendering after a short delay
    const unresolvedCount = result.measurements.filter(m => !m.clientResolved).length;
    if (unresolvedCount > 0) {
        setTimeout(() => {
            renderRecentMeasurements(resetPagination);
        }, 1000);
    }

    // Update header control (See More / Collapse button)
    const controlContainer = document.getElementById('recent-measurements-control');
    if (controlContainer) {
        let controlHtml = '';

        // Add "View all →" button if not expanded and there are more measurements
        if (!recentMeasurementsExpanded && result.hasMore) {
            controlHtml = `
                <button id="see-more-measurements-btn" class="recent-view-all-btn">
                    View all →
            </button>
        `;
        }

        // Add "Collapse" button if expanded
        if (recentMeasurementsExpanded) {
            controlHtml = `
                <button id="collapse-measurements-btn" class="recent-view-all-btn">
                Collapse
            </button>
        `;
        }

        controlContainer.innerHTML = controlHtml;
    }

    // Add click listeners for measurement items - open Measurement Detail View
    container.querySelectorAll('.recent-measurement-row').forEach(item => {
        item.addEventListener('click', async () => {
            const measurementId = item.getAttribute('data-measurement-id');
            await showMeasurementDetail(measurementId);
        });
    });

    // Add "See More" button listener
    const seeMoreBtn = document.getElementById('see-more-measurements-btn');
    if (seeMoreBtn) {
        seeMoreBtn.addEventListener('click', () => {
            // Update state immediately for instant feedback
            recentMeasurementsExpanded = true;
            recentMeasurementsLimit = 15;

            // Update button text immediately (optimistic UI)
            const controlContainer = document.getElementById('recent-measurements-control');
            if (controlContainer) {
                controlContainer.innerHTML = `
                    <button id="collapse-measurements-btn" class="recent-view-all-btn">
                        Collapse
                    </button>
                `;
            }

            // Render in next frame (non-blocking)
            requestAnimationFrame(() => {
                renderRecentMeasurements();
            });
        });
    }

    // Add "Collapse" button listener
    const collapseBtn = document.getElementById('collapse-measurements-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            // Update state immediately for instant feedback
            recentMeasurementsExpanded = false;
            recentMeasurementsLimit = 4;
            recentMeasurementsOffset = 0;

            // Update button text immediately (optimistic UI)
            const controlContainer = document.getElementById('recent-measurements-control');
            if (controlContainer) {
                // Check if there are more measurements to show "View all" button
                // We'll update this after render, but show something immediately
                controlContainer.innerHTML = `
                    <button id="see-more-measurements-btn" class="recent-view-all-btn">
                        View all →
                    </button>
                `;
            }

            // Render in next frame (non-blocking)
            requestAnimationFrame(() => {
                renderRecentMeasurements(true);
            });
        });
    }

    // Add "Next" button listener
    const nextBtn = document.getElementById('next-measurements-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            recentMeasurementsOffset += 15;
            const nextResult = await getRecentMeasurements(15, recentMeasurementsOffset);
            if (nextResult.measurements.length > 0) {
                const existingItems = container.querySelectorAll('.recent-item');
                const nextItems = nextResult.measurements.map(item => {
                    const isNew = !item.date_created || (new Date() - new Date(item.date_created)) < 24 * 60 * 60 * 1000;
                    const badgeText = isNew ? 'New' : 'Updated';
                    const badgeClass = isNew ? 'badge-new' : 'badge-updated';

                    return `
                    <div class="recent-measurement-row" data-measurement-id="${item.id}" data-client-id="${item.clientId}">
                        <div class="recent-measurement-icon">
                            <div class="measurement-icon-circle">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                        </div>
                    </div>
                        <div class="recent-measurement-info">
                            <div class="recent-measurement-client">${escapeHtml(item.clientName || 'Unknown client')}</div>
                            <div class="recent-measurement-garment">${escapeHtml(item.garment_type || 'No garment type')}</div>
                            <div class="recent-measurement-date">${formatDateShort(item.date_created)}</div>
                        </div>
                        <div class="recent-measurement-badge">
                            <span class="measurement-badge ${badgeClass}">${badgeText}</span>
                        </div>
                    </div>
                `;
                }).join('');

                // Remove the Next button temporarily
                nextBtn.remove();

                // Add new items
                container.insertAdjacentHTML('beforeend', nextItems);

                // Re-add Next button if there are more
                if (nextResult.hasMore) {
                    container.insertAdjacentHTML('beforeend', `
                        <button id="next-measurements-btn" class="btn btn-secondary" style="margin-top: 16px;">
                            Next
                        </button>
                    `);
                    document.getElementById('next-measurements-btn').addEventListener('click', arguments.callee);
                }

                // Add click listeners to new items - open Measurement Detail View
                container.querySelectorAll('.recent-measurement-row').forEach(item => {
                    if (!item.hasAttribute('data-listener-added')) {
                        item.setAttribute('data-listener-added', 'true');
                        item.addEventListener('click', async () => {
                            const measurementId = item.getAttribute('data-measurement-id');
                            await showMeasurementDetail(measurementId);
                        });
                    }
                });
            }
        });
    }
}

// Format date for recent items (shorter format)
function formatDateShort(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        return 'Today';
    } else if (diffDays === 2) {
        return 'Yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
}

// Render Clients List
async function renderClientsList() {
    const container = document.getElementById('clients-list');
    const countElement = document.getElementById('clients-count');
    if (!container) return;

    // Use cache - don't force refresh (optimistic updates handle cache)
    const clients = await getClients();
    const measurements = await getMeasurements();

    if (!Array.isArray(clients)) {
        container.innerHTML = '<div class="clients-empty">Error loading clients</div>';
        return;
    }
    if (!Array.isArray(measurements)) {
        container.innerHTML = '<div class="clients-empty">Error loading measurements</div>';
        return;
    }

    // Update count
    countElement.textContent = `Clients: ${clients.length}`;

    if (clients.length === 0) {
        container.innerHTML = '<div class="clients-empty">No clients yet. Start by adding a new measurement.</div>';
        return;
    }

    // Sort clients alphabetically by name
    const sortedClients = [...clients].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    // Add bulk actions header if not exists
    const containerParent = container.parentNode;
    let bulkActionsHeader = containerParent.querySelector('.clients-bulk-actions');
    if (!bulkActionsHeader) {
        bulkActionsHeader = document.createElement('div');
        bulkActionsHeader.className = 'clients-bulk-actions';
        bulkActionsHeader.style.display = 'none';
        bulkActionsHeader.innerHTML = `
            <div class="bulk-actions-info">
                <span id="bulk-selected-count">0</span> selected
            </div>
            <button id="bulk-delete-clients-btn" class="btn btn-delete btn-sm">
                Delete Selected
            </button>
        `;
        containerParent.insertBefore(bulkActionsHeader, container);
    }

    container.innerHTML = sortedClients.map((client, index) => {
        const clientMeasurements = measurements.filter(m => m.client_id === client.id);
        const measurementCount = clientMeasurements.length;
        const secondaryText = measurementCount > 0
            ? `${measurementCount} measurement${measurementCount !== 1 ? 's' : ''}`
            : (client.phone || 'No measurements');

        // Get initials from client name
        const getInitials = (name) => {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        };
        const initials = getInitials(client.name);

        return `
            <div class="client-leaderboard-card" data-client-id="${client.id}">
                <div class="client-card-checkbox">
                    <input type="checkbox" class="client-select-checkbox" data-client-id="${client.id}" aria-label="Select client">
                </div>
                <div class="client-card-index">
                    <span class="client-index-badge">${index + 1}</span>
                </div>
                <div class="client-card-main">
                    <div class="client-avatar">
                        <span class="client-avatar-initials">${initials}</span>
                    </div>
                    <div class="client-card-info">
                        <div class="client-card-name">${escapeHtml(client.name)}</div>
                        <div class="client-card-secondary">${escapeHtml(secondaryText)}</div>
                    </div>
                </div>
                <div class="client-card-right">
                    <div class="client-card-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"></path>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners for client cards (to view details) - but not when clicking checkbox
    container.querySelectorAll('.client-leaderboard-card').forEach(card => {
        card.addEventListener('click', async (e) => {
            // Don't navigate if clicking checkbox
            if (e.target.closest('.client-select-checkbox')) {
                return;
            }
            const clientId = card.getAttribute('data-client-id');
            await showClientDetails(clientId, 'clients-screen');
        });
    });

    // Add checkbox change listeners for bulk selection
    container.querySelectorAll('.client-select-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            updateBulkActionsUI();
        });
    });

    // Bulk delete button handler
    const bulkDeleteBtn = document.getElementById('bulk-delete-clients-btn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.replaceWith(bulkDeleteBtn.cloneNode(true)); // Remove old listeners
        document.getElementById('bulk-delete-clients-btn').addEventListener('click', async () => {
            const selectedIds = getSelectedClientIds();
            if (selectedIds.length === 0) {
                alert('Please select at least one client to delete.');
                return;
            }

            const count = selectedIds.length;
            if (!confirm(`Are you sure you want to delete ${count} client${count !== 1 ? 's' : ''}? This will also delete all associated measurements.`)) {
                return;
            }

            // Delete all selected clients
            for (const clientId of selectedIds) {
                await deleteClient(clientId);
            }

            // Clear selection and refresh list
            clearClientSelection();
            renderClientsList();
            showToast && showToast(`${count} client${count !== 1 ? 's' : ''} deleted`, 'success', 3000);
        });
    }

    // Helper functions for bulk actions
    function getSelectedClientIds() {
        return Array.from(container.querySelectorAll('.client-select-checkbox:checked'))
            .map(cb => cb.getAttribute('data-client-id'));
    }

    function updateBulkActionsUI() {
        const selectedIds = getSelectedClientIds();
        const bulkActions = document.querySelector('.clients-bulk-actions');
        const countEl = document.getElementById('bulk-selected-count');

        if (selectedIds.length > 0) {
            if (bulkActions) bulkActions.style.display = 'flex';
            if (countEl) countEl.textContent = selectedIds.length;
        } else {
            if (bulkActions) bulkActions.style.display = 'none';
        }
    }

    function clearClientSelection() {
        container.querySelectorAll('.client-select-checkbox').forEach(cb => {
            cb.checked = false;
        });
        updateBulkActionsUI();
    }
}

// Edit client from list
async function editClientFromList(clientId) {
    const clients = await getClients();
    if (!Array.isArray(clients)) {
        alert('Error loading clients');
        return;
    }

    const client = clients.find(c => c.id === clientId);

    if (!client) {
        alert('Client not found');
        return;
    }

    currentClientId = clientId;
    previousScreen = 'clients-screen';

    // Pre-fill edit form
    document.getElementById('edit-client-name').value = client.name;
    document.getElementById('edit-client-phone').value = client.phone || '';
    document.getElementById('edit-client-sex').value = client.sex || '';

    showScreen('edit-client-screen');
}

// Delete client from list
async function deleteClientFromList(clientId) {
    if (!confirm('Are you sure you want to delete this client? This will also delete all associated measurements.')) {
        return;
    }

    // Delete client (optimistic - updates cache immediately)
    deleteClient(clientId);

    // Refresh the clients list immediately (uses cache, instant)
    renderClientsList();
}

// ===============================
// EXPORT / DOWNLOAD HELPERS
// ===============================

// Simple date formatter for exports
function formatDateForExport(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
}

// Create and trigger download of a text file (CSV)
function downloadTextFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Reusable modal for choosing download format
function showDownloadFormatDialog(title, description, onSelect) {
    const overlay = document.createElement('div');
    overlay.className = 'download-format-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const dialog = document.createElement('div');
    dialog.className = 'download-format-dialog';
    dialog.style.background = 'var(--bg-primary, #020617)';
    dialog.style.color = 'var(--text-primary, #f9fafb)';
    dialog.style.borderRadius = '12px';
    dialog.style.padding = '20px 18px 16px';
    dialog.style.maxWidth = '360px';
    dialog.style.width = '90%';
    dialog.style.boxShadow = '0 18px 45px rgba(0,0,0,0.45)';

    dialog.innerHTML = `
        <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600;">${escapeHtml(title)}</h3>
        <p style="margin: 0 0 16px; font-size: 13px; color: var(--text-secondary, #9ca3af);">
            ${escapeHtml(description)}
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
            <button id="download-format-excel" class="btn btn-primary" style="width: 100%; justify-content: center;">
                Excel (.csv)
            </button>
            <button id="download-format-pdf" class="btn btn-secondary" style="width: 100%; justify-content: center;">
                PDF (printable)
            </button>
        </div>
        <button id="download-format-cancel" class="btn btn-secondary" style="width: 100%; justify-content: center;">
            Cancel
        </button>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = () => {
        document.body.removeChild(overlay);
    };

    dialog.querySelector('#download-format-excel').addEventListener('click', () => {
        cleanup();
        onSelect('excel');
    });
    dialog.querySelector('#download-format-pdf').addEventListener('click', () => {
        cleanup();
        onSelect('pdf');
    });
    dialog.querySelector('#download-format-cancel').addEventListener('click', () => {
        cleanup();
    });
}

// Build CSV rows for measurements + clients
function buildMeasurementsCsvRows(clients, measurements) {
    const clientMap = new Map();
    (clients || []).forEach(c => {
        clientMap.set(c.id, c);
    });

    // Collect all unique custom field names from all measurements
    const customFieldNames = new Set();
    (measurements || []).forEach(m => {
        const customFields = m.custom_fields || m.customFields || {};
        Object.keys(customFields).forEach(key => {
            if (customFields[key] != null && customFields[key] !== '') {
                customFieldNames.add(key);
            }
        });
    });

    // Sort custom field names for consistent ordering
    const sortedCustomFields = Array.from(customFieldNames).sort();

    // Build headers with standard fields first, then custom fields
    const headers = [
        'Client Name',
        'Client Phone',
        'Client Sex',
        'Measurement ID',
        'Date',
        'Garment Type',
        'Shoulder',
        'Chest',
        'Waist',
        'Sleeve',
        'Length',
        'Neck',
        'Hip',
        'Inseam',
        'Thigh',
        'Seat',
        ...sortedCustomFields.map(name => {
            // Capitalize first letter for display
            return name.charAt(0).toUpperCase() + name.slice(1);
        }),
        'Notes'
    ];

    const rows = [headers];

    (measurements || []).forEach(m => {
        const client = clientMap.get(m.client_id) || {};
        const customFields = m.custom_fields || m.customFields || {};

        // Build row with standard fields
        const row = [
            client.name || '',
            client.phone || '',
            client.sex || '',
            m.id || '',
            formatDateForExport(m.date_created || m.created_at),
            m.garment_type || '',
            m.shoulder != null ? m.shoulder : '',
            m.chest != null ? m.chest : '',
            m.waist != null ? m.waist : '',
            m.sleeve != null ? m.sleeve : '',
            m.length != null ? m.length : '',
            m.neck != null ? m.neck : '',
            m.hip != null ? m.hip : '',
            m.inseam != null ? m.inseam : '',
            m.thigh != null ? m.thigh : '',
            m.seat != null ? m.seat : ''
        ];

        // Add custom field values in the same order as headers
        sortedCustomFields.forEach(fieldName => {
            const value = customFields[fieldName];
            row.push(value != null && value !== '' ? String(value) : '');
        });

        // Add notes at the end
        row.push((m.notes || '').replace(/\r?\n/g, ' '));

        rows.push(row);
    });

    // Convert to CSV string
    return rows
        .map(cols =>
            cols
                .map(col => {
                    const value = col == null ? '' : String(col);
                    if (/[",\n]/.test(value)) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                })
                .join(',')
        )
        .join('\n');
}

// Open printable window for PDF-like export (user can Save as PDF)
function openPrintableMeasurementsWindow(title, clients, measurements) {
    const clientMap = new Map();
    (clients || []).forEach(c => {
        clientMap.set(c.id, c);
    });

    // Collect all unique custom field names from all measurements
    const customFieldNames = new Set();
    (measurements || []).forEach(m => {
        const customFields = m.custom_fields || m.customFields || {};
        Object.keys(customFields).forEach(key => {
            if (customFields[key] != null && customFields[key] !== '') {
                customFieldNames.add(key);
            }
        });
    });

    // Sort custom field names for consistent ordering
    const sortedCustomFields = Array.from(customFieldNames).sort();

    const win = window.open('', '_blank');
    if (!win) {
        alert('Popup blocked. Please allow popups to download PDF.');
        return;
    }

    // Build header row
    const headerCells = [
        '<th>Client Name</th>',
        '<th>Phone</th>',
        '<th>Sex</th>',
        '<th>Garment</th>',
        '<th>Date</th>',
        '<th>Shoulder</th>',
        '<th>Chest</th>',
        '<th>Waist</th>',
        '<th>Sleeve</th>',
        '<th>Length</th>',
        '<th>Neck</th>',
        '<th>Hip</th>',
        '<th>Inseam</th>',
        '<th>Thigh</th>',
        '<th>Seat</th>',
        ...sortedCustomFields.map(name => {
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);
            return `<th>${escapeHtml(displayName)}</th>`;
        }),
        '<th>Notes</th>'
    ].join('');

    const rowsHtml = (measurements || [])
        .map(m => {
            const client = clientMap.get(m.client_id) || {};
            const customFields = m.custom_fields || m.customFields || {};

            // Build row with standard fields
            const cells = [
                `<td>${escapeHtml(client.name || '')}</td>`,
                `<td>${escapeHtml(client.phone || '')}</td>`,
                `<td>${escapeHtml(client.sex || '')}</td>`,
                `<td>${escapeHtml(m.garment_type || '')}</td>`,
                `<td>${escapeHtml(formatDateForExport(m.date_created || m.created_at))}</td>`,
                `<td>${m.shoulder != null ? escapeHtml(String(m.shoulder)) : ''}</td>`,
                `<td>${m.chest != null ? escapeHtml(String(m.chest)) : ''}</td>`,
                `<td>${m.waist != null ? escapeHtml(String(m.waist)) : ''}</td>`,
                `<td>${m.sleeve != null ? escapeHtml(String(m.sleeve)) : ''}</td>`,
                `<td>${m.length != null ? escapeHtml(String(m.length)) : ''}</td>`,
                `<td>${m.neck != null ? escapeHtml(String(m.neck)) : ''}</td>`,
                `<td>${m.hip != null ? escapeHtml(String(m.hip)) : ''}</td>`,
                `<td>${m.inseam != null ? escapeHtml(String(m.inseam)) : ''}</td>`,
                `<td>${m.thigh != null ? escapeHtml(String(m.thigh)) : ''}</td>`,
                `<td>${m.seat != null ? escapeHtml(String(m.seat)) : ''}</td>`
            ];

            // Add custom field values in the same order as headers
            sortedCustomFields.forEach(fieldName => {
                const value = customFields[fieldName];
                cells.push(`<td>${value != null && value !== '' ? escapeHtml(String(value)) : ''}</td>`);
            });

            // Add notes at the end
            cells.push(`<td>${escapeHtml(m.notes || '')}</td>`);

            return `<tr>${cells.join('')}</tr>`;
        })
        .join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(title)}</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 16px;
                    color: #0f172a;
                }
                h1 {
                    font-size: 20px;
                    margin-bottom: 4px;
                }
                h2 {
                    font-size: 14px;
                    font-weight: 500;
                    color: #6b7280;
                    margin-top: 0;
                    margin-bottom: 16px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                th, td {
                    border: 1px solid #e5e7eb;
                    padding: 6px 8px;
                    text-align: left;
                    vertical-align: top;
                }
                th {
                    background: #f3f4f6;
                    font-weight: 600;
                }
                tbody tr:nth-child(even) {
                    background: #f9fafb;
                }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            <h2>Generated from Tailor's Vault</h2>
            <table>
                <thead>
                    <tr>
                        ${headerCells}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            <script>
                window.onload = function () {
                    window.focus();
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
}

// Show Measurement Detail View
let currentMeasurementDetailId = null;

async function showMeasurementDetail(measurementId) {
    const measurements = await getMeasurements();
    const clients = await getClients();

    if (!Array.isArray(measurements)) {
        alert('Error loading measurements');
        return;
    }
    if (!Array.isArray(clients)) {
        alert('Error loading clients');
        return;
    }

    const measurement = measurements.find(m => m.id === measurementId);

    if (!measurement) {
        alert('Measurement not found');
        return;
    }

    const client = clients.find(c => c.id === measurement.client_id);
    if (!client) {
        alert('Client not found');
        return;
    }

    currentMeasurementDetailId = measurementId;
    currentClientId = client.id;

    const detailsContainer = document.getElementById('measurement-detail-content');

    // Build HTML with client info and measurement details
    let html = `
        <div class="client-info">
            <div class="client-info-item">
                <span class="client-info-label">Client Name:</span>
                <span>${escapeHtml(client.name)}</span>
            </div>
            ${client.phone ? `
                <div class="client-info-item">
                    <span class="client-info-label">Phone:</span>
                    <span>${escapeHtml(client.phone)}</span>
                </div>
            ` : ''}
            ${client.sex ? `
                <div class="client-info-item">
                    <span class="client-info-label">Sex:</span>
                    <span>${escapeHtml(client.sex)}</span>
                </div>
            ` : ''}
        </div>
        
        <div class="measurement-record" style="margin-top: 30px;">
            <div class="measurement-record-header">
                <div class="measurement-garment">${measurement.garment_type || 'No garment type'}</div>
                <div class="measurement-date">${formatDate(measurement.date_created)}</div>
            </div>
            <div class="measurement-values">
                ${renderMeasurementValue('Shoulder', measurement.shoulder)}
                ${renderMeasurementValue('Chest', measurement.chest)}
                ${renderMeasurementValue('Waist', measurement.waist)}
                ${renderMeasurementValue('Sleeve', measurement.sleeve)}
                ${renderMeasurementValue('Length', measurement.length)}
                ${renderMeasurementValue('Neck', measurement.neck)}
                ${renderMeasurementValue('Hip', measurement.hip)}
                ${renderMeasurementValue('Inseam', measurement.inseam)}
                ${renderMeasurementValue('Thigh', measurement.thigh)}
                ${renderMeasurementValue('Seat', measurement.seat)}
                ${renderCustomFields(measurement.customFields)}
            </div>
            ${measurement.notes ? `
                <div class="measurement-notes" style="margin-top: 12px;">
                    <strong>Notes:</strong> ${escapeHtml(measurement.notes)}
                </div>
            ` : ''}
        </div>
    `;

    detailsContainer.innerHTML = html;
    showScreen('measurement-detail-screen');
}

// Back button from Measurement Detail View
document.getElementById('back-from-measurement-detail-btn').addEventListener('click', () => {
    showScreen('home-screen');
    renderRecentMeasurements();
});

// View Client button from Measurement Detail View
document.getElementById('view-client-from-measurement-btn').addEventListener('click', async () => {
    if (currentClientId) {
        await showClientDetails(currentClientId, 'measurement-detail-screen');
    }
});

// Toggle menu dropdown
function toggleMenuDropdown(dropdownElement) {
    if (!dropdownElement) return;

    closeAllMenuDropdowns(dropdownElement); // Close others

    // Find the associated button
    const measurementId = dropdownElement.getAttribute('data-measurement-id');
    const button = document.querySelector(`.measurement-menu-btn[data-measurement-id="${measurementId}"]`) ||
        dropdownElement.previousElementSibling;

    if (button) {
        positionDropdown(button, dropdownElement);
    }

    dropdownElement.classList.toggle('active');
}

// Close all menu dropdowns
function closeAllMenuDropdowns(excludeDropdown = null) {
    document.querySelectorAll('.menu-dropdown.active').forEach(dropdown => {
        if (dropdown !== excludeDropdown) {
            dropdown.classList.remove('active');
            dropdown.style.top = '';
            dropdown.style.right = '';
            dropdown.style.left = '';
        }
    });
}

// Position dropdown relative to the button (for fixed positioning)
function positionDropdown(button, dropdown) {
    const rect = button.getBoundingClientRect();
    const dropdownHeight = 100; // Approximate height
    const viewportHeight = window.innerHeight;

    // Position below the button by default
    let top = rect.bottom + 4;

    // If dropdown would go below viewport, position above
    if (top + dropdownHeight > viewportHeight) {
        top = rect.top - dropdownHeight - 4;
        if (top < 0) top = rect.bottom + 4; // Fallback to below if not enough space above
    }

    dropdown.style.top = top + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    dropdown.style.left = 'auto';
}

// Client Details menu toggle
document.getElementById('client-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const dropdown = document.getElementById('client-menu-dropdown');

    // Close other dropdowns first
    document.querySelectorAll('.menu-dropdown.active').forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('active');
        }
    });

    if (dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
    } else {
        positionDropdown(button, dropdown);
        dropdown.classList.add('active');
    }
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.client-menu-wrapper') &&
        !e.target.closest('.measurement-menu-wrapper') &&
        !e.target.closest('.btn-menu')) {
        closeAllMenuDropdowns();
    }
});

// Close dropdowns on scroll (for fixed position dropdowns)
document.addEventListener('scroll', () => {
    closeAllMenuDropdowns();
}, true);

// ===============================
// EXPORT HANDLERS (CLIENT / ALL)
// ===============================

// Per-client download button (on client details screen)
document.getElementById('download-client-measurements-btn').addEventListener('click', async () => {
    try {
        if (!currentClientId) {
            alert('Client not found');
            return;
        }

        const user = await getCurrentUser();
        if (!user) {
            alert('You must be logged in to download measurements.');
            return;
        }

        const [clients, measurements] = await Promise.all([getClients(), getMeasurements()]);
        if (!Array.isArray(clients) || !Array.isArray(measurements)) {
            alert('Error loading data. Please try again.');
            return;
        }

        const client = clients.find(c => c.id === currentClientId);
        if (!client) {
            alert('Client not found');
            return;
        }

        const clientMeasurements = measurements.filter(m => m.client_id === currentClientId);

        if (clientMeasurements.length === 0) {
            alert('No measurements found for this client.');
            return;
        }

        showDownloadFormatDialog(
            'Download Measurements',
            `Choose a format to download measurements for ${client.name}.`,
            (format) => {
                if (format === 'excel') {
                    const csv = buildMeasurementsCsvRows([client], clientMeasurements);
                    const safeName = (client.name || 'client').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
                    const filename = `measurements_${safeName}.csv`;
                    downloadTextFile(filename, csv, 'text/csv');
                    showToast && showToast('Excel file downloaded', 'success', 2000);
                } else if (format === 'pdf') {
                    openPrintableMeasurementsWindow(
                        `Measurements for ${client.name}`,
                        [client],
                        clientMeasurements
                    );
                }
            }
        );
    } catch (err) {
        console.error('Error downloading client measurements:', err);
        showToast && showToast('Failed to download measurements. Please try again.', 'error', 3000);
    }
});

// Business-wide download button (settings screen)
document.getElementById('download-all-measurements-btn').addEventListener('click', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            alert('You must be logged in to download measurements.');
            return;
        }

        const [clients, measurements] = await Promise.all([getClients(), getMeasurements()]);
        if (!Array.isArray(clients) || !Array.isArray(measurements)) {
            alert('Error loading data. Please try again.');
            return;
        }

        if (measurements.length === 0 || clients.length === 0) {
            alert('No clients or measurements found to download.');
            return;
        }

        showDownloadFormatDialog(
            'Download All Clients\' Measurements',
            'Choose a format to download all measurements for this business.',
            (format) => {
                if (format === 'excel') {
                    const csv = buildMeasurementsCsvRows(clients, measurements);
                    const business = getCachedBusiness && getCachedBusiness();
                    const safeName = (business?.name || 'business').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
                    const filename = `measurements_${safeName}_all_clients.csv`;
                    downloadTextFile(filename, csv, 'text/csv');
                    showToast && showToast('Excel file downloaded', 'success', 2000);
                } else if (format === 'pdf') {
                    const business = getCachedBusiness && getCachedBusiness();
                    const title = business?.name
                        ? `Measurements for ${business.name} (All Clients)`
                        : 'Measurements for All Clients';
                    openPrintableMeasurementsWindow(title, clients, measurements);
                }
            }
        );
    } catch (err) {
        console.error('Error downloading all measurements:', err);
        showToast && showToast('Failed to download measurements. Please try again.', 'error', 3000);
    }
});

// Theme Toggle Functionality
const THEME_STORAGE_KEY = 'measurement_vault_theme';

// Initialize theme immediately (before DOMContentLoaded to prevent flash)
(function initThemeEarly() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    if (document.documentElement) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
})();

// Set theme
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggleIcon(theme);
}

// Update theme toggle button icon
function updateThemeToggleIcon(theme) {
    // Moon icon SVG (for dark mode - clicking switches to light)
    const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    // Sun icon SVG (for light mode - clicking switches to dark)
    const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const icon = theme === 'dark' ? moonIcon : sunIcon;

    // Update button with ID
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = icon;
    }

    // Update all navbar theme toggle buttons
    document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
        btn.innerHTML = icon;
    });
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Theme toggle button event listener
document.addEventListener('DOMContentLoaded', () => {
    // Ensure theme is set (default to dark)
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    setTheme(savedTheme);

    // Find theme toggle button in active screen or home screen
    const activeScreen = document.querySelector('.screen.active') || document.getElementById('home-screen');
    const themeToggleBtn = activeScreen ? activeScreen.querySelector('.btn-theme-toggle') || document.getElementById('theme-toggle-btn') : document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Also add listeners to all theme toggle buttons for consistency
    document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
        if (!btn.hasAttribute('data-listener-added')) {
            btn.setAttribute('data-listener-added', 'true');
            btn.addEventListener('click', toggleTheme);
        }
    });
});

// Edit Client functionality
document.getElementById('edit-client-btn').addEventListener('click', async () => {
    closeAllMenuDropdowns();

    if (!currentClientId) {
        alert('Client not found');
        return;
    }

    const clients = await getClients();
    if (!Array.isArray(clients)) {
        alert('Error loading clients');
        return;
    }

    const client = clients.find(c => c.id === currentClientId);

    if (!client) {
        alert('Client not found');
        return;
    }

    // Pre-fill edit form
    document.getElementById('edit-client-name').value = client.name;
    document.getElementById('edit-client-phone').value = client.phone || '';
    document.getElementById('edit-client-sex').value = client.sex || '';

    showScreen('edit-client-screen');
});

// Delete Client functionality
document.getElementById('delete-client-btn').addEventListener('click', async () => {
    closeAllMenuDropdowns();

    if (!currentClientId) {
        alert('Client not found');
        return;
    }

    if (!confirm('Are you sure you want to delete this client? This will also delete all associated measurements.')) {
        return;
    }

    deleteClient(currentClientId);

    // Return to Clients Screen
    showScreen('clients-screen');
    await renderClientsList();
});

// Add Measurement from client details menu
document.getElementById('add-measurement-menu-btn').addEventListener('click', async () => {
    closeAllMenuDropdowns();

    if (!currentClientId) {
        alert('Client not found');
        return;
    }

    const clients = await getClients();
    if (!Array.isArray(clients)) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client) {
        alert('Client not found');
        return;
    }

    // Reset form first
    resetMeasurementForm();
    // currentClientId is already set

    // Update form header
    document.querySelector('#new-measurement-screen h2').textContent = 'New Measurement';

    // Pre-fill form with client data
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-name').disabled = true;
    document.getElementById('phone-number').value = client.phone || '';

    if (client.sex) {
        document.getElementById('client-sex').value = client.sex;
    }

    showScreen('new-measurement-screen');
});

// Download Measurements from client details menu
document.getElementById('download-measurements-menu-btn').addEventListener('click', async () => {
    closeAllMenuDropdowns();

    try {
        if (!currentClientId) {
            alert('Client not found');
            return;
        }

        const user = await getCurrentUser();
        if (!user) {
            alert('You must be logged in to download measurements.');
            return;
        }

        const [clients, measurements] = await Promise.all([getClients(), getMeasurements()]);
        if (!Array.isArray(clients) || !Array.isArray(measurements)) {
            alert('Error loading data. Please try again.');
            return;
        }

        const client = clients.find(c => c.id === currentClientId);
        if (!client) {
            alert('Client not found');
            return;
        }

        const clientMeasurements = measurements.filter(m => m.client_id === currentClientId);

        if (clientMeasurements.length === 0) {
            alert('No measurements found for this client.');
            return;
        }

        showDownloadFormatDialog(
            'Download Measurements',
            `Choose a format to download measurements for ${client.name}.`,
            (format) => {
                if (format === 'excel') {
                    const csv = buildMeasurementsCsvRows([client], clientMeasurements);
                    const safeName = (client.name || 'client').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
                    const filename = `measurements_${safeName}.csv`;
                    downloadTextFile(filename, csv, 'text/csv');
                    showToast && showToast('Excel file downloaded', 'success', 2000);
                } else if (format === 'pdf') {
                    openPrintableMeasurementsWindow(
                        `Measurements for ${client.name}`,
                        [client],
                        clientMeasurements
                    );
                }
            }
        );
    } catch (err) {
        console.error('Error downloading client measurements:', err);
        showToast && showToast('Failed to download measurements. Please try again.', 'error', 3000);
    }
});

// Edit Client Form Submission
document.getElementById('edit-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentClientId) {
        alert('Client not found');
        return;
    }

    const name = document.getElementById('edit-client-name').value.trim();
    const phone = document.getElementById('edit-client-phone').value.trim();
    const sex = document.getElementById('edit-client-sex').value;

    if (!name) {
        alert('Client name is required');
        return;
    }

    if (!sex) {
        alert('Sex is required');
        return;
    }

    const updatedClient = await updateClient(currentClientId, name, phone, sex);

    if (updatedClient) {
        // Show success message
        showToast('Client information updated successfully!', 'success', 2000);

        // Update the display directly using the returned client object (don't fetch again)
        // This ensures the display shows the updated values immediately
        document.getElementById('client-details-name').textContent = updatedClient.name;

        const detailsContainer = document.getElementById('client-details-content');
        if (detailsContainer) {
            // Get measurements for this client
            const measurements = await getMeasurements();
            const clientMeasurements = measurements
                .filter(m => m.client_id === currentClientId)
                .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

            // Always show client info (name, phone, sex)
            let html = `
                <div class="client-info">
                    <div class="client-info-item">
                        <span class="client-info-label">Name:</span>
                        <span>${escapeHtml(updatedClient.name)}</span>
                    </div>
                    ${updatedClient.phone ? `
                        <div class="client-info-item">
                            <span class="client-info-label">Phone:</span>
                            <span>${escapeHtml(updatedClient.phone)}</span>
                        </div>
                    ` : ''}
                    ${updatedClient.sex ? `
                        <div class="client-info-item">
                            <span class="client-info-label">Sex:</span>
                            <span>${escapeHtml(updatedClient.sex)}</span>
                        </div>
                    ` : ''}
                </div>
            `;

            if (clientMeasurements.length === 0) {
                html += `
                    <div class="empty-state" style="margin-top: 30px;">
                        <p>No measurements yet for this client.</p>
                    </div>
                `;
            } else {
                html += `
                    <div class="measurements-list" style="margin-top: 20px;">
                        <h3 style="margin-bottom: 15px;">Measurements (${clientMeasurements.length})</h3>
                        ${clientMeasurements.map(m => `
                            <div class="measurement-item" style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; cursor: pointer;" onclick="viewMeasurement('${m.id}')">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${escapeHtml(new Date(m.date_created).toLocaleDateString())}</strong>
                                    </div>
                                    <button class="btn btn-sm" onclick="event.stopPropagation(); deleteMeasurement('${m.id}');">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            detailsContainer.innerHTML = html;
        }

        // Stay on client details screen (already updated above)
    } else {
        showToast('Failed to update client information. Please try again.', 'error', 4000);
    }
});

// Back button from Edit Client screen
document.getElementById('back-from-edit-client-btn').addEventListener('click', async () => {
    if (currentClientId) {
        await showClientDetails(currentClientId, previousScreen);
    } else {
        showScreen('home-screen');
    }
});

// Business Setup Form Submission
function setupBusinessFormListener() {
    const businessSetupForm = document.getElementById('business-setup-form');
    if (!businessSetupForm) {
        // Form not ready yet, retry after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupBusinessFormListener);
        } else {
            // DOM is ready but form doesn't exist - this shouldn't happen, but retry anyway
            setTimeout(setupBusinessFormListener, 100);
        }
        return;
    }

    // Remove existing listener if any (to prevent duplicates)
    const newForm = businessSetupForm.cloneNode(true);
    businessSetupForm.parentNode.replaceChild(newForm, businessSetupForm);

    // Add event listener to the new form
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Disable button to prevent double submission
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn?.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
        }

        try {
            const name = document.getElementById('business-name').value.trim();
            const email = document.getElementById('business-email').value.trim();
            const phone = document.getElementById('business-phone').value.trim();

            if (!name) {
                alert('Business name is required');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
                return;
            }

            if (!phone) {
                alert('Business phone is required');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
                return;
            }

            // Email is optional - no validation needed

            // Clear any existing business session before starting registration
            // This ensures old businesses don't override new registrations
            localStorage.removeItem(CURRENT_BUSINESS_ID_KEY);
            localStorage.removeItem(LOGOUT_STATE_KEY);

            // Wait for Supabase to be ready
            console.log('Waiting for Supabase...');
            const supabase = await getSupabaseAsync();
            if (!supabase) {
                throw new Error('Unable to connect to database. Please check your internet connection and refresh the page.');
            }
            console.log('Supabase ready');

            // Get current user - must be authenticated
            const user = await getCurrentUser();
            if (!user) {
                throw new Error('You must be logged in to create a business. Please log in first.');
            }

            // Check if business already exists for this user
            const existingBusiness = await getBusinessForUser(user.id);

            if (existingBusiness) {
                console.log('Business already exists for this user');
                // Cache the business for offline use
                setCachedBusiness(existingBusiness);
                // Business exists - show dashboard
                updateBusinessHeaderSync(existingBusiness);
                updateNavbarBusinessNameSync(existingBusiness);
                showScreen('home-screen');
                await loadUserData(user.id);

                // Re-enable button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
            } else {
                console.log('Creating new business...');

                // Get current user
                const user = await getCurrentUser();
                if (!user) {
                    throw new Error('You must be logged in to create a business. Please log in first.');
                }

                // Create business for this user
                const supabase = await getSupabaseAsync();
                if (!supabase) {
                    throw new Error('Database connection not available');
                }

                // Check if business already exists for this user
                const existing = await getBusinessForUser(user.id);
                if (existing) {
                    throw new Error('You already have a business. Only one business per account is allowed.');
                }

                const { data, error } = await supabase
                    .from('businesses')
                    .insert([{
                        user_id: user.id,
                        name: name.trim(),
                        email: email ? email.trim().toLowerCase() : null,
                        phone: phone.trim()
                    }])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                const business = {
                    id: data.id,
                    name: data.name,
                    email: data.email || null,
                    phone: data.phone,
                    createdAt: data.created_at
                };

                console.log('Business created successfully');

                // Show success message
                showToast('Business created successfully!', 'success', 3000);

                // Cache the business for offline use
                setCachedBusiness(business);

                // Update header and show home screen
                updateBusinessHeaderSync(business);
                updateNavbarBusinessNameSync(business);
                showScreen('home-screen');
                await loadUserData(user.id);

                // Re-enable button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
            }
        } catch (err) {
            console.error('Error in business setup form submission:', err);
            const errorMessage = err.message || 'An error occurred. Please check the browser console (F12) for details.';
            alert(errorMessage);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
}

// Setup business form listener when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBusinessFormListener);
} else {
    setupBusinessFormListener();
}

// Settings button click
// Settings button handler - works with both ID and class
async function handleSettingsClick() {
    // Show screen immediately for instant feedback
    showScreen('settings-screen');

    // Load data asynchronously after screen is shown
    requestAnimationFrame(async () => {
        try {
            // Display business info (use cache for faster load)
            const business = await getBusiness(true);
            const infoContainer = document.getElementById('business-info-display');

            if (business && infoContainer) {
                infoContainer.innerHTML = `
            <div class="business-info-item">
                <span class="business-info-label">Name:</span>
                <span>${escapeHtml(business.name)}</span>
            </div>
            <div class="business-info-item">
                <span class="business-info-label">Email:</span>
                        <span>${escapeHtml(business.email || 'Not set')}</span>
            </div>
            <div class="business-info-item">
                <span class="business-info-label">Phone:</span>
                <span>${escapeHtml(business.phone)}</span>
            </div>
        `;
            }

            // Render email linking status (deferred)
            await renderEmailLinkingStatus();

            // Set up event listeners when settings screen is shown (in case they weren't set up yet)
            setupEmailLinkingListeners();

            // Check and show admin section if user is admin
            await checkAndShowAdminSection();
        } catch (err) {
            console.error('Error loading settings data:', err);
        }
    });
}

// Add settings button listener to ID-based button
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', handleSettingsClick);
}

// Add settings button listeners to all navbar settings buttons
document.querySelectorAll('.btn-settings').forEach(btn => {
    if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', handleSettingsClick);
    }
});

// Back from Settings
document.getElementById('back-from-settings-btn').addEventListener('click', () => {
    // Show screen immediately
    showScreen('home-screen');

    // Defer data loading
    requestAnimationFrame(() => {
        renderRecentMeasurements();
    });
});

// Admin button click
const adminBtn = document.getElementById('admin-btn');
if (adminBtn) {
    adminBtn.addEventListener('click', () => {
        showAdminScreen();
    });
}

// Back from Admin
const backFromAdminBtn = document.getElementById('back-from-admin-btn');
if (backFromAdminBtn) {
    backFromAdminBtn.addEventListener('click', () => {
        showScreen('settings-screen');
    });
}

// Admin tab switching
document.getElementById('admin-users-tab')?.addEventListener('click', () => switchAdminTab('users'));
document.getElementById('admin-businesses-tab')?.addEventListener('click', () => switchAdminTab('businesses'));
document.getElementById('admin-clients-tab')?.addEventListener('click', () => switchAdminTab('clients'));
document.getElementById('admin-measurements-tab')?.addEventListener('click', () => switchAdminTab('measurements'));

// Admin modal close buttons
document.getElementById('admin-user-details-close')?.addEventListener('click', () => {
    const modal = document.getElementById('admin-user-details-modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('admin-business-details-close')?.addEventListener('click', () => {
    const modal = document.getElementById('admin-business-details-modal');
    if (modal) modal.style.display = 'none';
});

// Close modals when clicking outside
document.getElementById('admin-user-details-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'admin-user-details-modal') {
        e.target.style.display = 'none';
    }
});

document.getElementById('admin-business-details-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'admin-business-details-modal') {
        e.target.style.display = 'none';
    }
});

// Edit Business button click
document.getElementById('edit-business-btn').addEventListener('click', async () => {
    const business = await getBusiness();
    if (business) {
        document.getElementById('edit-business-name').value = business.name || '';
        document.getElementById('edit-business-email').value = business.email || '';
        document.getElementById('edit-business-phone').value = business.phone || '';
    }
    showScreen('edit-business-screen');
});

// Back from Edit Business
document.getElementById('back-from-edit-business-btn').addEventListener('click', () => {
    showScreen('settings-screen');
});

// Edit Business Form Submission
document.getElementById('edit-business-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('edit-business-name').value.trim();
    const email = document.getElementById('edit-business-email').value.trim();
    const phone = document.getElementById('edit-business-phone').value.trim();

    if (!name) {
        alert('Business name is required');
        return;
    }

    if (!phone) {
        alert('Business phone is required');
        return;
    }

    // Email is optional - no validation needed

    const updatedBusiness = await updateBusiness(name, email, phone);

    if (updatedBusiness) {
        // Show success message
        showToast('Business information updated successfully!', 'success', 3000);

        // Update header using the updated business object (don't fetch again)
        updateBusinessHeaderSync(updatedBusiness);
        updateNavbarBusinessNameSync(updatedBusiness);

        // Update the display in settings using the updated business object
        const infoContainer = document.getElementById('business-info-display');
        if (infoContainer) {
            infoContainer.innerHTML = `
                <div class="business-info-item">
                    <span class="business-info-label">Name:</span>
                    <span>${escapeHtml(updatedBusiness.name)}</span>
                </div>
                <div class="business-info-item">
                    <span class="business-info-label">Email:</span>
                    <span>${escapeHtml(updatedBusiness.email || 'Not set')}</span>
                </div>
                <div class="business-info-item">
                    <span class="business-info-label">Phone:</span>
                    <span>${escapeHtml(updatedBusiness.phone)}</span>
                </div>
            `;
        }

        // Stay on settings screen (don't refresh it)
        // The display is already updated above
    } else {
        showToast('Failed to update business information. Please try again.', 'error', 4000);
    }
});

// Email Linking Event Listeners - Use event delegation for dynamic buttons
function setupEmailLinkingListeners() {
    // Remove existing listeners to prevent duplicates
    const existingListeners = document.querySelectorAll('[data-email-linking-listener]');
    existingListeners.forEach(el => el.removeAttribute('data-email-linking-listener'));

    // Send verification email button
    const sendVerificationBtn = document.getElementById('send-verification-btn');
    if (sendVerificationBtn && !sendVerificationBtn.hasAttribute('data-email-linking-listener')) {
        sendVerificationBtn.setAttribute('data-email-linking-listener', 'true');
        sendVerificationBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('link-email-input');
            if (!emailInput) {
                console.error('Email input not found');
                return;
            }

            const email = emailInput.value.trim();
            if (!email) {
                alert('Please enter an email address.');
                return;
            }

            sendVerificationBtn.disabled = true;
            sendVerificationBtn.textContent = 'Sending...';

            try {
                const success = await requestEmailVerification(email);

                if (success) {
                    // Refresh email linking status
                    await renderEmailLinkingStatus();

                    alert('Verification email sent! Please check your inbox and click the magic link to verify your email.');
                } else {
                    sendVerificationBtn.disabled = false;
                    sendVerificationBtn.textContent = 'Send Verification Link';
                }
            } catch (err) {
                console.error('Error in send verification:', err);
                sendVerificationBtn.disabled = false;
                sendVerificationBtn.textContent = 'Send Verification Link';
                alert('An error occurred. Please check the console for details.');
            }
        });
    }

    // Resend verification email button
    const resendVerificationBtn = document.getElementById('resend-verification-btn');
    if (resendVerificationBtn && !resendVerificationBtn.hasAttribute('data-email-linking-listener')) {
        resendVerificationBtn.setAttribute('data-email-linking-listener', 'true');
        resendVerificationBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const business = await getBusiness();
            if (!business || !business.email) {
                alert('No email address found.');
                return;
            }

            resendVerificationBtn.disabled = true;
            resendVerificationBtn.textContent = 'Resending...';

            try {
                const success = await requestEmailVerification(business.email);

                if (success) {
                    await renderEmailLinkingStatus();
                    alert('Verification email resent! Please check your inbox and click the magic link to verify your email.');
                } else {
                    resendVerificationBtn.disabled = false;
                    resendVerificationBtn.textContent = 'Resend Email';
                }
            } catch (err) {
                console.error('Error in resend verification:', err);
                resendVerificationBtn.disabled = false;
                resendVerificationBtn.textContent = 'Resend Email';
                alert('An error occurred. Please check the console for details.');
            }
        });
    }

    // Cancel verification button
    const cancelVerificationBtn = document.getElementById('cancel-verification-btn');
    if (cancelVerificationBtn && !cancelVerificationBtn.hasAttribute('data-email-linking-listener')) {
        cancelVerificationBtn.setAttribute('data-email-linking-listener', 'true');
        cancelVerificationBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const supabase = getSupabase();
            if (!supabase) return;

            const business = await getBusiness();
            if (!business) return;

            try {
                // Clear email (verification cancelled)
                await supabase
                    .from('businesses')
                    .update({
                        email: null,
                        email_verified: false
                    })
                    .eq('id', business.id);

                // Sign out from Supabase Auth if signed in (cleanup)
                await supabase.auth.signOut();

                await renderEmailLinkingStatus();
            } catch (err) {
                console.error('Error cancelling verification:', err);
                alert('An error occurred. Please try again.');
            }
        });
    }
}

// Set up listeners on DOMContentLoaded and also when settings screen is shown
document.addEventListener('DOMContentLoaded', setupEmailLinkingListeners);

// Logout button click (no data deletion)
document.getElementById('logout-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout? Your data will be preserved.')) {
        return;
    }

    // Clear all business session data and sign out from Supabase
    await logoutBusiness();

    // Always redirect to welcome screen after logout (prevent any redirect to business-setup)
    showScreen('welcome-screen');

    // Prevent initialization from showing business-setup-screen after logout
    // by ensuring we stay on login screen
    setTimeout(() => {
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen && currentScreen.id === 'business-setup-screen') {
            showScreen('welcome-screen');
        }
    }, 100);

});

// Business Login Form Submission
document.getElementById('business-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('login-business-name').value.trim();
    const email = document.getElementById('login-business-email').value.trim();
    const phone = document.getElementById('login-business-phone').value.trim();

    if (!name || !phone) {
        alert('Business name and phone are required');
        return;
    }

    // Email is optional - pass empty string if not provided
    // Check if credentials match
    if (await matchBusiness(name, email || '', phone)) {
        loginBusiness();
        await updateBusinessHeader();
        showScreen('home-screen');
        await renderRecentMeasurements();
    } else {
        alert('Business details do not match. Please check your information and try again.');
    }
});

// Reset Business button click (permanent deletion)
document.getElementById('reset-business-btn').addEventListener('click', () => {
    if (!confirm('Are you sure you want to RESET? This will permanently DELETE ALL your data including business info, clients, and measurements. This action cannot be undone.')) {
        return;
    }

    // Double confirmation for safety
    if (!confirm('This is your last chance! All data will be permanently deleted. Continue?')) {
        return;
    }

    // Reset everything
    resetBusiness();

    // Clear the setup form
    document.getElementById('business-setup-form').reset();

    // Show business setup screen
    showScreen('business-setup-screen');
});

// Add Custom Field button click - show modal
document.getElementById('add-custom-field-btn').addEventListener('click', () => {
    showAddFieldModal();
});

// Show the Add Field Modal
function showAddFieldModal() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'add-field-modal';
    modal.id = 'add-field-modal';
    modal.innerHTML = `
        <div class="add-field-modal-content">
            <h4>Add Measurement Field</h4>
            <div class="form-group">
                <label for="new-field-name">Field Name</label>
                <input type="text" id="new-field-name" placeholder="e.g., Ankle, Thigh, Tie" autocomplete="off">
            </div>
            <div class="form-group">
                <label for="new-field-value">Value</label>
                <input type="text" id="new-field-value" placeholder="Enter measurement" autocomplete="off">
            </div>
            <div class="add-field-modal-actions">
                <button type="button" class="btn btn-cancel" id="cancel-add-field-btn">Cancel</button>
                <button type="button" class="btn btn-primary" id="confirm-add-field-btn">Add</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus on the name input
    setTimeout(() => {
        document.getElementById('new-field-name').focus();
    }, 100);

    // Cancel button
    document.getElementById('cancel-add-field-btn').addEventListener('click', () => {
        closeAddFieldModal();
    });

    // Add button
    document.getElementById('confirm-add-field-btn').addEventListener('click', () => {
        const fieldName = document.getElementById('new-field-name').value.trim();
        const fieldValue = document.getElementById('new-field-value').value;

        if (!fieldName) {
            alert('Please enter a field name');
            return;
        }

        addCustomFieldInline(fieldName, fieldValue);
        closeAddFieldModal();
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAddFieldModal();
        }
    });

    // Close on Enter key in value field
    const valueInput = document.getElementById('new-field-value');
    if (valueInput) {
        valueInput.addEventListener('input', handleMeasurementInput);
        valueInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('confirm-add-field-btn').click();
            }
        });
    }
}

// Update all pending measurements that reference a temp client_id with the real client_id
function updatePendingMeasurementsClientId(tempClientId, realClientId) {
    if (!tempClientId || !realClientId || !isTempId(tempClientId)) {
        return;
    }

    // Update measurements in cache
    const measurements = getCachedMeasurements();
    measurements.forEach(measurement => {
        if (measurement.client_id === tempClientId) {
            updateMeasurementInCache(measurement.id, {
                ...measurement,
                client_id: realClientId
            });
        }
    });

    // Update pending sync queue items
    const queue = getPendingSyncQueue();
    let queueUpdated = false;
    queue.forEach(item => {
        if (item.action === 'create_measurement' && item.data.client_id === tempClientId) {
            item.data.client_id = realClientId;
            if (item.data.tempClientId === tempClientId) {
                delete item.data.tempClientId; // Remove temp reference
            }
            queueUpdated = true;
        } else if (item.action === 'update_measurement' && item.data.client_id === tempClientId) {
            item.data.client_id = realClientId;
            queueUpdated = true;
        }
    });

    if (queueUpdated) {
        localStorage.setItem(PENDING_SYNC_QUEUE_KEY, safeJsonStringify(queue));
    }
}

// Close the Add Field Modal
function closeAddFieldModal() {
    const modal = document.getElementById('add-field-modal');
    if (modal) {
        modal.remove();
    }
}

// Add a custom field inline with predefined fields (looks like native field)
function addCustomFieldInline(fieldName, fieldValue = '') {
    const container = document.getElementById('custom-fields-container');
    const fieldId = 'custom-' + Date.now().toString();

    // Create a form group that looks exactly like predefined fields
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group custom-field-group';
    formGroup.setAttribute('data-field-id', fieldId);

    // Capitalize the field name for display
    const displayName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    formGroup.innerHTML = `
        <label>
            <span>${escapeHtml(displayName)}</span>
            <button type="button" class="btn-remove-field" data-field-id="${fieldId}">Remove</button>
        </label>
        <input type="text" 
               class="custom-field-input" 
               data-field-name="${escapeHtml(fieldName.toLowerCase())}"
               value="${fieldValue}"
               autocomplete="off">
    `;

    container.appendChild(formGroup);

    // Add animation class for fade-in effect
    formGroup.classList.add('field-new');
    setTimeout(() => {
        formGroup.classList.remove('field-new');
    }, 150);

    // Add remove button listener
    formGroup.querySelector('.btn-remove-field').addEventListener('click', () => {
        formGroup.remove();
    });

    // Focus on the value input
    formGroup.querySelector('input').focus();
}

// Legacy function for editing measurements with existing custom fields
function addCustomFieldRow(fieldName = '', fieldValue = '') {
    if (fieldName) {
        addCustomFieldInline(fieldName, fieldValue);
    }
}

// Handle magic link verification on app load
async function handleMagicLinkVerification() {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        return false;
    }

    // Check if URL contains auth tokens (magic link redirect)
    const hash = window.location.hash;
    const hasAuthTokens = hash.includes('access_token') || hash.includes('type=recovery') || hash.includes('type=magiclink');

    if (!hasAuthTokens) {
        // No auth tokens in URL, check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
            // Session exists, verify email is linked to business
            await processEmailVerification(session.user.email);
        }
        return false;
    }

    // URL contains auth tokens - process the magic link callback
    try {
        // Supabase automatically processes hash fragments when getSession() is called
        // This will extract tokens from URL hash and establish the session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Error processing magic link session:', error);
            // Clear hash even on error
            if (hasAuthTokens) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
            return false;
        }

        if (!session?.user?.email) {
            console.warn('No session or email after processing magic link');
            // Clear hash if no session
            if (hasAuthTokens) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
            return false;
        }

        // Wait a moment for Supabase to fully process the email verification
        // Sometimes email_confirmed_at is set asynchronously
        let user = session.user;
        let attempts = 0;
        while (attempts < 5 && (!user.email_confirmed_at)) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const { data: { user: refreshedUser } } = await supabase.auth.getUser();
            if (refreshedUser) {
                user = refreshedUser;
            }
            attempts++;
        }

        // Session established successfully - link email to business
        // Use the refreshed user data to get accurate verification status
        const linked = await processEmailVerification(user.email);

        // Clear the hash from URL after processing (if it had tokens)
        if (hasAuthTokens) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        return linked;
    } catch (err) {
        console.error('Exception handling magic link:', err);
        // Clear hash even on error
        if (hasAuthTokens) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        return false;
    }
}

// Process email verification and link to business
async function processEmailVerification(email) {
    const business = await getBusiness();
    if (!business) {
        console.warn('No business found to link email to');
        return false;
    }

    // Link the verified email to the current device-based business
    // This checks Supabase Auth user's email_confirmed_at for real verification status
    const linked = await linkEmailToBusiness(email);

    if (linked) {
        // Refresh UI (but don't block on it)
        renderEmailLinkingStatus().catch(err => console.warn('Error refreshing email status:', err));
        updateBusinessHeader().catch(err => console.warn('Error updating header:', err));

        // Only show alert if we're on the settings screen or just verified
        const currentScreen = document.querySelector('.screen.active');
        const hasAuthTokens = window.location.hash.includes('access_token');
        if (currentScreen?.id === 'settings-screen' || hasAuthTokens) {
            // Small delay to ensure screen is rendered
            setTimeout(() => {
                alert('Email verified successfully! Your account is now linked to this email.');
            }, 100);
        }

        return true;
    } else {
        // Email not verified yet - might need to wait for Supabase to process
        console.warn('Email linking returned false - verification may still be processing');
        return false;
    }
}

// Initialize Supabase Auth state listener
async function initializeAuthListener() {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        console.warn('Supabase not ready for auth listener, will retry later');
        // Retry after a short delay
        setTimeout(() => initializeAuthListener(), 1000);
        return;
    }

    // Listen for auth state changes (when user clicks magic link)
    supabase.auth.onAuthStateChange(async (event, session) => {
        // Handle SIGNED_IN event for email linking
        if (event === 'SIGNED_IN' && session?.user?.email) {
            // Check if we have a current business to link to
            const business = await getBusiness();
            if (business && !business.email_verified) {
                // User clicked magic link and has a device-based business
                // Link the verified email to the current device-based business
                await processEmailVerification(session.user.email);
            }
        }
    });
}

// ========== STANDARD AUTHENTICATION INITIALIZATION ==========
// Setup auth state change listener for session persistence
// CRITICAL: Only respects SIGNED_OUT on explicit logout, ignores network failures
function setupAuthStateListener() {
    const supabase = getSupabase();
    if (!supabase) return;

    // Listen for auth state changes (token refresh, sign in, sign out)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State changed:', event, session?.user?.email || 'no user');

        // CRITICAL: Only respect SIGNED_OUT if it's an explicit logout
        // Network failures or offline state should NOT trigger logout
        if (event === 'SIGNED_OUT') {
            // Check if this is an explicit logout (logout flag set)
            const isExplicitLogout = localStorage.getItem(LOGOUT_STATE_KEY) === 'true';

            if (isExplicitLogout) {
                // User explicitly logged out - hide all authenticated screens, show login
                console.log('[Auth] Explicit logout detected');
                const allScreens = document.querySelectorAll('.screen');
                allScreens.forEach(screen => {
                    screen.classList.remove('active');
                    screen.style.display = 'none';
                });
                showScreen('login-screen');
                // Stop background sync
                if (window.syncManager) {
                    window.syncManager.stopBackgroundSync();
                }
            } else {
                // SIGNED_OUT but not explicit logout - likely network failure
                // Ignore it and keep user logged in with cached session
                console.log('[Auth] SIGNED_OUT event ignored (not explicit logout, likely network failure)');
                // Restore from cache if we have one
                const cachedSession = getCachedSession();
                if (cachedSession && cachedSession.user) {
                    console.log('[Auth] Restoring from cached session after network failure');
                    restoreUserSession(cachedSession.user.id).catch(err => {
                        console.warn('[Auth] Error restoring cached session:', err);
                    });
                }
            }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // User signed in or token refreshed - restore app state
            // CRITICAL: Do NOT show auth screens if user is authenticated
            if (session && session.user) {
                // Cache the session explicitly
                cacheSession(session);

                // Hide auth screens immediately
                const loginScreen = document.getElementById('login-screen');
                const signupScreen = document.getElementById('signup-screen');
                if (loginScreen) {
                    loginScreen.classList.remove('active');
                    loginScreen.style.display = 'none';
                }
                if (signupScreen) {
                    signupScreen.classList.remove('active');
                    signupScreen.style.display = 'none';
                }
                // Restore session and route correctly
                restoreUserSession(session.user.id).catch(err => {
                    console.error('Error restoring user session:', err);
                });
            }
        }
    });
}

// Restore user session and route to correct screen
// NOTE: This function is NON-BLOCKING - loader should already be hidden before this is called
// NOTE: UI should already be shown based on cached data - this function just syncs data
async function restoreUserSession(userId) {
    try {
        console.log('[Auth] Restoring session for user:', userId);

        // CRITICAL: Hide all auth screens first - authenticated users should NEVER see them
        const loginScreen = document.getElementById('login-screen');
        const signupScreen = document.getElementById('signup-screen');
        if (loginScreen) {
            loginScreen.classList.remove('active');
            loginScreen.style.display = 'none';
        }
        if (signupScreen) {
            signupScreen.classList.remove('active');
            signupScreen.style.display = 'none';
        }

        // Check if business exists for this user
        // ALWAYS check cache FIRST (offline-first approach)
        let business = getCachedBusiness();

        // Only query Supabase if online AND we don't have cached business
        // This is NON-BLOCKING - UI already shown
        if (isOnline() && !business) {
            try {
                const fetchedBusiness = await getBusinessForUser(userId);
                if (fetchedBusiness) {
                    business = fetchedBusiness;
                    // Update cache
                    setCachedBusiness(business);
                    // Update UI if dashboard is showing
                    const currentScreen = document.querySelector('.screen.active');
                    if (currentScreen && currentScreen.id === 'home-screen') {
                        updateBusinessHeaderSync(business);
                        updateNavbarBusinessNameSync(business);
                    } else {
                        // Check if user was in the middle of creating a measurement
                        const inProgressMeasurement = localStorage.getItem('measurement-in-progress');
                        if (inProgressMeasurement === 'true') {
                            console.log('[Auth] Measurement in progress, staying on new-measurement-screen');
                            showScreen('new-measurement-screen');
                        } else {
                            console.log('[Auth] No measurement in progress, showing dashboard');
                            showScreen('home-screen');
                        }
                        updateBusinessHeaderSync(business);
                        updateNavbarBusinessNameSync(business);
                    }
                }
            } catch (fetchErr) {
                // Network error - log warning but keep using cached data if available
                console.warn('[Auth] Could not fetch business from Supabase:', fetchErr);
                // Do NOT set business to null - preserve cached data
                // UI already shown, continue with cached data
            }
        } else if (!isOnline() && business) {
            // Offline with cached business - use it
            console.log('[Auth] Offline - using cached business data');
        }

        // If no business found, show business setup (only if not already showing)
        if (!business) {
            const currentScreen = document.querySelector('.screen.active');
            if (!currentScreen || currentScreen.id !== 'business-setup-screen') {
                console.log('[Auth] No business found, showing business setup');
                showScreen('business-setup-screen');
            }
        } else {
            // Business exists - ensure dashboard is showing
            const currentScreen = document.querySelector('.screen.active');
            if (!currentScreen || currentScreen.id !== 'home-screen') {
                console.log('[Auth] Business found, checking screen state');
                // Hide business setup screen if it was showing
                const businessSetupScreen = document.getElementById('business-setup-screen');
                if (businessSetupScreen) {
                    businessSetupScreen.classList.remove('active');
                    businessSetupScreen.style.display = 'none';
                }
                // Check if user was in the middle of creating a measurement
                const inProgressMeasurement = localStorage.getItem('measurement-in-progress');
                if (inProgressMeasurement === 'true') {
                    console.log('[Auth] Business restored - measurement in progress, staying on new-measurement-screen');
                    showScreen('new-measurement-screen');
                } else {
                    console.log('[Auth] Business restored - showing dashboard');
                    showScreen('home-screen');
                }
            }

            // Update UI with business info (non-blocking)
            updateBusinessHeaderSync(business);
            updateNavbarBusinessNameSync(business);

            // Load user data (non-blocking, doesn't block UI)
            // This loads from IndexedDB first, then syncs with Supabase in background
            loadUserData(userId).catch(err => {
                console.error('[Auth] Error loading user data:', err);
                // Don't block UI if data loading fails - user can still use the app
            });
        }
    } catch (err) {
        console.error('[Auth] Error restoring session:', err);
        // On error, try to use cached data first (offline-first)
        const cachedBusiness = getCachedBusiness();
        if (cachedBusiness) {
            // Hide auth screens
            const loginScreen = document.getElementById('login-screen');
            const signupScreen = document.getElementById('signup-screen');
            if (loginScreen) {
                loginScreen.classList.remove('active');
                loginScreen.style.display = 'none';
            }
            if (signupScreen) {
                signupScreen.classList.remove('active');
                signupScreen.style.display = 'none';
            }
            // Check if user was in the middle of creating a measurement
            const inProgressMeasurement = localStorage.getItem('measurement-in-progress');
            if (inProgressMeasurement === 'true') {
                // Keep user on new-measurement-screen
                showScreen('new-measurement-screen');
            } else {
                // Show dashboard with cached business
                showScreen('home-screen');
            }
            updateBusinessHeaderSync(cachedBusiness);
            updateNavbarBusinessNameSync(cachedBusiness);
            // Load cached data
            loadUserData(userId).catch(loadErr => {
                console.warn('[Auth] Error loading cached user data:', loadErr);
            });
        } else if (isOnline()) {
            // Only check Supabase session if online
            try {
                const supabase = await getSupabaseAsync();
                if (supabase) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session || !session.user) {
                        // Not authenticated - show login
                        showScreen('login-screen');
                    } else {
                        // Has session but error fetching business - show business setup
                        showScreen('business-setup-screen');
                    }
                } else {
                    // No Supabase - show business setup
                    showScreen('business-setup-screen');
                }
            } catch (sessionErr) {
                console.warn('[Auth] Error checking session:', sessionErr);
                // Show login as fallback
                showScreen('login-screen');
            }
        } else {
            // Offline and no cached business - show business setup
            showScreen('business-setup-screen');
        }
    }
}

// Check for cached session in localStorage (offline-safe)
// Explicit session cache key
const CACHED_SESSION_KEY = 'measurement_vault_cached_session';

// Cache session explicitly (called on login/signup)
function cacheSession(session) {
    if (!session || !session.user) return;
    try {
        const sessionData = {
            user: session.user,
            access_token: session.access_token,
            expires_at: session.expires_at,
            cached_at: Date.now()
        };
        localStorage.setItem(CACHED_SESSION_KEY, JSON.stringify(sessionData));
        console.log('[Auth] Session cached for offline use');
    } catch (err) {
        console.warn('[Auth] Error caching session:', err);
    }
}

// Clear cached session (called on explicit logout)
function clearCachedSession() {
    try {
        localStorage.removeItem(CACHED_SESSION_KEY);
        console.log('[Auth] Cached session cleared');
    } catch (err) {
        console.warn('[Auth] Error clearing cached session:', err);
    }
}

function getCachedSession() {
    try {
        // First check explicit cache
        const explicitCache = localStorage.getItem(CACHED_SESSION_KEY);
        if (explicitCache) {
            try {
                const parsed = JSON.parse(explicitCache);
                if (parsed && parsed.user) {
                    return {
                        user: parsed.user,
                        access_token: parsed.access_token
                    };
                }
            } catch (e) {
                // Invalid JSON, try Supabase cache
            }
        }

        // Fallback to Supabase's localStorage cache
        const keys = Object.keys(localStorage);
        const authKey = keys.find(key => key.includes('auth-token') && key.includes('supabase'));
        if (authKey) {
            const authData = localStorage.getItem(authKey);
            if (authData) {
                try {
                    const parsed = JSON.parse(authData);
                    // Check if session exists and has user
                    if (parsed && parsed.currentSession && parsed.currentSession.user) {
                        // Also cache it explicitly for future use
                        cacheSession(parsed.currentSession);
                        return {
                            user: parsed.currentSession.user,
                            access_token: parsed.currentSession.access_token
                        };
                    }
                } catch (e) {
                    // Invalid JSON, ignore
                }
            }
        }
    } catch (err) {
        console.warn('[Init] Error reading cached session:', err);
    }
    return null;
}

function initializeApp() {
    console.log('[Init] Initializing app...');

    // CRITICAL: Hide ALL screens initially - only loading screen should be visible
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });

    // Hide loading screen div if it exists (show it via showLoadingScreen function)
    const loadingScreen = document.getElementById('app-loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
    }

    // Show loading screen (overlay)
    showLoadingScreen();

    // Hide all measurement fields on page load
    const allFields = ['shoulder', 'chest', 'waist', 'sleeve', 'length', 'neck', 'hip', 'inseam', 'thigh', 'seat'];
    allFields.forEach(field => {
        const fieldElement = document.getElementById(field);
        if (fieldElement) {
            const formGroup = fieldElement.closest('.form-group');
            if (formGroup) {
                formGroup.style.display = 'none';
            }
        }
    });

    // Setup authentication form handlers (but don't show screens yet)
    setupAuthForms();

    // Setup measurement field validation
    setupMeasurementValidation();

    // CRITICAL: Hard timeout for loading screen - ALWAYS show UI after this
    const loadingTimeoutId = setTimeout(() => {
        console.log('[Init] Loading screen timeout - forcing UI to show');
        hideLoadingScreen();
        if (loadingScreen) loadingScreen.style.display = 'none';
        // If auth not ready yet, show login screen
        if (!authReady) {
            showScreen('login-screen');
        }
    }, LOADING_SCREEN_TIMEOUT_MS);

    // CRITICAL: Check cached session FIRST (offline-safe, no network required)
    const cachedSession = getCachedSession();
    if (cachedSession && cachedSession.user) {
        console.log('[Init] Found cached session for:', cachedSession.user.email);

        // Load local data FIRST (cache + IndexedDB) - this is fast and doesn't require network
        const cachedBusiness = getCachedBusiness();

        // IMMEDIATELY clear loading screen after local data check
        authReady = true;
        clearTimeout(loadingTimeoutId);
        hideLoadingScreen();
        if (loadingScreen) loadingScreen.style.display = 'none';

        // Show UI immediately based on cached data
        if (cachedBusiness) {
            // We have cached business - show dashboard immediately
            console.log('[Init] Found cached business, checking screen state');
            const inProgressMeasurement = localStorage.getItem('measurement-in-progress');
            if (inProgressMeasurement === 'true') {
                showScreen('new-measurement-screen');
            } else {
                showScreen('home-screen');
            }
            updateBusinessHeaderSync(cachedBusiness);
            updateNavbarBusinessNameSync(cachedBusiness);

            // Load local data from IndexedDB (non-blocking)
            (async function () {
                try {
                    await restoreUserSession(cachedSession.user.id);
                } catch (err) {
                    console.warn('[Init] Error restoring session:', err);
                    // UI already shown, continue with cached data
                }
            })();
        } else {
            // No cached business - show business setup
            console.log('[Init] No cached business, showing business setup');
            showScreen('business-setup-screen');
        }

        // Verify session with Supabase in background (non-blocking, doesn't affect UI)
        // ONLY if online - skip verification when offline
        // CRITICAL: Never show login screen if we have cached session - UI already shown
        if (isOnline()) {
            (async function () {
                try {
                    const supabase = await getSupabaseAsync();
                    if (supabase) {
                        setupAuthStateListener();
                        // Verify session (non-blocking)
                        try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session && session.user) {
                                // Valid session - cache it
                                cacheSession(session);
                            }
                            // Never show login if we have cached session - user is already logged in
                        } catch (sessionErr) {
                            console.warn('[Init] Session check failed (non-fatal):', sessionErr);
                            // Continue with cached session - UI already shown
                        }
                    }
                } catch (err) {
                    console.warn('[Init] Error verifying session:', err);
                    // Continue with cached session if offline - UI already shown
                }
            })();
        } else {
            console.log('[Init] Offline - skipping session verification, using cached session');
            // Still setup auth listener for when we come back online
            setupAuthStateListener();
        }
        return;
    }

    // No cached session - show login screen immediately
    console.log('[Init] No cached session found');
    authReady = true;
    clearTimeout(loadingTimeoutId);
    hideLoadingScreen();
    if (loadingScreen) loadingScreen.style.display = 'none';
    showScreen('login-screen');

    // Verify with Supabase in background (non-blocking, doesn't block UI)
    // ONLY if online - skip when offline
    if (isOnline()) {
        (async function () {
            try {
                console.log('[Init] Verifying auth in background...');
                const supabase = await getSupabaseAsync();

                if (!supabase) {
                    console.warn('[Init] Supabase not available - continuing offline');
                    return;
                }

                // Setup auth state change listener
                setupAuthStateListener();

                // Check session (non-blocking)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.warn('[Init] Session check error:', sessionError);
                    return;
                }

                if (session && session.user) {
                    console.log('[Init] Valid session found, caching and restoring...');
                    // Cache session explicitly
                    cacheSession(session);
                    // Clear logout flag
                    localStorage.removeItem(LOGOUT_STATE_KEY);
                    // User is authenticated - restore their session (non-blocking)
                    restoreUserSession(session.user.id).catch(err => {
                        console.warn('[Init] Error restoring session:', err);
                    });
                }
            } catch (err) {
                console.warn('[Init] Error during background auth check:', err);
                // Continue offline - UI already shown
            } finally {
                // Setup all form listeners
                console.log('[Init] Setting up form listeners...');
                setupBusinessFormListener();
            }
        })();
    } else {
        console.log('[Init] Offline - skipping auth verification, using cached session');
        // Still setup auth listener for when we come back online
        setupAuthStateListener();
        // Setup form listeners
        setupBusinessFormListener();
    }
}

// Setup authentication form handlers
window.setupAuthForms = setupAuthForms;
function setupAuthForms() {
    // Sign up form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;

            const errorDiv = document.getElementById('signup-error');
            const successDiv = document.getElementById('signup-success');

            // Clear previous messages
            if (errorDiv) errorDiv.style.display = 'none';
            if (successDiv) successDiv.style.display = 'none';

            // Validate
            if (password !== confirmPassword) {
                if (errorDiv) {
                    errorDiv.textContent = 'Passwords do not match';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            if (password.length < 6) {
                if (errorDiv) {
                    errorDiv.textContent = 'Password must be at least 6 characters';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            try {
                const supabase = await getSupabaseAsync();
                if (!supabase) throw new Error('Database not available');

                const { data, error } = await supabase.auth.signUp({
                    email: email.toLowerCase(),
                    password: password,
                    options: {
                        emailRedirectTo: `${window.location.origin}${window.location.pathname}`
                    }
                });

                if (error) throw error;

                // Check if email confirmation is required
                if (data.user && !data.user.email_confirmed_at) {
                    // Email confirmation required
                    if (successDiv) {
                        successDiv.innerHTML = `
                            <div style="margin-bottom: 12px;">
                                <strong>Account created!</strong> Check your email (and spam folder) for the verification link.
                            </div>
                            <button id="resend-verification-btn" type="button" class="btn btn-secondary" style="width: 100%; margin-top: 8px;">
                                Resend Verification Email
                            </button>
                        `;
                        successDiv.style.display = 'block';

                        // Add resend button handler
                        const resendBtn = document.getElementById('resend-verification-btn');
                        if (resendBtn) {
                            resendBtn.addEventListener('click', async () => {
                                resendBtn.disabled = true;
                                resendBtn.textContent = 'Sending...';
                                try {
                                    const { error: resendError } = await supabase.auth.resend({
                                        type: 'signup',
                                        email: email.toLowerCase()
                                    });
                                    if (resendError) throw resendError;
                                    resendBtn.textContent = 'Email Sent!';
                                    setTimeout(() => {
                                        resendBtn.disabled = false;
                                        resendBtn.textContent = 'Resend Verification Email';
                                    }, 3000);
                                } catch (resendErr) {
                                    console.error('Resend error:', resendErr);
                                    resendBtn.textContent = 'Failed. Try again.';
                                    resendBtn.disabled = false;
                                }
                            });
                        }
                    }
                } else {
                    // Email might be auto-confirmed (if Supabase settings allow)
                    if (data.session) {
                        // Cache session explicitly for offline use
                        cacheSession(data.session);
                        // Clear logout flag
                        localStorage.removeItem(LOGOUT_STATE_KEY);
                    }
                    if (successDiv) {
                        successDiv.textContent = 'Account created successfully! Redirecting...';
                        successDiv.style.display = 'block';
                    }
                    // Show toast for consistency
                    showToast('Account created successfully!', 'success', 3000);
                    // Reload to check auth state
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }

                // Disable form
                signupForm.querySelector('button[type="submit"]').disabled = true;
            } catch (err) {
                console.error('Sign up error:', err);
                if (errorDiv) {
                    let errorMessage = err.message || 'Failed to create account. Please try again.';

                    // Provide helpful error messages
                    if (err.message && err.message.includes('already registered')) {
                        errorMessage = 'This email is already registered. Try logging in instead.';
                    } else if (err.message && err.message.includes('email')) {
                        errorMessage = 'Invalid email address. Please check and try again.';
                    }

                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
            }
        });
    }

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            const errorDiv = document.getElementById('login-error');
            if (errorDiv) errorDiv.style.display = 'none';

            try {
                const supabase = await getSupabaseAsync();
                if (!supabase) throw new Error('Database not available');

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email.toLowerCase(),
                    password: password
                });

                if (error) throw error;

                // Check if user email is verified
                if (data.user && !data.user.email_confirmed_at) {
                    if (errorDiv) {
                        errorDiv.innerHTML = `
                            <div style="margin-bottom: 12px;">
                                Please verify your email before logging in. Check your inbox and spam folder.
                            </div>
                            <button id="resend-login-verification-btn" type="button" class="btn btn-secondary" style="width: 100%; margin-top: 8px;">
                                Resend Verification Email
                            </button>
                        `;
                        errorDiv.style.display = 'block';

                        // Add resend button handler
                        const resendBtn = document.getElementById('resend-login-verification-btn');
                        if (resendBtn) {
                            resendBtn.addEventListener('click', async () => {
                                resendBtn.disabled = true;
                                resendBtn.textContent = 'Sending...';
                                try {
                                    const { error: resendError } = await supabase.auth.resend({
                                        type: 'signup',
                                        email: email.toLowerCase()
                                    });
                                    if (resendError) throw resendError;
                                    resendBtn.textContent = 'Email Sent!';
                                    setTimeout(() => {
                                        resendBtn.disabled = false;
                                        resendBtn.textContent = 'Resend Verification Email';
                                    }, 3000);
                                } catch (resendErr) {
                                    console.error('Resend error:', resendErr);
                                    resendBtn.textContent = 'Failed. Try again.';
                                    resendBtn.disabled = false;
                                }
                            });
                        }
                    }
                    return;
                }

                // Login successful - cache session and restore
                console.log('[Login] Login successful, caching session and restoring...');
                if (data.session) {
                    // Cache session explicitly for offline use
                    cacheSession(data.session);
                    // Clear logout flag
                    localStorage.removeItem(LOGOUT_STATE_KEY);
                }
                if (data.user) {
                    showToast('Login successful!', 'success', 2000);
                    await restoreUserSession(data.user.id);
                } else {
                    // Fallback to reload if user data not available
                    window.location.reload();
                }
            } catch (err) {
                console.error('Login error:', err);
                if (errorDiv) {
                    errorDiv.textContent = err.message || 'Invalid email or password.';
                    errorDiv.style.display = 'block';
                }
            }
        });
    }

    // Change Password Form
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmNewPassword = document.getElementById('confirm-new-password').value;

            const errorDiv = document.getElementById('change-password-error');
            const successDiv = document.getElementById('change-password-success');

            // Clear previous messages
            if (errorDiv) errorDiv.style.display = 'none';
            if (successDiv) successDiv.style.display = 'none';

            // Validate
            if (!currentPassword) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please enter your current password';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            if (newPassword.length < 6) {
                if (errorDiv) {
                    errorDiv.textContent = 'New password must be at least 6 characters';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            if (newPassword !== confirmNewPassword) {
                if (errorDiv) {
                    errorDiv.textContent = 'New passwords do not match';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            if (currentPassword === newPassword) {
                if (errorDiv) {
                    errorDiv.textContent = 'New password must be different from current password';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            try {
                const supabase = await getSupabaseAsync();
                if (!supabase) throw new Error('Database not available');

                // Verify current password by attempting to sign in
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('You must be logged in to change your password');

                // Verify current password
                const { error: verifyError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword
                });

                if (verifyError) {
                    throw new Error('Current password is incorrect');
                }

                // Update password
                const { error: updateError } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (updateError) throw updateError;

                // Success
                if (successDiv) {
                    successDiv.textContent = 'Password updated successfully!';
                    successDiv.style.display = 'block';
                }

                // Show toast notification for consistency
                showToast('Password updated successfully!', 'success', 3000);

                // Clear form
                changePasswordForm.reset();

                // Hide success message after 5 seconds
                setTimeout(() => {
                    if (successDiv) successDiv.style.display = 'none';
                }, 5000);

            } catch (err) {
                console.error('Change password error:', err);
                if (errorDiv) {
                    let errorMessage = err.message || 'Failed to update password. Please try again.';

                    // Provide helpful error messages
                    if (err.message && err.message.includes('incorrect')) {
                        errorMessage = 'Current password is incorrect. Please try again.';
                    } else if (err.message && err.message.includes('same')) {
                        errorMessage = 'New password must be different from your current password.';
                    } else if (err.message && err.message.includes('logged in')) {
                        errorMessage = 'You must be logged in to change your password.';
                    }

                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
            }
        });
    }

    // Forgot Password Link
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const cancelForgotPasswordBtn = document.getElementById('cancel-forgot-password-btn');

    if (forgotPasswordLink && forgotPasswordForm) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordForm.style.display = 'block';
        });
    }

    if (cancelForgotPasswordBtn && forgotPasswordForm) {
        cancelForgotPasswordBtn.addEventListener('click', () => {
            forgotPasswordForm.style.display = 'none';
            // Clear form and messages
            const submitForm = document.getElementById('forgot-password-submit-form');
            if (submitForm) submitForm.reset();
            const errorDiv = document.getElementById('forgot-password-error');
            const successDiv = document.getElementById('forgot-password-success');
            if (errorDiv) errorDiv.style.display = 'none';
            if (successDiv) successDiv.style.display = 'none';
        });
    }

    // Forgot Password Form Submission
    const forgotPasswordSubmitForm = document.getElementById('forgot-password-submit-form');
    if (forgotPasswordSubmitForm) {
        forgotPasswordSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('forgot-password-email').value.trim();

            const errorDiv = document.getElementById('forgot-password-error');
            const successDiv = document.getElementById('forgot-password-success');

            // Clear previous messages
            if (errorDiv) errorDiv.style.display = 'none';
            if (successDiv) successDiv.style.display = 'none';

            // Validate email
            if (!email) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please enter your email address';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please enter a valid email address';
                    errorDiv.style.display = 'block';
                }
                return;
            }

            try {
                const supabase = await getSupabaseAsync();
                if (!supabase) throw new Error('Database not available');

                // Send password reset email
                const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
                    redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`
                });

                if (error) throw error;

                // Success
                if (successDiv) {
                    successDiv.innerHTML = `
                        <div style="margin-bottom: 8px;">
                            <strong>Password reset email sent!</strong>
                        </div>
                        <div style="font-size: 13px; opacity: 0.9;">
                            Check your email (${escapeHtml(email)}) for a password reset link. 
                            The link will expire in 1 hour.
                        </div>
                    `;
                    successDiv.style.display = 'block';
                }

                // Clear form
                forgotPasswordSubmitForm.reset();

                // Hide form after 5 seconds
                setTimeout(() => {
                    if (forgotPasswordForm) {
                        forgotPasswordForm.style.display = 'none';
                    }
                }, 5000);

            } catch (err) {
                console.error('Forgot password error:', err);
                if (errorDiv) {
                    let errorMessage = err.message || 'Failed to send reset email. Please try again.';

                    // Provide helpful error messages
                    if (err.message && err.message.includes('not found')) {
                        errorMessage = 'No account found with this email address.';
                    } else if (err.message && err.message.includes('email')) {
                        errorMessage = 'Invalid email address. Please check and try again.';
                    }

                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
            }
        });
    }

    // Navigation links
    const goToSignupLink = document.getElementById('go-to-signup-link');
    if (goToSignupLink) {
        goToSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('signup-screen');
            // Update tab states
            updateAuthTabs('signup');
        });
    }

    const goToLoginLink = document.getElementById('go-to-login-link');
    if (goToLoginLink) {
        goToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('login-screen');
            // Update tab states
            updateAuthTabs('login');
        });
    }

    // Function to update auth tab states
    function updateAuthTabs(activeTab) {
        const loginScreen = document.getElementById('login-screen');
        const signupScreen = document.getElementById('signup-screen');

        // Update login screen tabs
        if (loginScreen) {
            const loginTabs = loginScreen.querySelectorAll('.auth-tab');
            loginTabs.forEach(tab => {
                if (tab.dataset.tab === activeTab) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        }

        // Update signup screen tabs
        if (signupScreen) {
            const signupTabs = signupScreen.querySelectorAll('.auth-tab');
            signupTabs.forEach(tab => {
                if (tab.dataset.tab === activeTab) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        }
    }

    // Update tabs when screens are shown
    const originalShowScreen = window.showScreen;
    if (typeof originalShowScreen === 'function') {
        window.showScreen = function (screenId) {
            originalShowScreen(screenId);
            if (screenId === 'login-screen') {
                updateAuthTabs('login');
            } else if (screenId === 'signup-screen') {
                updateAuthTabs('signup');
            }
        };
    }
}

// Get business for user (one business per user)
// NOTE: Only call this when online - always check cache first
async function getBusinessForUser(userId) {
    // Do NOT query Supabase if offline
    if (!isOnline()) {
        console.warn('[getBusinessForUser] Offline - cannot fetch from Supabase');
        return null;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        console.warn('[getBusinessForUser] Supabase client not available');
        return null;
    }

    try {
        console.log('[getBusinessForUser] Looking for business with user_id:', userId);

        // First try by user_id
        let { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle(); // Use maybeSingle() instead of single() to avoid error if not found

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('[getBusinessForUser] Error querying by user_id:', error);
        }

        // If not found by user_id, try to find by user's email as fallback
        if (!data || !data.id) {
            console.log('[getBusinessForUser] No business found by user_id, trying email fallback...');
            const user = await getCurrentUser();
            if (user && user.email) {
                const { data: emailBusiness, error: emailError } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('email', user.email.toLowerCase())
                    .limit(1)
                    .maybeSingle();

                if (!emailError && emailBusiness && emailBusiness.id) {
                    console.log('[getBusinessForUser] Found business by email, updating with user_id...');
                    // Update business with user_id for future lookups
                    const { error: updateError } = await supabase
                        .from('businesses')
                        .update({ user_id: userId })
                        .eq('id', emailBusiness.id);

                    if (!updateError) {
                        data = emailBusiness;
                        console.log('[getBusinessForUser] Business updated with user_id');
                    } else {
                        console.warn('[getBusinessForUser] Error updating business user_id:', updateError);
                    }
                }
            }
        }

        if (!data || !data.id) {
            console.warn('[getBusinessForUser] No business found for user:', userId);
            return null;
        }

        console.log('[getBusinessForUser] Found business:', data.name, data.id);

        return {
            id: data.id,
            name: data.name,
            email: data.email || null,
            phone: data.phone,
            createdAt: data.created_at
        };
    } catch (err) {
        console.error('[getBusinessForUser] Network error:', err);
        return null;
    }
}

// Track if loadUserData is currently running to prevent concurrent calls
let loadUserDataInProgress = false;
let loadUserDataPromise = null;

// Load user data (clients and measurements) - LOCAL-FIRST with strict load order
async function loadUserData(userId) {
    // Prevent concurrent calls - if already loading, return the existing promise
    if (loadUserDataInProgress && loadUserDataPromise) {
        console.log('[LoadData] Already loading, waiting for existing load to complete...');
        return loadUserDataPromise;
    }

    loadUserDataInProgress = true;
    loadUserDataPromise = (async () => {
        try {
            console.log('[LoadData] Starting data load for user:', userId);

            // Step 1: Initialize IndexedDB FIRST (required for all operations)
            if (window.indexedDBHelper) {
                try {
                    await window.indexedDBHelper.initDB();
                    console.log('[LoadData] IndexedDB initialized');
                } catch (dbErr) {
                    console.error('[LoadData] IndexedDB initialization failed:', dbErr);
                    throw new Error('Failed to initialize local database');
                }
            } else {
                console.warn('[LoadData] IndexedDB helper not available');
            }

            // Step 2: Load business (required for business_id)
            // ALWAYS check cache FIRST, only query Supabase if online
            let business = getCachedBusiness();

            // Only query Supabase if online and no cached business
            if (isOnline() && !business) {
                try {
                    const fetchedBusiness = await getBusinessForUser(userId);
                    if (fetchedBusiness) {
                        business = fetchedBusiness;
                        setCachedBusiness(business);
                    }
                } catch (err) {
                    console.warn('[LoadData] Could not fetch business:', err);
                    // Continue with cached business if available
                }
            }

            if (business) {
                updateBusinessHeaderSync(business);
                updateNavbarBusinessNameSync(business);
                console.log('[LoadData] Business loaded:', business.name);
            } else {
                console.warn('[LoadData] No business found (checking cache first)');
                // Try cache one more time as fallback
                const cachedBusiness = getCachedBusiness();
                if (cachedBusiness) {
                    business = cachedBusiness;
                    updateBusinessHeaderSync(business);
                    updateNavbarBusinessNameSync(business);
                    console.log('[LoadData] Using cached business:', business.name);
                } else {
                    return; // Cannot proceed without business
                }
            }

            // Step 3: Check if IndexedDB is empty - if so, seed from Supabase FIRST
            // This ensures data is available when loading on a new device
            console.log('[LoadData] Checking if IndexedDB needs seeding...');
            const existingClients = await window.indexedDBHelper.getClientsLocal(userId);
            const existingMeasurements = await window.indexedDBHelper.getMeasurementsLocal(userId);
            console.log(`[LoadData] IndexedDB status - Clients: ${existingClients.length}, Measurements: ${existingMeasurements.length}, Online: ${isOnline()}`);

            if ((existingClients.length === 0 && existingMeasurements.length === 0) && isOnline()) {
                console.log('[LoadData] IndexedDB is empty - seeding from Supabase...');
                try {
                    await seedIndexedDBFromSupabase(userId);
                    console.log('[LoadData] Seeding complete - data loaded from Supabase');
                    // After seeding, refresh the data to ensure UI shows the new data
                    // Small delay to ensure IndexedDB writes are complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (seedErr) {
                    console.error('[LoadData] Seeding failed:', seedErr);
                    console.error('[LoadData] Seeding error details:', {
                        message: seedErr.message,
                        stack: seedErr.stack,
                        name: seedErr.name
                    });
                    // Continue anyway - user might have local data or be offline
                }
            } else {
                if (existingClients.length > 0 || existingMeasurements.length > 0) {
                    console.log('[LoadData] IndexedDB already has data - skipping seed');
                } else if (!isOnline()) {
                    console.log('[LoadData] Offline - skipping seed');
                }
            }

            // Step 4: Load clients from IndexedDB (local data, fast, non-blocking)
            // This happens AFTER Supabase seed (if needed) - UI renders with synced data
            console.log('[LoadData] Loading clients from IndexedDB...');
            let clients = await getClients(true);
            if (!Array.isArray(clients)) {
                console.error('[LoadData] Failed to load clients');
                return;
            }
            console.log('[LoadData] Clients loaded:', clients.length);

            // Step 5: Load measurements from IndexedDB (local data, fast, non-blocking)
            console.log('[LoadData] Loading measurements from IndexedDB...');
            let measurements = await getMeasurements(true);
            if (!Array.isArray(measurements)) {
                console.error('[LoadData] Failed to load measurements');
                return;
            }
            console.log('[LoadData] Measurements loaded:', measurements.length);

            // If we just seeded and got data, reload to ensure we have the latest
            if ((existingClients.length === 0 && existingMeasurements.length === 0) &&
                (clients.length > 0 || measurements.length > 0)) {
                console.log('[LoadData] Data was seeded - reloading to ensure consistency...');
                clients = await getClients(true);
                measurements = await getMeasurements(true);
                console.log('[LoadData] Reloaded - Clients:', clients.length, 'Measurements:', measurements.length);
            }

            // Step 6: Check for unsynced items and sync if online
            // This handles offline-created items that need to sync when connectivity returns
            if (isOnline() && window.reconciliation && business) {
                try {
                    // Check if there are unsynced items
                    const unsyncedClients = await window.indexedDBHelper.getUnsyncedClients(userId);
                    const unsyncedMeasurements = await window.indexedDBHelper.getUnsyncedMeasurements(userId);

                    if (unsyncedClients.length > 0 || unsyncedMeasurements.length > 0) {
                        console.log(`[LoadData] Found ${unsyncedClients.length} unsynced clients and ${unsyncedMeasurements.length} unsynced measurements - syncing...`);
                        // Trigger reconciliation to sync unsynced items
                        window.reconciliation.reconcileAll(business.id).catch(err => {
                            console.warn('[LoadData] Reconciliation failed:', err);
                        });
                    }
                } catch (syncErr) {
                    console.warn('[LoadData] Error checking for unsynced items:', syncErr);
                    // Don't block - continue with normal flow
                }
            }

            // Step 7: Render recent measurements (clients are now loaded)
            console.log('[LoadData] Rendering recent measurements...');
            renderRecentMeasurements();
            console.log('[LoadData] Data load complete');
        } catch (err) {
            console.error('[LoadData] Error loading user data:', err);
            throw err;
        } finally {
            loadUserDataInProgress = false;
            loadUserDataPromise = null;
        }
    })();

    return loadUserDataPromise;
}

// Track if seeding is in progress to prevent duplicates
let seedingInProgress = false;

// Seed IndexedDB from Supabase (runs when IndexedDB is empty on new device)
// NOTE: Only runs when online - uses cached data when offline
async function seedIndexedDBFromSupabase(userId) {
    // Prevent concurrent seeding
    if (seedingInProgress) {
        console.log('[Seed] Seeding already in progress, skipping...');
        return;
    }

    if (!window.indexedDBHelper) {
        console.warn('[Seed] IndexedDB helper not available');
        return;
    }

    // Do NOT query Supabase if offline
    if (!isOnline()) {
        console.log('[Seed] Offline - skipping Supabase seed, using local data');
        return;
    }

    // Double-check IndexedDB is still empty (might have been populated by another call)
    const existingClients = await window.indexedDBHelper.getClientsLocal(userId);
    const existingMeasurements = await window.indexedDBHelper.getMeasurementsLocal(userId);

    if (existingClients.length > 0 || existingMeasurements.length > 0) {
        console.log('[Seed] IndexedDB already has data, skipping seed. Clients:', existingClients.length, 'Measurements:', existingMeasurements.length);
        return;
    }

    seedingInProgress = true;

    try {
        // Fetch from Supabase (only if online)
        const supabase = await getSupabaseAsync();
        if (!supabase) {
            console.warn('[Seed] Supabase client not available');
            return;
        }

        let business = await getBusinessForUser(userId);
        if (!business) {
            const errorMsg = '[Seed] No business found for user - cannot seed data. Please create a business first or ensure your business is linked to your account.';
            console.error(errorMsg);
            console.error('[Seed] User ID:', userId);
            throw new Error(errorMsg);
        }

        console.log('[Seed] Business found:', business.name, business.id);

        console.log('[Seed] Fetching clients and measurements from Supabase for user:', userId);
        console.log('[Seed] Business ID:', business.id);

        // STRICT FETCH: Fetch clients by business_id ONLY (strict scope)
        console.log('[Seed] Fetching clients by business_id:', business.id);
        const { data: clientsData, error: clientsError } = await supabase
            .from('clients')
            .select('*')
            .eq('business_id', business.id) // STRICT: Always use business_id scope
            .order('created_at', { ascending: false });

        if (clientsError) {
            console.error('[Seed] Error fetching clients:', clientsError);
            throw new Error(`Failed to fetch clients: ${clientsError.message}`);
        }

        let clientsSeeded = 0;
        if (clientsData && clientsData.length > 0) {
            console.log(`[Seed] Found ${clientsData.length} clients in Supabase`);
            for (const client of clientsData) {
                try {
                    // If client doesn't have user_id, update it in Supabase
                    if (!client.user_id) {
                        console.log(`[Seed] Updating client ${client.id} with user_id...`);
                        const { error: updateError } = await supabase
                            .from('clients')
                            .update({ user_id: userId })
                            .eq('id', client.id);

                        if (updateError) {
                            console.warn(`[Seed] Error updating client user_id:`, updateError);
                        }
                    }

                    await window.indexedDBHelper.saveClientLocal({
                        server_id: client.id,
                        name: client.name,
                        phone: client.phone || null,
                        sex: client.sex || null,
                        created_at: client.created_at,
                        synced: true // Already synced
                    }, userId, business.id);
                    clientsSeeded++;
                } catch (clientErr) {
                    console.warn('[Seed] Error saving client:', clientErr);
                }
            }
            console.log(`[Seed] Seeded ${clientsSeeded} clients to IndexedDB`);
        } else {
            console.log('[Seed] No clients found in Supabase');
        }

        // STRICT FETCH: Fetch measurements by business_id ONLY (strict scope)
        console.log('[Seed] Fetching measurements by business_id:', business.id);
        const { data: measurementsData, error: measurementsError } = await supabase
            .from('measurements')
            .select('*')
            .eq('business_id', business.id) // STRICT: Always use business_id scope
            .order('created_at', { ascending: false });

        if (measurementsError) {
            console.error('[Seed] Error fetching measurements:', measurementsError);
            throw new Error(`Failed to fetch measurements: ${measurementsError.message}`);
        }

        let measurementsSeeded = 0;
        if (measurementsData && measurementsData.length > 0) {
            console.log(`[Seed] Found ${measurementsData.length} measurements in Supabase`);
            for (const measurement of measurementsData) {
                try {
                    // If measurement doesn't have user_id, update it in Supabase
                    if (!measurement.user_id) {
                        console.log(`[Seed] Updating measurement ${measurement.id} with user_id...`);
                        const { error: updateError } = await supabase
                            .from('measurements')
                            .update({ user_id: userId })
                            .eq('id', measurement.id);

                        if (updateError) {
                            console.warn(`[Seed] Error updating measurement user_id:`, updateError);
                        }
                    }

                    await window.indexedDBHelper.saveMeasurementLocal({
                        server_id: measurement.id,
                        client_id: measurement.client_id,
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
                        custom_fields: measurement.custom_fields || {},
                        created_at: measurement.created_at,
                        synced: true // Already synced
                    }, userId, business.id);
                    measurementsSeeded++;
                } catch (measurementErr) {
                    console.warn('[Seed] Error saving measurement:', measurementErr);
                }
            }
            console.log(`[Seed] Seeded ${measurementsSeeded} measurements to IndexedDB`);
        } else {
            console.log('[Seed] No measurements found in Supabase');
        }

        console.log(`[Seed] Complete - ${clientsSeeded} clients, ${measurementsSeeded} measurements`);
    } catch (err) {
        console.error('[Seed] Error seeding IndexedDB:', err);
        throw err; // Re-throw so caller knows it failed
    } finally {
        seedingInProgress = false;
    }
}

// Get current authenticated user
// NOTE: When offline, returns null to avoid network calls
async function getCurrentUser() {
    // Do NOT call Supabase auth when offline
    if (!isOnline()) {
        // Try to get user from cached session
        const cachedSession = getCachedSession();
        if (cachedSession && cachedSession.user) {
            return cachedSession.user;
        }
        return null;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) return null;

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch (err) {
        console.warn('[getCurrentUser] Network error:', err);
        // Fallback to cached session
        const cachedSession = getCachedSession();
        if (cachedSession && cachedSession.user) {
            return cachedSession.user;
        }
        return null;
    }
}

// Get clients (updated to use user_id)
async function getClients(forceRefresh = false) {
    const user = await getCurrentUser();
    if (!user) return [];

    // Initialize IndexedDB if needed
    if (!window.indexedDBHelper) {
        try {
            await window.indexedDBHelper.initDB();
        } catch (initErr) {
            console.error('[GetClients] IndexedDB initialization failed:', initErr);
            return [];
        }
    }

    try {
        // Read from IndexedDB (local-first)
        const clients = await window.indexedDBHelper.getClientsLocal(user.id);

        // Ensure all clients have both id (server_id or local_id) and local_id for matching
        const normalizedClients = (clients || []).map(client => ({
            ...client,
            id: client.server_id || client.local_id, // Prefer server_id, fallback to local_id
            local_id: client.local_id // Always include local_id for matching
        }));

        clientsCache = normalizedClients;
        return normalizedClients;
    } catch (err) {
        console.error('[GetClients] Error fetching clients from IndexedDB:', err);
        return [];
    }
}

// Get measurements - LOCAL-FIRST: reads from IndexedDB
async function getMeasurements(forceRefresh = false) {
    const user = await getCurrentUser();
    if (!user) return [];

    // Initialize IndexedDB if needed
    if (!window.indexedDBHelper) {
        await window.indexedDBHelper.initDB();
    }

    try {
        // Read from IndexedDB (local-first)
        const measurements = await window.indexedDBHelper.getMeasurementsLocal(user.id);
        measurementsCache = measurements;
        return measurements || [];
    } catch (err) {
        console.error('Error fetching measurements from IndexedDB:', err);
        return [];
    }
}

// Start retry mechanism for pending measurements (every 2-3 seconds)
function startPendingMeasurementsRetry() {
    // Clear existing interval if any
    if (pendingMeasurementsRetryInterval) {
        clearInterval(pendingMeasurementsRetryInterval);
    }

    // Only start if we have pending measurements
    const pendingMeasurementsJson = localStorage.getItem('pendingMeasurements');
    const pendingMeasurements = safeJsonParse(pendingMeasurementsJson, []);

    if (pendingMeasurements.length === 0) {
        return; // No pending measurements
    }

    // Retry every 2.5 seconds
    pendingMeasurementsRetryInterval = setInterval(async () => {
        const pendingJson = localStorage.getItem('pendingMeasurements');
        const pending = safeJsonParse(pendingJson, []);

        if (pending.length === 0) {
            // No more pending measurements, stop retry
            clearInterval(pendingMeasurementsRetryInterval);
            pendingMeasurementsRetryInterval = null;
            return;
        }

        // Try to sync pending measurements
        if (isOnline()) {
            await syncPendingItems();
        }
    }, 2000); // 2 seconds for faster sync
}

// Stop retry mechanism
function stopPendingMeasurementsRetry() {
    if (pendingMeasurementsRetryInterval) {
        clearInterval(pendingMeasurementsRetryInterval);
        pendingMeasurementsRetryInterval = null;
    }
}

// Helper function to get real client UUID by temp ID
async function getClientUUIDByTempID(tempClientId) {
    if (!tempClientId || !isTempId(tempClientId)) {
        return null;
    }

    // First, try to find in cache
    const clients = getCachedClients();
    const tempClient = clients.find(c => c.id === tempClientId);

    if (tempClient) {
        // Check if there's a real client with the same name/phone in cache
        const realClient = clients.find(c =>
            !isTempId(c.id) &&
            c.name === tempClient.name &&
            c.phone === tempClient.phone
        );
        if (realClient) {
            return realClient.id;
        }
    }

    // If not in cache, try to find in Supabase by matching name/phone
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        return null;
    }

    const business = await getBusiness();
    if (!business) {
        return null;
    }

    // Try to find client by name and phone (if we have temp client data)
    if (tempClient) {
        let query = supabase
            .from('clients')
            .select('id')
            .eq('business_id', business.id)
            .eq('name', tempClient.name);

        if (tempClient.phone) {
            query = query.eq('phone', tempClient.phone);
        } else {
            query = query.is('phone', null);
        }

        const { data, error } = await query.limit(1).single();

        if (!error && data) {
            return data.id;
        }
    }

    return null;
}

// Sync pending measurements from localStorage
async function syncPendingItems() {
    try {
        // Retrieve pending measurements from localStorage
        const pendingMeasurementsJson = localStorage.getItem('pendingMeasurements');
        if (!pendingMeasurementsJson) {
            return; // No pending measurements
        }

        const pendingMeasurements = safeJsonParse(pendingMeasurementsJson, []);
        if (!Array.isArray(pendingMeasurements) || pendingMeasurements.length === 0) {
            // Clear empty or invalid data
            localStorage.removeItem('pendingMeasurements');
            return;
        }

        const supabase = await getSupabaseAsync();
        if (!supabase) {
            console.warn('Supabase not available, cannot sync pending measurements');
            return;
        }

        const business = await getBusiness();
        if (!business) {
            console.warn('No business found, cannot sync pending measurements');
            return;
        }

        const syncedMeasurements = [];
        const failedMeasurements = [];

        // Process each measurement
        for (const measurement of pendingMeasurements) {
            try {
                let clientId = measurement.client_id;

                // Check retry count - skip if exceeded max retries
                const retryCount = measurement.retryCount || 0;
                if (retryCount >= MAX_SYNC_RETRIES) {
                    console.warn('Measurement exceeded max retries, skipping:', measurement.tempId || measurement.client_id);
                    continue; // Skip this measurement
                }

                // If client_id starts with 'temp_', replace it with real UUID
                if (isTempId(clientId)) {
                    const realClientId = await getClientUUIDByTempID(clientId);
                    if (!realClientId) {
                        console.warn('Could not resolve temp client ID, will retry:', clientId);
                        // Increment retry count
                        measurement.retryCount = retryCount + 1;
                        failedMeasurements.push(measurement);
                        continue; // Skip this measurement for now, will retry
                    }
                    clientId = realClientId;
                }

                // Verify client exists in Supabase before inserting
                const { data: clientCheck, error: clientError } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('id', clientId)
                    .single();

                if (clientError || !clientCheck) {
                    console.warn('Client not found in Supabase, will retry:', clientId);
                    // Increment retry count
                    measurement.retryCount = retryCount + 1;
                    failedMeasurements.push(measurement);
                    continue; // Skip this measurement for now, will retry
                }

                // Build insert object, only including fields that have values
                const insertData = {
                    business_id: business.id,
                    client_id: clientId
                };

                // Add optional fields only if they have values
                if (measurement.garment_type) insertData.garment_type = measurement.garment_type;
                if (measurement.shoulder) insertData.shoulder = measurement.shoulder || null;
                if (measurement.chest) insertData.chest = measurement.chest || null;
                if (measurement.waist) insertData.waist = measurement.waist || null;
                if (measurement.sleeve) insertData.sleeve = measurement.sleeve || null;
                if (measurement.length) insertData.length = measurement.length || null;
                if (measurement.neck) insertData.neck = measurement.neck || null;
                if (measurement.hip) insertData.hip = measurement.hip || null;
                if (measurement.inseam) insertData.inseam = measurement.inseam || null;
                if (measurement.thigh) insertData.thigh = measurement.thigh || null;
                if (measurement.seat) insertData.seat = measurement.seat || null;
                if (measurement.notes) insertData.notes = measurement.notes;
                if (measurement.custom_fields && Object.keys(measurement.custom_fields).length > 0) {
                    insertData.custom_fields = measurement.custom_fields;
                }

                // Insert the measurement into Supabase
                const { data: newMeasurement, error: insertError } = await supabase
                    .from('measurements')
                    .upsert(insertData)
                    .select()
                    .maybeSingle();

                if (insertError) {
                    console.error('Error inserting measurement:', insertError);
                    console.error('Measurement data:', insertData);
                    // Increment retry count
                    measurement.retryCount = (measurement.retryCount || 0) + 1;
                    failedMeasurements.push(measurement);
                } else if (newMeasurement) {
                    syncedMeasurements.push(measurement);

                    // Update cache with real measurement
                    const realMeasurement = {
                        id: newMeasurement.id,
                        client_id: newMeasurement.client_id,
                        garment_type: newMeasurement.garment_type || null,
                        date_created: newMeasurement.created_at,
                        shoulder: newMeasurement.shoulder || null,
                        chest: newMeasurement.chest || null,
                        waist: newMeasurement.waist || null,
                        sleeve: newMeasurement.sleeve || null,
                        length: newMeasurement.length || null,
                        neck: newMeasurement.neck || null,
                        hip: newMeasurement.hip || null,
                        inseam: newMeasurement.inseam || null,
                        thigh: newMeasurement.thigh || null,
                        seat: newMeasurement.seat || null,
                        notes: newMeasurement.notes || null,
                        customFields: newMeasurement.custom_fields || {}
                    };
                    addMeasurementToCache(realMeasurement);
                }
            } catch (err) {
                console.error('Error processing pending measurement:', err);
                console.error('Measurement:', measurement);
                // Increment retry count on error
                measurement.retryCount = (measurement.retryCount || 0) + 1;
                failedMeasurements.push(measurement);
            }
        }

        // Filter out measurements that exceeded max retries
        const retryableMeasurements = failedMeasurements.filter(m => (m.retryCount || 0) < MAX_SYNC_RETRIES);
        const exceededRetries = failedMeasurements.filter(m => (m.retryCount || 0) >= MAX_SYNC_RETRIES);

        // If all measurements were synced successfully, remove the key
        if (retryableMeasurements.length === 0 && exceededRetries.length === 0) {
            localStorage.removeItem('pendingMeasurements');
            console.log(`Successfully synced ${syncedMeasurements.length} pending measurements`);
            stopPendingMeasurementsRetry();
        } else {
            // Save back only the retryable failed measurements
            if (retryableMeasurements.length > 0) {
                localStorage.setItem('pendingMeasurements', safeJsonStringify(retryableMeasurements));
                console.warn(`Synced ${syncedMeasurements.length} measurements, ${retryableMeasurements.length} failed and will be retried`);
                // Continue retry mechanism
                startPendingMeasurementsRetry();
            } else {
                localStorage.removeItem('pendingMeasurements');
                stopPendingMeasurementsRetry();
            }

            // Only notify user if measurements exceeded retries
            if (exceededRetries.length > 0) {
                showToast(`${exceededRetries.length} measurement(s) failed to sync after multiple attempts. They will be retried later.`, 'warning', 5000);
            }
        }

        // Update UI if measurements were synced
        if (syncedMeasurements.length > 0) {
            const currentScreen = document.querySelector('.screen.active');
            if (currentScreen?.id === 'home-screen') {
                renderRecentMeasurements().catch(err => console.warn('Error rendering measurements:', err));
            }
        }
    } catch (err) {
        console.error('Error in syncPendingItems:', err);
    }
}

// ========== BACKGROUND SYNC FUNCTION ==========
// Process pending sync queue when online
async function processPendingSyncQueue() {
    if (!isOnline()) {
        return; // Don't sync if offline
    }

    const queue = getPendingSyncQueue();
    if (queue.length === 0) {
        // updateSyncStatusIndicator(); // REMOVED - silent sync
        return;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        return; // Supabase not ready
    }

    const business = await getBusiness();
    if (!business) {
        return; // No business found
    }

    // updateSyncStatusIndicator(); // REMOVED - silent sync

    // Process each item in the queue
    for (const item of [...queue]) { // Copy array to avoid modification during iteration
        try {
            // Skip items that have exceeded max retries
            if (item.retryCount >= MAX_SYNC_RETRIES) {
                console.warn('Item exceeded max retries, skipping:', item.id);
                // Remove from queue but keep in localStorage for manual retry
                removeFromPendingSyncQueue(item.id);
                // Only notify user once when max retries is first exceeded
                if (item.retryCount === MAX_SYNC_RETRIES) {
                    showToast('Some items failed to sync after multiple attempts. They will be retried later.', 'warning', 4000);
                }
                continue;
            }

            let success = false;

            if (item.action === 'create_client') {
                const { data: newClient, error } = await supabase
                    .from('clients')
                    .insert([{
                        business_id: item.data.business_id,
                        name: item.data.name,
                        phone: item.data.phone || null,
                        sex: item.data.sex || null
                    }])
                    .select()
                    .single();

                if (!error && newClient) {
                    // Replace temp client with real one
                    const tempId = item.data.tempId;
                    if (tempId) {
                        removeClientFromCache(tempId);
                    }
                    const realClient = {
                        id: newClient.id,
                        name: newClient.name,
                        phone: newClient.phone || '',
                        sex: newClient.sex || '',
                        createdAt: newClient.created_at
                    };
                    addClientToCache(realClient);

                    // Update all pending measurements that reference this temp client_id
                    updatePendingMeasurementsClientId(tempId, newClient.id);

                    success = true;

                    // After client sync, trigger measurement sync
                    setTimeout(() => syncPendingItems(), 100);
                }
            } else if (item.action === 'create_measurement') {
                // Check if client_id is still a temp ID - if so, try to resolve it
                let clientId = item.data.client_id;
                const tempClientId = item.data.tempClientId;

                if (isTempId(clientId)) {
                    // Try to get real client ID from cache
                    const realClientId = getRealClientId(clientId);
                    if (realClientId) {
                        clientId = realClientId;
                        // Update the queue item with real client ID
                        item.data.client_id = realClientId;
                    } else {
                        // Client still not synced - skip this measurement for now
                        console.warn('Skipping measurement sync - client not yet synced:', clientId);
                        continue; // Skip to next item
                    }
                }

                // Verify client exists in Supabase before creating measurement
                const { data: clientCheck, error: clientError } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('id', clientId)
                    .single();

                if (clientError || !clientCheck) {
                    // Client doesn't exist yet - skip this measurement
                    console.warn('Client not found in Supabase, skipping measurement sync:', clientId);
                    continue; // Skip to next item
                }

                // Build insert object, only including fields that have values
                const insertData = {
                    business_id: item.data.business_id,
                    client_id: clientId // Use resolved real client ID
                };

                // Add optional fields only if they have values
                if (item.data.garment_type) insertData.garment_type = item.data.garment_type;
                if (item.data.shoulder) insertData.shoulder = item.data.shoulder || null;
                if (item.data.chest) insertData.chest = item.data.chest || null;
                if (item.data.waist) insertData.waist = item.data.waist || null;
                if (item.data.sleeve) insertData.sleeve = item.data.sleeve || null;
                if (item.data.length) insertData.length = item.data.length || null;
                if (item.data.neck) insertData.neck = item.data.neck || null;
                if (item.data.hip) insertData.hip = item.data.hip || null;
                if (item.data.inseam) insertData.inseam = item.data.inseam || null;
                if (item.data.thigh) insertData.thigh = item.data.thigh || null;
                if (item.data.seat) insertData.seat = item.data.seat || null;
                if (item.data.notes) insertData.notes = item.data.notes;
                if (item.data.custom_fields && Object.keys(item.data.custom_fields).length > 0) {
                    insertData.custom_fields = item.data.custom_fields;
                }

                const { data: newMeasurement, error } = await supabase
                    .from('measurements')
                    .upsert(insertData)
                    .select()
                    .maybeSingle();

                if (!error && newMeasurement) {
                    // Replace temp measurement with real one
                    const tempId = item.data.tempId;
                    if (tempId) {
                        removeMeasurementFromCache(tempId);
                    }
                    const realMeasurement = {
                        id: newMeasurement.id,
                        client_id: newMeasurement.client_id,
                        garment_type: newMeasurement.garment_type || null,
                        date_created: newMeasurement.created_at,
                        shoulder: newMeasurement.shoulder || null,
                        chest: newMeasurement.chest || null,
                        waist: newMeasurement.waist || null,
                        sleeve: newMeasurement.sleeve || null,
                        length: newMeasurement.length || null,
                        neck: newMeasurement.neck || null,
                        hip: newMeasurement.hip || null,
                        inseam: newMeasurement.inseam || null,
                        thigh: newMeasurement.thigh || null,
                        seat: newMeasurement.seat || null,
                        notes: newMeasurement.notes || null,
                        customFields: newMeasurement.custom_fields || {}
                    };
                    addMeasurementToCache(realMeasurement);
                    success = true;
                }
            } else if (item.action === 'update_client') {
                const { data, error } = await supabase
                    .from('clients')
                    .update({
                        name: item.data.name,
                        phone: item.data.phone || null,
                        sex: item.data.sex || null
                    })
                    .eq('id', item.data.clientId)
                    .select()
                    .single();

                if (!error && data) {
                    updateClientInCache(item.data.clientId, {
                        id: data.id,
                        name: data.name,
                        phone: data.phone || '',
                        sex: data.sex || '',
                        createdAt: data.created_at
                    });
                    success = true;
                }
            } else if (item.action === 'update_measurement') {
                const { data, error } = await supabase
                    .from('measurements')
                    .update({
                        garment_type: item.data.garment_type || null,
                        shoulder: item.data.shoulder || null,
                        chest: item.data.chest || null,
                        waist: item.data.waist || null,
                        sleeve: item.data.sleeve || null,
                        length: item.data.length || null,
                        neck: item.data.neck || null,
                        hip: item.data.hip || null,
                        inseam: item.data.inseam || null,
                        thigh: item.data.thigh || null,
                        seat: item.data.seat || null,
                        notes: item.data.notes || null,
                        custom_fields: item.data.custom_fields || {}
                    })
                    .eq('id', item.data.measurementId)
                    .select()
                    .single();

                if (!error && data) {
                    updateMeasurementInCache(item.data.measurementId, {
                        id: data.id,
                        client_id: data.client_id,
                        garment_type: data.garment_type || null,
                        date_created: data.created_at,
                        shoulder: data.shoulder || null,
                        chest: data.chest || null,
                        waist: data.waist || null,
                        sleeve: data.sleeve || null,
                        length: data.length || null,
                        neck: data.neck || null,
                        hip: data.hip || null,
                        inseam: data.inseam || null,
                        thigh: data.thigh || null,
                        seat: data.seat || null,
                        notes: data.notes || null,
                        customFields: data.custom_fields || {}
                    });
                    success = true;
                }
            }

            // Remove from queue if successful
            if (success) {
                removeFromPendingSyncQueue(item.id);
            } else {
                // Increment retry count on failure
                item.retryCount = (item.retryCount || 0) + 1;
                // Update item in queue with new retry count
                const updatedQueue = getPendingSyncQueue();
                const itemIndex = updatedQueue.findIndex(q => q.id === item.id);
                if (itemIndex !== -1) {
                    updatedQueue[itemIndex].retryCount = item.retryCount;
                    savePendingSyncQueue(updatedQueue);
                }
            }
        } catch (err) {
            console.error('Error syncing item:', item.id, err);
            // Increment retry count on error
            item.retryCount = (item.retryCount || 0) + 1;
            // Update item in queue with new retry count
            const updatedQueue = getPendingSyncQueue();
            const itemIndex = updatedQueue.findIndex(q => q.id === item.id);
            if (itemIndex !== -1) {
                updatedQueue[itemIndex].retryCount = item.retryCount;
                savePendingSyncQueue(updatedQueue);
            }
            // Keep item in queue for retry (unless max retries exceeded)
            if (item.retryCount >= MAX_SYNC_RETRIES) {
                removeFromPendingSyncQueue(item.id);
                showToast('Some items failed to sync after multiple attempts. They will be retried later.', 'warning', 5000);
            }
        }
    }

    // Update UI if queue was processed
    const remainingQueue = getPendingSyncQueue();
    if (remainingQueue.length === 0) {
        // Refresh UI to show synced data
        if (typeof renderClientsList === 'function') {
            renderClientsList();
        }
        if (typeof renderRecentMeasurements === 'function') {
            renderRecentMeasurements();
        }
    }

    // updateSyncStatusIndicator(); // REMOVED - silent sync
}

// Initialize offline sync system
// initializeOfflineSync removed - offline sync is disabled

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    // Log the error but don't show to user (many are from extensions)
    // Ignore the "message channel closed" error from browser extensions
    if (event.reason && event.reason.message && event.reason.message.includes('message channel closed')) {
        // This is from a browser extension, ignore it
        event.preventDefault();
        return;
    }
    console.warn('[Unhandled Promise Rejection]', event.reason);
    // Prevent default browser error handling
    event.preventDefault();
});

// Global error handler for general errors
window.addEventListener('error', (event) => {
    // Ignore extension errors
    if (event.filename && (event.filename.includes('extension') || event.filename.includes('chrome-extension'))) {
        return;
    }
    // Only log if it's from our code, not extensions
    if (event.filename && !event.filename.includes('extension')) {
        console.error('[Global Error]', event.error || event.message);
    }
});

// Manual sync function for testing/debugging (expose to window for console access)
async function manualSyncFromSupabase() {
    console.log('[ManualSync] Starting manual sync from Supabase...');
    const user = await getCurrentUser();
    if (!user) {
        console.error('[ManualSync] No user logged in');
        return;
    }

    console.log('[ManualSync] User:', user.id, user.email);

    try {
        // Clear IndexedDB first (optional - comment out if you want to keep local data)
        // This forces a fresh seed from Supabase

        // Get business
        const business = await getBusinessForUser(user.id);
        if (!business) {
            console.error('[ManualSync] No business found for user');
            return;
        }

        console.log('[ManualSync] Business found:', business.name, business.id);

        // Seed from Supabase
        await seedIndexedDBFromSupabase(user.id);

        console.log('[ManualSync] Sync complete - reloading data...');

        // Reload data
        await loadUserData(user.id);

        console.log('[ManualSync] Manual sync complete!');
    } catch (err) {
        console.error('[ManualSync] Error:', err);
    }
}

// Expose to window for easy access from console
if (typeof window !== 'undefined') {
    window.manualSyncFromSupabase = manualSyncFromSupabase;

    // Auto-sync when coming online (handles offline-created items)
    window.addEventListener('online', async () => {
        console.log('[Online] Connectivity restored - checking for unsynced items...');

        // Wait a bit for network to stabilize (Supabase might not be ready immediately)
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // Try to get user from cached session first (faster, doesn't require network)
            let user = null;
            const cachedSession = getCachedSession();
            if (cachedSession && cachedSession.user) {
                user = cachedSession.user;
                console.log('[Online] Using cached user session');
            } else {
                // If no cached session, try to get from Supabase with retries
                let attempts = 0;
                const maxAttempts = 3;

                while (!user && attempts < maxAttempts) {
                    try {
                        user = await getCurrentUser();
                        if (!user) {
                            attempts++;
                            if (attempts < maxAttempts) {
                                console.log(`[Online] User not ready yet, retrying... (${attempts}/${maxAttempts})`);
                                await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff
                            }
                        }
                    } catch (err) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            console.log(`[Online] Error getting user, retrying... (${attempts}/${maxAttempts}):`, err.message);
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
                        } else {
                            console.warn('[Online] Failed to get user after retries, will try again later');
                        }
                    }
                }
            }

            if (!user) {
                console.log('[Online] No user available, skipping sync (will retry on next online event)');
                return;
            }

            // Get business (use cached if available)
            let business = getCachedBusiness();
            if (!business) {
                business = await getBusinessForUser(user.id);
            }

            if (!business || !business.id) {
                console.log('[Online] No business found, skipping sync');
                return;
            }

            // Check for unsynced items
            if (window.indexedDBHelper && window.reconciliation) {
                const unsyncedClients = await window.indexedDBHelper.getUnsyncedClients(user.id);
                const unsyncedMeasurements = await window.indexedDBHelper.getUnsyncedMeasurements(user.id);

                if (unsyncedClients.length > 0 || unsyncedMeasurements.length > 0) {
                    console.log(`[Online] Found ${unsyncedClients.length} unsynced clients and ${unsyncedMeasurements.length} unsynced measurements - syncing...`);
                    // Trigger reconciliation to sync unsynced items
                    const result = await window.reconciliation.reconcileAll(business.id);
                    console.log('[Online] Sync complete:', result);
                } else {
                    console.log('[Online] No unsynced items to sync');
                }
            }
        } catch (err) {
            console.error('[Online] Error syncing on reconnect:', err);
            // Don't throw - this is a background operation
        }
    });

    // ============================================
    // PULL-TO-REFRESH (MOBILE)
    // ============================================
    // Enables a native-feeling "pull down to refresh" on touch devices.
    // When the user pulls down from the top of the scroll, we reload core data.
    (function setupPullToRefresh() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        let touchStartY = 0;
        let isPulling = false;
        let lastDeltaY = 0;
        const THRESHOLD = 60; // pixels to trigger refresh

        // Simple visual indicator at the top
        let indicator = document.getElementById('pull-to-refresh-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pull-to-refresh-indicator';
            indicator.style.position = 'fixed';
            indicator.style.top = '0';
            indicator.style.left = '0';
            indicator.style.right = '0';
            indicator.style.height = '0px';
            indicator.style.display = 'flex';
            indicator.style.alignItems = 'center';
            indicator.style.justifyContent = 'center';
            indicator.style.background = 'var(--bg-primary, #020617)';
            indicator.style.color = 'var(--text-secondary, #9ca3af)';
            indicator.style.fontSize = '12px';
            indicator.style.transition = 'height 0.15s ease, opacity 0.15s ease';
            indicator.style.zIndex = '9998';
            indicator.style.opacity = '0';
            indicator.textContent = 'Release to refresh...';
            document.body.appendChild(indicator);
        }

        function showIndicator(amount) {
            const clamped = Math.min(amount, THRESHOLD * 1.5);
            indicator.style.height = clamped + 'px';
            indicator.style.opacity = clamped > 10 ? '1' : '0';
        }

        function hideIndicator() {
            indicator.style.height = '0px';
            indicator.style.opacity = '0';
        }

        async function performRefresh() {
            try {
                const cachedSession = getCachedSession && getCachedSession();
                const user = cachedSession?.user || (await getCurrentUser());
                if (!user) {
                    hideIndicator();
                    return;
                }

                // Reload core data
                await loadUserData(user.id);

                // Re-render screen-specific data
                const active = document.querySelector('.screen.active');
                const screenId = active?.id;
                if (screenId === 'clients-screen' && typeof renderClientsList === 'function') {
                    await renderClientsList();
                } else if (screenId === 'home-screen' && typeof renderRecentMeasurements === 'function') {
                    await renderRecentMeasurements();
                }

                if (typeof showToast === 'function') {
                    showToast('Data refreshed', 'success', 1500);
                }
            } catch (err) {
                console.warn('[PullToRefresh] Refresh failed:', err);
                if (typeof showToast === 'function') {
                    showToast('Failed to refresh. Please try again.', 'error', 2000);
                }
            } finally {
                hideIndicator();
                isPulling = false;
                lastDeltaY = 0;
            }
        }

        window.addEventListener(
            'touchstart',
            (e) => {
                if (window.scrollY === 0) {
                    touchStartY = e.touches[0].clientY;
                    isPulling = true;
                    lastDeltaY = 0;
                } else {
                    isPulling = false;
                }
            },
            { passive: true }
        );

        window.addEventListener(
            'touchmove',
            (e) => {
                if (!isPulling) return;
                const currentY = e.touches[0].clientY;
                const deltaY = currentY - touchStartY;
                if (deltaY > 0) {
                    lastDeltaY = deltaY;
                    showIndicator(deltaY);
                } else {
                    // User moved up again; cancel
                    hideIndicator();
                    isPulling = false;
                    lastDeltaY = 0;
                }
            },
            { passive: true }
        );

        window.addEventListener(
            'touchend',
            () => {
                if (!isPulling) return;
                if (lastDeltaY >= THRESHOLD) {
                    // Trigger refresh
                    performRefresh();
                } else {
                    hideIndicator();
                    isPulling = false;
                    lastDeltaY = 0;
                }
            },
            { passive: true }
        );
    })();

    // Helper function to fix clients' business_id
    window.fixClientsBusinessId = async function () {
        try {
            const user = await getCurrentUser();
            if (!user) {
                console.error('[fixClientsBusinessId] No user logged in');
                return { error: 'No user logged in' };
            }

            const business = await getBusinessForUser(user.id);
            if (!business || !business.id) {
                console.error('[fixClientsBusinessId] No business found for user');
                return { error: 'No business found for user' };
            }

            console.log('[fixClientsBusinessId] Fixing clients business_id to:', business.id);

            // Get all clients for this user
            const clients = await window.indexedDBHelper.getClientsLocal(user.id);
            let fixed = 0;

            for (const client of clients) {
                if (client.business_id !== business.id) {
                    console.log(`[fixClientsBusinessId] Fixing client ${client.name || client.id}: ${client.business_id} -> ${business.id}`);
                    await window.indexedDBHelper.updateClientLocal(client.local_id, {
                        business_id: business.id
                    }, user.id);
                    fixed++;
                }
            }

            console.log(`[fixClientsBusinessId] Fixed ${fixed} clients' business_id`);
            return { fixed, total: clients.length };
        } catch (err) {
            console.error('[fixClientsBusinessId] Error fixing clients business_id:', err);
            return { error: err.message };
        }
    };
}

// ============================================
// ADMIN AREA FUNCTIONS
// ============================================

// Check if current user is admin
async function isAdmin() {
    try {
        const supabase = getSupabase();
        if (!supabase) return false;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Try to get user profile
        const { data, error } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle(); // Use maybeSingle() instead of single() to handle missing rows gracefully

        // If table doesn't exist or user has no profile, return false
        if (error) {
            // Check if it's a "relation does not exist" error (table not created yet)
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
                console.warn('[Admin] user_profiles table does not exist. Please run admin-migration.sql');
                return false;
            }
            // Check if it's an RLS policy error
            if (error.code === '42501' || error.message?.includes('permission denied')) {
                console.warn('[Admin] Permission denied accessing user_profiles. Check RLS policies.');
                return false;
            }
            // For other errors, log and return false
            console.warn('[Admin] Error checking admin status:', error);
            return false;
        }

        // If no profile exists, user is not admin
        if (!data) return false;

        return data.role === 'admin';
    } catch (err) {
        console.error('[Admin] Error checking admin status:', err);
        return false;
    }
}

// Get all users (admin only)
async function getAllUsers() {
    try {
        const supabase = getSupabase();
        if (!supabase) return [];

        // Get user profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (profilesError) {
            console.error('[Admin] Error fetching user profiles:', profilesError);
            return [];
        }

        if (!profiles || profiles.length === 0) return [];

        // Get user emails from auth (requires service role or admin API)
        // For now, we'll use a workaround by fetching businesses to get user emails
        const { data: businesses } = await supabase
            .from('businesses')
            .select('user_id, email');

        // Create a map of user_id to email from businesses
        const userEmailMap = {};
        if (businesses) {
            businesses.forEach(b => {
                if (b.user_id && b.email) {
                    userEmailMap[b.user_id] = b.email;
                }
            });
        }

        // Transform profiles to include email
        return profiles.map(profile => ({
            id: profile.id,
            email: userEmailMap[profile.id] || 'N/A',
            role: profile.role || 'user',
            created_at: profile.created_at,
            last_sign_in_at: null // Would need admin API to get this
        }));
    } catch (err) {
        console.error('[Admin] Error in getAllUsers:', err);
        return [];
    }
}

// Get all businesses (admin only)
async function getAllBusinesses() {
    try {
        const supabase = getSupabase();
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Admin] Error fetching businesses:', error);
            return [];
        }

        // Get user emails from businesses (business email is often the user email)
        return (data || []).map(business => ({
            id: business.id,
            name: business.name,
            email: business.email,
            phone: business.phone,
            user_id: business.user_id,
            user_email: business.email || 'N/A', // Use business email as proxy for user email
            disabled: business.disabled || false,
            created_at: business.created_at
        }));
    } catch (err) {
        console.error('[Admin] Error in getAllBusinesses:', err);
        return [];
    }
}

// Get all clients (admin only)
async function getAllClients() {
    try {
        const supabase = getSupabase();
        if (!supabase) return [];

        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (clientsError) {
            console.error('[Admin] Error fetching clients:', clientsError);
            return [];
        }

        if (!clients || clients.length === 0) return [];

        // Get business names
        const businessIds = [...new Set(clients.map(c => c.business_id))];
        const { data: businesses } = await supabase
            .from('businesses')
            .select('id, name, user_id')
            .in('id', businessIds);

        const businessMap = {};
        if (businesses) {
            businesses.forEach(b => {
                businessMap[b.id] = b;
            });
        }

        return clients.map(client => ({
            id: client.id,
            name: client.name,
            phone: client.phone,
            sex: client.sex,
            business_id: client.business_id,
            business_name: businessMap[client.business_id]?.name || 'N/A',
            user_id: businessMap[client.business_id]?.user_id || null,
            created_at: client.created_at
        }));
    } catch (err) {
        console.error('[Admin] Error in getAllClients:', err);
        return [];
    }
}

// Get all measurements (admin only)
async function getAllMeasurements() {
    try {
        const supabase = getSupabase();
        if (!supabase) return [];

        const { data: measurements, error: measurementsError } = await supabase
            .from('measurements')
            .select('*')
            .order('created_at', { ascending: false });

        if (measurementsError) {
            console.error('[Admin] Error fetching measurements:', measurementsError);
            return [];
        }

        if (!measurements || measurements.length === 0) return [];

        // Get client and business info
        const clientIds = [...new Set(measurements.map(m => m.client_id))];
        const businessIds = [...new Set(measurements.map(m => m.business_id))];

        const [clientsResult, businessesResult] = await Promise.all([
            supabase.from('clients').select('id, name, business_id').in('id', clientIds),
            supabase.from('businesses').select('id, name, user_id').in('id', businessIds)
        ]);

        const clientMap = {};
        if (clientsResult.data) {
            clientsResult.data.forEach(c => {
                clientMap[c.id] = c;
            });
        }

        const businessMap = {};
        if (businessesResult.data) {
            businessesResult.data.forEach(b => {
                businessMap[b.id] = b;
            });
        }

        return measurements.map(measurement => ({
            id: measurement.id,
            client_id: measurement.client_id,
            client_name: clientMap[measurement.client_id]?.name || 'N/A',
            business_id: measurement.business_id,
            business_name: businessMap[measurement.business_id]?.name || 'N/A',
            user_id: businessMap[measurement.business_id]?.user_id || null,
            garment_type: measurement.garment_type,
            shoulder: measurement.shoulder,
            chest: measurement.chest,
            waist: measurement.waist,
            sleeve: measurement.sleeve,
            length: measurement.length,
            neck: measurement.neck,
            hip: measurement.hip,
            inseam: measurement.inseam,
            thigh: measurement.thigh,
            seat: measurement.seat,
            custom_fields: measurement.custom_fields || {},
            notes: measurement.notes,
            created_at: measurement.created_at
        }));
    } catch (err) {
        console.error('[Admin] Error in getAllMeasurements:', err);
        return [];
    }
}

// Disable/enable user account (admin only)
// Note: This requires Supabase Admin API which needs service role key
// For now, we'll add a disabled field to user_profiles
async function toggleUserStatus(userId, disabled) {
    try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Database connection not available');

        // Update user_profiles with disabled status
        // First, add disabled column if it doesn't exist (handled in migration)
        const { error } = await supabase
            .from('user_profiles')
            .update({ disabled: disabled })
            .eq('id', userId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[Admin] Error toggling user status:', err);
        throw err;
    }
}

// Delete user (admin only)
// Note: This requires Supabase Admin API. For now, we'll just delete from user_profiles
// The actual user deletion should be done via Supabase dashboard or Admin API
async function deleteUser(userId) {
    try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Database connection not available');

        // Delete user profile (cascade will handle related data)
        // Note: Actual auth.users deletion requires Admin API
        const { error } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Show warning that full deletion requires Admin API
        console.warn('[Admin] User profile deleted. Full user deletion from auth.users requires Supabase Admin API.');
        return true;
    } catch (err) {
        console.error('[Admin] Error deleting user:', err);
        throw err;
    }
}

// Disable/enable business (admin only)
async function toggleBusinessStatus(businessId, disabled) {
    try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Database connection not available');

        const { error } = await supabase
            .from('businesses')
            .update({ disabled: disabled })
            .eq('id', businessId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[Admin] Error toggling business status:', err);
        throw err;
    }
}

// Delete business (admin only)
async function deleteBusiness(businessId) {
    try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Database connection not available');

        const { error } = await supabase
            .from('businesses')
            .delete()
            .eq('id', businessId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[Admin] Error deleting business:', err);
        throw err;
    }
}

// Render admin users list
async function renderAdminUsers() {
    const listEl = document.getElementById('admin-users-list');
    const statsEl = document.getElementById('admin-users-stats');
    if (!listEl || !statsEl) return;

    try {
        const users = await getAllUsers();
        statsEl.textContent = `${users.length} users`;

        if (users.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No users found</p>';
            return;
        }

        listEl.innerHTML = users.map(user => `
            <div class="admin-list-item" data-user-id="${user.id}">
                <div class="admin-list-item-header">
                    <div>
                        <h4 class="admin-list-item-title">${escapeHtml(user.email)}</h4>
                        <div class="admin-list-item-meta">
                            Created: ${new Date(user.created_at).toLocaleDateString()}
                            ${user.last_sign_in_at ? ` | Last sign in: ${new Date(user.last_sign_in_at).toLocaleDateString()}` : ''}
                        </div>
                    </div>
                    <span class="admin-list-item-badge ${user.role}">${user.role}</span>
                </div>
                <div class="admin-list-item-actions">
                    <button class="btn btn-secondary" onclick="adminViewUserDetails('${user.id}')">View Details</button>
                    <button class="btn btn-delete" onclick="adminDeleteUser('${user.id}', '${escapeHtml(user.email)}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('[Admin] Error rendering users:', err);
        listEl.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 40px;">Error loading users</p>';
    }
}

// Render admin businesses list
async function renderAdminBusinesses() {
    const listEl = document.getElementById('admin-businesses-list');
    const statsEl = document.getElementById('admin-businesses-stats');
    if (!listEl || !statsEl) return;

    try {
        const businesses = await getAllBusinesses();
        statsEl.textContent = `${businesses.length} businesses`;

        if (businesses.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No businesses found</p>';
            return;
        }

        listEl.innerHTML = businesses.map(business => `
            <div class="admin-list-item" data-business-id="${business.id}">
                <div class="admin-list-item-header">
                    <div>
                        <h4 class="admin-list-item-title">${escapeHtml(business.name)}</h4>
                        <div class="admin-list-item-meta">
                            Owner: ${escapeHtml(business.user_email)} | 
                            Phone: ${escapeHtml(business.phone || 'N/A')} |
                            Created: ${new Date(business.created_at).toLocaleDateString()}
                        </div>
                    </div>
                    <span class="admin-list-item-badge ${business.disabled ? 'disabled' : 'enabled'}">
                        ${business.disabled ? 'Disabled' : 'Active'}
                    </span>
                </div>
                <div class="admin-list-item-actions">
                    <button class="btn btn-secondary" onclick="adminViewBusinessDetails('${business.id}')">View Details</button>
                    <button class="btn btn-secondary" onclick="adminToggleBusiness('${business.id}', ${!business.disabled})">
                        ${business.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button class="btn btn-delete" onclick="adminDeleteBusiness('${business.id}', '${escapeHtml(business.name)}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('[Admin] Error rendering businesses:', err);
        listEl.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 40px;">Error loading businesses</p>';
    }
}

// Render admin clients list
async function renderAdminClients() {
    const listEl = document.getElementById('admin-clients-list');
    const statsEl = document.getElementById('admin-clients-stats');
    if (!listEl || !statsEl) return;

    try {
        const clients = await getAllClients();
        statsEl.textContent = `${clients.length} clients`;

        if (clients.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No clients found</p>';
            return;
        }

        listEl.innerHTML = clients.map(client => `
            <div class="admin-list-item">
                <div class="admin-list-item-header">
                    <div>
                        <h4 class="admin-list-item-title">${escapeHtml(client.name)}</h4>
                        <div class="admin-list-item-meta">
                            Business: ${escapeHtml(client.business_name)} | 
                            Phone: ${escapeHtml(client.phone || 'N/A')} | 
                            Sex: ${escapeHtml(client.sex || 'N/A')} |
                            Created: ${new Date(client.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('[Admin] Error rendering clients:', err);
        listEl.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 40px;">Error loading clients</p>';
    }
}

// Render admin measurements list
async function renderAdminMeasurements() {
    const listEl = document.getElementById('admin-measurements-list');
    const statsEl = document.getElementById('admin-measurements-stats');
    if (!listEl || !statsEl) return;

    try {
        const measurements = await getAllMeasurements();
        statsEl.textContent = `${measurements.length} measurements`;

        if (measurements.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No measurements found</p>';
            return;
        }

        listEl.innerHTML = measurements.map(measurement => `
            <div class="admin-list-item">
                <div class="admin-list-item-header">
                    <div>
                        <h4 class="admin-list-item-title">${escapeHtml(measurement.client_name)} - ${escapeHtml(measurement.garment_type || 'N/A')}</h4>
                        <div class="admin-list-item-meta">
                            Business: ${escapeHtml(measurement.business_name)} | 
                            Created: ${new Date(measurement.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('[Admin] Error rendering measurements:', err);
        listEl.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 40px;">Error loading measurements</p>';
    }
}

// Admin tab switching
function switchAdminTab(tabName) {
    // Hide all tabs and content
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-content').forEach(content => content.classList.remove('active'));

    // Show selected tab and content
    const tabEl = document.getElementById(`admin-${tabName}-tab`);
    const contentEl = document.getElementById(`admin-${tabName}-content`);

    if (tabEl) tabEl.classList.add('active');
    if (contentEl) contentEl.classList.add('active');

    // Load data for the selected tab
    if (tabName === 'users') {
        renderAdminUsers();
    } else if (tabName === 'businesses') {
        renderAdminBusinesses();
    } else if (tabName === 'clients') {
        renderAdminClients();
    } else if (tabName === 'measurements') {
        renderAdminMeasurements();
    }
}

// Admin view user details (make globally accessible)
window.adminViewUserDetails = async function (userId) {
    try {
        const users = await getAllUsers();
        const user = users.find(u => u.id === userId);
        if (!user) {
            alert('User not found');
            return;
        }

        // Get user's businesses
        const businesses = await getAllBusinesses();
        const userBusinesses = businesses.filter(b => b.user_id === userId);

        const modal = document.getElementById('admin-user-details-modal');
        const title = document.getElementById('admin-user-details-title');
        const body = document.getElementById('admin-user-details-body');

        if (!modal || !title || !body) return;

        title.textContent = `User: ${escapeHtml(user.email)}`;
        body.innerHTML = `
            <div class="admin-detail-section">
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Email:</span>
                    <span class="admin-detail-value">${escapeHtml(user.email)}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Role:</span>
                    <span class="admin-detail-value">${escapeHtml(user.role)}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Created:</span>
                    <span class="admin-detail-value">${new Date(user.created_at).toLocaleString()}</span>
                </div>
                ${user.last_sign_in_at ? `
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Last Sign In:</span>
                    <span class="admin-detail-value">${new Date(user.last_sign_in_at).toLocaleString()}</span>
                </div>
                ` : ''}
            </div>
            <div class="admin-detail-section">
                <h4>Businesses (${userBusinesses.length})</h4>
                ${userBusinesses.length > 0 ? userBusinesses.map(b => `
                    <div class="admin-detail-row">
                        <span class="admin-detail-label">${escapeHtml(b.name)}</span>
                        <span class="admin-detail-value">${escapeHtml(b.phone || 'N/A')}</span>
                    </div>
                `).join('') : '<p style="color: var(--text-secondary);">No businesses</p>'}
            </div>
        `;

        modal.style.display = 'flex';
    } catch (err) {
        console.error('[Admin] Error viewing user details:', err);
        alert('Error loading user details');
    }
}

// Admin view business details (make globally accessible)
window.adminViewBusinessDetails = async function (businessId) {
    try {
        const businesses = await getAllBusinesses();
        const business = businesses.find(b => b.id === businessId);
        if (!business) {
            alert('Business not found');
            return;
        }

        // Get business clients and measurements
        const clients = await getAllClients();
        const measurements = await getAllMeasurements();
        const businessClients = clients.filter(c => c.business_id === businessId);
        const businessMeasurements = measurements.filter(m => m.business_id === businessId);

        const modal = document.getElementById('admin-business-details-modal');
        const title = document.getElementById('admin-business-details-title');
        const body = document.getElementById('admin-business-details-body');

        if (!modal || !title || !body) return;

        title.textContent = `Business: ${escapeHtml(business.name)}`;
        body.innerHTML = `
            <div class="admin-detail-section">
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Name:</span>
                    <span class="admin-detail-value">${escapeHtml(business.name)}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Email:</span>
                    <span class="admin-detail-value">${escapeHtml(business.email || 'N/A')}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Phone:</span>
                    <span class="admin-detail-value">${escapeHtml(business.phone || 'N/A')}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Owner:</span>
                    <span class="admin-detail-value">${escapeHtml(business.user_email)}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Status:</span>
                    <span class="admin-detail-value">${business.disabled ? 'Disabled' : 'Active'}</span>
                </div>
                <div class="admin-detail-row">
                    <span class="admin-detail-label">Created:</span>
                    <span class="admin-detail-value">${new Date(business.created_at).toLocaleString()}</span>
                </div>
            </div>
            <div class="admin-detail-section">
                <h4>Clients (${businessClients.length})</h4>
                ${businessClients.length > 0 ? businessClients.slice(0, 10).map(c => `
                    <div class="admin-detail-row">
                        <span class="admin-detail-label">${escapeHtml(c.name)}</span>
                        <span class="admin-detail-value">${escapeHtml(c.phone || 'N/A')}</span>
                    </div>
                `).join('') + (businessClients.length > 10 ? `<p style="color: var(--text-secondary);">... and ${businessClients.length - 10} more</p>` : '') : '<p style="color: var(--text-secondary);">No clients</p>'}
            </div>
            <div class="admin-detail-section">
                <h4>Measurements (${businessMeasurements.length})</h4>
                <p style="color: var(--text-secondary);">${businessMeasurements.length} total measurements</p>
            </div>
        `;

        modal.style.display = 'flex';
    } catch (err) {
        console.error('[Admin] Error viewing business details:', err);
        alert('Error loading business details');
    }
}

// Admin delete user (make globally accessible)
window.adminDeleteUser = async function (userId, userEmail) {
    if (!confirm(`Are you sure you want to delete user "${userEmail}"?\n\nThis will permanently delete:\n- User profile\n- All their businesses\n- All their clients\n- All their measurements\n\nNote: Full user deletion from auth requires Supabase Admin API.\n\nThis action cannot be undone!`)) {
        return;
    }

    try {
        await deleteUser(userId);
        alert('User deleted successfully');
        renderAdminUsers();
    } catch (err) {
        console.error('[Admin] Error deleting user:', err);
        alert('Error deleting user: ' + (err.message || 'Unknown error'));
    }
};

// Admin toggle business (make globally accessible)
window.adminToggleBusiness = async function (businessId, disabled) {
    try {
        await toggleBusinessStatus(businessId, disabled);
        renderAdminBusinesses();
    } catch (err) {
        console.error('[Admin] Error toggling business:', err);
        alert('Error updating business: ' + (err.message || 'Unknown error'));
    }
};

// Admin delete business (make globally accessible)
window.adminDeleteBusiness = async function (businessId, businessName) {
    if (!confirm(`Are you sure you want to delete business "${businessName}"?\n\nThis will permanently delete:\n- The business\n- All clients under this business\n- All measurements under this business\n\nThis action cannot be undone!`)) {
        return;
    }

    try {
        await deleteBusiness(businessId);
        alert('Business deleted successfully');
        renderAdminBusinesses();
    } catch (err) {
        console.error('[Admin] Error deleting business:', err);
        alert('Error deleting business: ' + (err.message || 'Unknown error'));
    }
};

// ========== MEASUREMENT VALIDATION ==========

// Validation logic for measurement fields (allows digits, decimals, and slashes)
function setupMeasurementValidation() {
    const measurementFields = ['shoulder', 'chest', 'waist', 'sleeve', 'length', 'neck', 'hip', 'inseam', 'thigh', 'seat'];
    measurementFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', handleMeasurementInput);
        }
    });

    // Handle initial custom fields if any
    const customInputs = document.querySelectorAll('.custom-field-input');
    customInputs.forEach(input => {
        input.addEventListener('input', handleMeasurementInput);
    });

    // Also handle custom fields (using event delegation on the container for dynamically added fields)
    const customFieldsContainer = document.getElementById('custom-fields-container');
    if (customFieldsContainer) {
        customFieldsContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('custom-field-input')) {
                handleMeasurementInput(e);
            }
        });
    }
}

function handleMeasurementInput(e) {
    const input = e.target;
    const value = input.value;
    // Allow only digits, decimal points, and forward slashes
    const sanitizedValue = value.replace(/[^0-9./]/g, '');
    if (value !== sanitizedValue) {
        input.value = sanitizedValue;
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check admin status and show/hide admin section in settings
async function checkAndShowAdminSection() {
    try {
        const admin = await isAdmin();
        const adminSection = document.getElementById('admin-section');
        if (adminSection) {
            adminSection.style.display = admin ? 'block' : 'none';
        }
    } catch (err) {
        console.error('[Admin] Error checking admin status:', err);
    }
}

// Admin screen access control
async function showAdminScreen() {
    const admin = await isAdmin();
    if (!admin) {
        alert('Access denied. Admin privileges required.');
        // Clear hash and redirect to settings
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        showScreen('settings-screen');
        return;
    }

    // Set hash for /admin route
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/admin');
    showScreen('admin-screen');
    switchAdminTab('users');
}

// Handle URL hash routing for /admin
function handleAdminRoute() {
    const hash = window.location.hash;
    if (hash === '#/admin' || hash === '#admin') {
        showAdminScreen();
    }
}

// Add hash change listener for routing
window.addEventListener('hashchange', () => {
    handleAdminRoute();
});

// Check for admin route on page load
if (window.location.hash === '#/admin' || window.location.hash === '#admin') {
    // Wait for app to initialize, then check admin route
    setTimeout(() => {
        handleAdminRoute();
    }, 1000);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
    });
} else {
    initializeApp();
}

