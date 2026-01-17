# Quick Database Migration Guide

## The Problem
Your database tables don't have the `user_id` column yet. You need to add it.

## Step-by-Step Fix

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

### Step 2: Check Current Schema (Optional - to see what exists)
Run this first to see what columns you currently have:

```sql
-- Check businesses table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'businesses'
ORDER BY ordinal_position;
```

### Step 3: Add user_id Column to Businesses Table
Copy and paste this into the SQL Editor and click **"Run"**:

```sql
-- Add user_id to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
```

### Step 4: Add user_id Column to Clients Table
Run this:

```sql
-- Add user_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
```

### Step 5: Add user_id Column to Measurements Table
Run this:

```sql
-- Add user_id to measurements table
ALTER TABLE measurements 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_measurements_user_id ON measurements(user_id);
```

### Step 6: Verify It Worked
Run this to check:

```sql
-- Should return 3 rows (one for each table)
SELECT 
    'businesses' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'user_id'
    ) as has_user_id
UNION ALL
SELECT 
    'clients' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'user_id'
    ) as has_user_id
UNION ALL
SELECT 
    'measurements' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'measurements' AND column_name = 'user_id'
    ) as has_user_id;
```

All three should return `true` for `has_user_id`.

### Step 7: Set Up Row Level Security (Important for Security)
Run this to ensure users can only see their own data:

```sql
-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;

-- Create new policies for businesses
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

-- Similar for clients
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

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

-- Similar for measurements
DROP POLICY IF EXISTS "Users can view own measurements" ON measurements;
DROP POLICY IF EXISTS "Users can insert own measurements" ON measurements;
DROP POLICY IF EXISTS "Users can update own measurements" ON measurements;
DROP POLICY IF EXISTS "Users can delete own measurements" ON measurements;

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
```

### Step 8: Refresh Your App
After running all the SQL above:
1. Go back to your app
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Try creating a business again

## Troubleshooting

**If you get an error about "column already exists":**
- That's okay! The `IF NOT EXISTS` clause should prevent this, but if it happens, just skip that step.

**If you get an error about permissions:**
- Make sure you're running these as the database owner/admin
- Check that you're in the correct project

**If the app still shows errors:**
- Check the browser console (F12) for the exact error
- Make sure you ran ALL the steps above
- Verify with Step 6 that all columns exist

