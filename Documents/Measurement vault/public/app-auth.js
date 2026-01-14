// ========== STANDARD EMAIL/PASSWORD AUTHENTICATION ==========
// This file contains the new authentication system
// All data is linked to auth.user.id (user_id)

// Get Supabase client (async)
async function getSupabaseAsync() {
    if (typeof window !== 'undefined' && window.supabaseClient) {
        return window.supabaseClient;
    }
    
    // Wait for Supabase to initialize (max 5 seconds)
    let attempts = 0;
    while (attempts < 50 && (!window.supabaseClient)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    return window.supabaseClient || null;
}

// Get current authenticated user
async function getCurrentUser() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return null;
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
}

// Sign up with email and password
async function signUp(email, password) {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        throw new Error('Database connection not available');
    }
    
    // Validate password
    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
    }
    
    const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
    });
    
    if (error) {
        throw error;
    }
    
    return data;
}

// Sign in with email and password
async function signIn(email, password) {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        throw new Error('Database connection not available');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
    });
    
    if (error) {
        throw error;
    }
    
    return data;
}

// Sign out
async function signOut() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;
    
    await supabase.auth.signOut();
    
    // Clear all local data
    localStorage.clear();
    
    // Show login screen
    showScreen('login-screen');
}

// Check if user is authenticated
async function isAuthenticated() {
    const user = await getCurrentUser();
    return user !== null;
}

// Get business for current user (one business per user)
async function getBusinessForUser(userId) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();
    
    if (error || !data) return null;
    
    return {
        id: data.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        createdAt: data.created_at
    };
}

// Create business for current user (one business per user)
async function createBusinessForUser(userId, name, email, phone) {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        throw new Error('Database connection not available');
    }
    
    // Check if business already exists for this user
    const existing = await getBusinessForUser(userId);
    if (existing) {
        throw new Error('You already have a business. Only one business per account is allowed.');
    }
    
    const { data, error } = await supabase
        .from('businesses')
        .insert([{
            user_id: userId,
            name: name.trim(),
            email: email ? email.trim().toLowerCase() : null,
            phone: phone.trim()
        }])
        .select()
        .single();
    
    if (error) {
        throw error;
    }
    
    return {
        id: data.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        createdAt: data.created_at
    };
}

// Update business for current user
async function updateBusinessForUser(userId, businessId, name, email, phone) {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
        throw new Error('Database connection not available');
    }
    
    // Verify business belongs to user
    const business = await getBusinessForUser(userId);
    if (!business || business.id !== businessId) {
        throw new Error('Business not found or access denied');
    }
    
    const { data, error } = await supabase
        .from('businesses')
        .update({
            name: name.trim(),
            email: email ? email.trim().toLowerCase() : null,
            phone: phone.trim()
        })
        .eq('id', businessId)
        .eq('user_id', userId)
        .select()
        .single();
    
    if (error) {
        throw error;
    }
    
    return {
        id: data.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        createdAt: data.created_at
    };
}

// Get clients for current user
async function getClientsForUser(userId) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    
    return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        sex: c.sex || '',
        createdAt: c.created_at
    }));
}

// Get measurements for current user
async function getMeasurementsForUser(userId) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching measurements:', error);
        return [];
    }
    
    return (data || []).map(m => ({
        id: m.id,
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
        customFields: m.custom_fields || {}
    }));
}

