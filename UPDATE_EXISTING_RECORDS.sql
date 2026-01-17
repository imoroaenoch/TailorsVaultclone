-- Migration Script: Update existing records with user_id
-- This script updates existing clients and measurements to have user_id
-- It links them to the user_id from their business
-- 
-- IMPORTANT: Run this after running database_migration.sql
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ============================================
-- STEP 1: Update clients with user_id from their business
-- ============================================
UPDATE clients
SET user_id = businesses.user_id
FROM businesses
WHERE clients.business_id = businesses.id
  AND clients.user_id IS NULL
  AND businesses.user_id IS NOT NULL;

-- ============================================
-- STEP 2: Update measurements with user_id from their business
-- ============================================
UPDATE measurements
SET user_id = businesses.user_id
FROM businesses
WHERE measurements.business_id = businesses.id
  AND measurements.user_id IS NULL
  AND businesses.user_id IS NOT NULL;

-- ============================================
-- STEP 3: Verify the updates
-- ============================================
-- Check how many clients still don't have user_id
SELECT 
    COUNT(*) as clients_without_user_id
FROM clients
WHERE user_id IS NULL;

-- Check how many measurements still don't have user_id
SELECT 
    COUNT(*) as measurements_without_user_id
FROM measurements
WHERE user_id IS NULL;

-- Check how many businesses have user_id
SELECT 
    COUNT(*) as businesses_with_user_id
FROM businesses
WHERE user_id IS NOT NULL;

-- ============================================
-- NOTE: If you have businesses without user_id
-- ============================================
-- If you have businesses that don't have user_id set, you'll need to manually link them.
-- First, find the user's ID from auth.users table, then run:
--
-- UPDATE businesses 
-- SET user_id = 'USER_UUID_HERE' 
-- WHERE id = 'BUSINESS_ID_HERE';
--
-- Then re-run this script to update clients and measurements.

