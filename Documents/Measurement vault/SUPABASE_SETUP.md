# Supabase Setup Instructions

## Step 1: Run the Database Schema

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Click "Run" to create the tables

## Step 2: Environment Variables

Create a `.env.local` file in the root directory with:

```
NEXT_PUBLIC_SUPABASE_URL=https://sehettzhmqvwrwczbbsp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlaGV0dHpobXF2d3J3Y3piYnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzQ4MTYsImV4cCI6MjA4MzAxMDgxNn0.j6hPG4wr4zLpnPep4iSU9SkuqDE3kMX7qQSU_y_zw2U
```

## Step 3: Test the Setup

After running the SQL schema and setting up environment variables, restart your Next.js dev server:

```bash
npm run dev
```

Then test creating a business to ensure Supabase connection works.

## Notes

- The `.env.local` file is already in `.gitignore` so your keys won't be committed
- Tables are created without RLS (Row Level Security) for now since we're doing single-user per business
- All existing function signatures will remain the same - only the backend storage changes from localStorage to Supabase

