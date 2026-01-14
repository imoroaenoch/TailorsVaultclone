# Fix Admin 500 Error

If you're getting a 500 Internal Server Error when trying to access the admin area, follow these steps:

## Error: `GET /rest/v1/user_profiles?select=role&id=eq.XXX 500 (Internal Server Error)`

This error typically means one of the following:

### 1. Table Doesn't Exist (Most Common)

The `user_profiles` table hasn't been created yet. **Solution:**

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `admin-migration.sql`
3. Execute the script
4. Refresh your app and try again

### 2. RLS Policy Issue

The Row Level Security policies might be blocking access. **Solution:**

Run this SQL to verify and fix RLS policies:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- If rowsecurity is false, enable it
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- If policies are missing, re-run the admin-migration.sql script
```

### 3. User Profile Doesn't Exist

If the table exists but your user doesn't have a profile, create one:

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID
INSERT INTO user_profiles (id, role)
VALUES ('YOUR_USER_ID', 'user')
ON CONFLICT (id) DO NOTHING;
```

Or create profiles for all existing users:

```sql
-- Create profiles for all existing users
INSERT INTO user_profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

### 4. Foreign Key Constraint Issue

If there's a foreign key constraint problem:

```sql
-- Check foreign key constraints
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'user_profiles';
```

## Quick Fix Script

Run this complete fix script in Supabase SQL Editor:

```sql
-- Step 1: Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create profiles for all existing users
INSERT INTO user_profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Step 3: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create/Update RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled ON user_profiles(disabled);
```

## Verification

After running the fix, verify it works:

1. Check if table exists:
```sql
SELECT * FROM user_profiles LIMIT 1;
```

2. Check if your user has a profile:
```sql
SELECT * FROM user_profiles WHERE id = auth.uid();
```

3. Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

## Still Getting Errors?

If you're still getting 500 errors after following the above steps:

1. **Check Supabase Logs**: Go to Supabase Dashboard → Logs → API Logs to see detailed error messages

2. **Check Browser Console**: Open browser DevTools → Console to see client-side errors

3. **Verify Supabase Connection**: Make sure your Supabase URL and keys are correct in your app configuration

4. **Test Direct Query**: Try querying the table directly in Supabase SQL Editor:
```sql
SELECT * FROM user_profiles WHERE id = 'YOUR_USER_ID';
```

If this query works in SQL Editor but fails in the app, it's likely an RLS policy issue.

## Common Error Codes

- **42P01**: Relation (table) does not exist → Run migration
- **42501**: Permission denied → Check RLS policies
- **23503**: Foreign key violation → Check user exists in auth.users
- **500**: Internal server error → Check Supabase logs for details


