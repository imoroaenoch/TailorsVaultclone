# Admin Area Setup Guide

This guide explains how to set up and use the Admin Area in the Measurement Vault application.

## Overview

The Admin Area provides system administrators with elevated privileges to:
- View and manage all users
- View and manage all businesses
- View all clients and measurements across all businesses
- Disable/enable user accounts and businesses
- Delete users and businesses (with confirmation)

## Setup Instructions

### Step 1: Run Database Migration

Run the SQL migration script in your Supabase SQL Editor:

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `admin-migration.sql`
3. Execute the script

This will:
- Create `user_profiles` table with `role` and `disabled` fields
- Set up RLS policies for admin access
- Create helper functions for admin checks
- Add `disabled` field to `businesses` table

### Step 2: Create an Admin User

To make a user an admin, run this SQL in Supabase SQL Editor:

```sql
-- Replace 'USER_EMAIL_HERE' with the email of the user you want to make admin
UPDATE user_profiles 
SET role = 'admin' 
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE'
);
```

Or if the user profile doesn't exist yet:

```sql
-- Replace 'USER_UUID_HERE' with the UUID of the user
INSERT INTO user_profiles (id, role) 
VALUES ('USER_UUID_HERE', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### Step 3: Verify Admin Access

1. Log in as the admin user
2. Go to Settings (⚙ button)
3. You should see an "Admin" section with an "Admin Dashboard" button
4. Click "Admin Dashboard" to access the admin area

## Accessing the Admin Area

### Method 1: Via Settings
1. Log in as an admin user
2. Click the Settings (⚙) button
3. Scroll to the "Admin" section
4. Click "Admin Dashboard"

### Method 2: Via URL Hash
Navigate to: `#/admin` or `#admin`

**Note:** Non-admin users attempting to access `/admin` will be blocked and redirected to settings.

## Admin Features

### User Management
- **View all users**: See all registered users with their email, role, and creation date
- **View user details**: Click "View Details" to see:
  - User email and role
  - Account creation date
  - Last sign-in time
  - All businesses owned by the user
- **Delete users**: Permanently delete a user account (cascades to businesses, clients, and measurements)

### Business Management
- **View all businesses**: See all businesses with owner information
- **View business details**: Click "View Details" to see:
  - Business information (name, email, phone)
  - Owner email
  - Status (Active/Disabled)
  - Number of clients and measurements
- **Disable/Enable businesses**: Temporarily disable a business without deleting it
- **Delete businesses**: Permanently delete a business (cascades to clients and measurements)

### Client & Measurement Access
- **View all clients**: See all clients across all businesses
- **View all measurements**: See all measurements across all businesses
- **Filter by business**: View which business each client/measurement belongs to

## Security & Permissions

### Row Level Security (RLS)
The admin system uses Supabase RLS policies to:
- Allow admins to bypass normal user restrictions
- Maintain data integrity for non-admin users
- Ensure only admins can access admin functions

### Admin Checks
- Admin status is checked from `user_profiles.role = 'admin'`
- All admin functions verify admin status before execution
- Non-admin users cannot access admin screens or functions

### Data Integrity
- Admin actions respect the existing data hierarchy:
  - Business → Client → Measurement relationships are maintained
  - UUID constraints and foreign keys are preserved
  - Cascade deletes work correctly for admin deletions

## Important Notes

### User Deletion
- Deleting a user via the admin panel deletes the user profile
- Full deletion from `auth.users` requires Supabase Admin API
- For complete user deletion, use Supabase Dashboard or Admin API

### Business Disabling
- Disabled businesses are marked with `disabled = true`
- Disabled businesses are still visible to admins
- Normal users cannot access disabled businesses (enforced by RLS)

### Admin Role Assignment
- Only existing admins or database administrators can assign admin roles
- Admin role is stored in `user_profiles.role`
- Default role for new users is `'user'`

## Troubleshooting

### Admin Section Not Showing
1. Verify the user has `role = 'admin'` in `user_profiles` table
2. Check browser console for errors
3. Ensure `admin-migration.sql` was run successfully

### Cannot Access Admin Dashboard
1. Verify admin status: `SELECT role FROM user_profiles WHERE id = 'YOUR_USER_ID';`
2. Check RLS policies are correctly set up
3. Verify Supabase connection is working

### Admin Functions Not Working
1. Check browser console for errors
2. Verify RLS policies allow admin access
3. Ensure `is_admin()` function exists in database
4. Check that `user_profiles` table exists and has correct structure

## Database Schema

### user_profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### businesses Table (Updated)
- Added `disabled BOOLEAN DEFAULT FALSE` column

## API Functions

### Admin Functions (JavaScript)
- `isAdmin()` - Check if current user is admin
- `getAllUsers()` - Get all users (admin only)
- `getAllBusinesses()` - Get all businesses (admin only)
- `getAllClients()` - Get all clients (admin only)
- `getAllMeasurements()` - Get all measurements (admin only)
- `toggleUserStatus(userId, disabled)` - Disable/enable user
- `deleteUser(userId)` - Delete user
- `toggleBusinessStatus(businessId, disabled)` - Disable/enable business
- `deleteBusiness(businessId)` - Delete business

## Future Enhancements

Potential improvements:
- Admin activity logging
- Bulk operations (delete multiple users/businesses)
- Export data functionality
- User search and filtering
- Business statistics dashboard
- System health monitoring


