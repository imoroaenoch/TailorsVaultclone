# Fix 406 Error - RLS Policy Issue

The 406 (Not Acceptable) error when querying businesses suggests that Row Level Security (RLS) policies might be blocking the query, or the policies need to be updated.

## Quick Fix

Run this SQL in your Supabase SQL Editor to fix the RLS policies:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Create new policies that allow users to access their own businesses
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
```

## Alternative: Temporarily Disable RLS (Development Only)

If you want to test without RLS (NOT recommended for production):

```sql
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE measurements DISABLE ROW LEVEL SECURITY;
```

**Warning:** Only do this for development/testing. Always enable RLS in production!

