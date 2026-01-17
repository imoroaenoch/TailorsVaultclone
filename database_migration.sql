-- Migration Script: Add user_id to businesses, clients, and measurements tables
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ============================================
-- STEP 1: Add user_id column to businesses table
-- ============================================
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);

-- ============================================
-- STEP 2: Add user_id column to clients table
-- ============================================
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- ============================================
-- STEP 3: Add user_id column to measurements table
-- ============================================
ALTER TABLE measurements 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_measurements_user_id ON measurements(user_id);

-- ============================================
-- STEP 4: Update Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;

DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

DROP POLICY IF EXISTS "Users can view own measurements" ON measurements;
DROP POLICY IF EXISTS "Users can insert own measurements" ON measurements;
DROP POLICY IF EXISTS "Users can update own measurements" ON measurements;
DROP POLICY IF EXISTS "Users can delete own measurements" ON measurements;

-- Create new RLS policies for businesses
CREATE POLICY "Users can view own businesses"
    ON businesses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own businesses"
    ON businesses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own businesses"
    ON businesses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own businesses"
    ON businesses FOR DELETE
    USING (auth.uid() = user_id);

-- Create new RLS policies for clients
CREATE POLICY "Users can view own clients"
    ON clients FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
    ON clients FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
    ON clients FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
    ON clients FOR DELETE
    USING (auth.uid() = user_id);

-- Create new RLS policies for measurements
CREATE POLICY "Users can view own measurements"
    ON measurements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurements"
    ON measurements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements"
    ON measurements FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurements"
    ON measurements FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Optional - Migrate existing data (if you have any)
-- ============================================
-- If you have existing businesses linked to device_id, you'll need to manually
-- link them to user accounts. This is a one-time migration.
-- 
-- Example (run this for each business you want to migrate):
-- UPDATE businesses 
-- SET user_id = 'USER_UUID_HERE' 
-- WHERE id = 'BUSINESS_ID_HERE';

-- ============================================
-- VERIFICATION: Check that columns were added
-- ============================================
-- Run these to verify:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'businesses' AND column_name = 'user_id';

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'clients' AND column_name = 'user_id';

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'measurements' AND column_name = 'user_id';

