-- ============================================
-- ADMIN AREA MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Create user_profiles table with role field
-- ============================================
-- This table extends auth.users with additional profile information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled ON user_profiles(disabled);

-- Add disabled column if table already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'disabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN disabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile (but not role)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- RLS Policy: Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS Policy: Admins can update all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
CREATE POLICY "Admins can update all profiles"
    ON user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for existing users (if any)
INSERT INTO public.user_profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 2: Add disabled/enabled status to businesses
-- ============================================
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_businesses_disabled ON businesses(disabled);

-- ============================================
-- STEP 3: Update RLS policies to allow admin access
-- ============================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update businesses RLS policies
DROP POLICY IF EXISTS "Admins can view all businesses" ON businesses;
CREATE POLICY "Admins can view all businesses"
    ON businesses FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all businesses" ON businesses;
CREATE POLICY "Admins can update all businesses"
    ON businesses FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete all businesses" ON businesses;
CREATE POLICY "Admins can delete all businesses"
    ON businesses FOR DELETE
    USING (is_admin());

-- Update clients RLS policies
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
CREATE POLICY "Admins can view all clients"
    ON clients FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all clients" ON clients;
CREATE POLICY "Admins can update all clients"
    ON clients FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete all clients" ON clients;
CREATE POLICY "Admins can delete all clients"
    ON clients FOR DELETE
    USING (is_admin());

-- Update measurements RLS policies
DROP POLICY IF EXISTS "Admins can view all measurements" ON measurements;
CREATE POLICY "Admins can view all measurements"
    ON measurements FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all measurements" ON measurements;
CREATE POLICY "Admins can update all measurements"
    ON measurements FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete all measurements" ON measurements;
CREATE POLICY "Admins can delete all measurements"
    ON measurements FOR DELETE
    USING (is_admin());

-- ============================================
-- STEP 4: Create function to set user as admin
-- ============================================
-- To make a user an admin, run:
-- UPDATE user_profiles SET role = 'admin' WHERE id = 'USER_UUID_HERE';
--
-- Or insert if profile doesn't exist:
-- INSERT INTO user_profiles (id, role) VALUES ('USER_UUID_HERE', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Check if user_profiles table exists and has data:
-- SELECT * FROM user_profiles;

-- Check if a specific user is admin:
-- SELECT role FROM user_profiles WHERE id = 'USER_UUID_HERE';

-- List all admins:
-- SELECT u.email, up.role 
-- FROM auth.users u
-- JOIN user_profiles up ON u.id = up.id
-- WHERE up.role = 'admin';

