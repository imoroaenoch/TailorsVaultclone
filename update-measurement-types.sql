-- Migration Script: Update measurement field types to TEXT to support slashes and multiple decimals
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Alter columns to TEXT
ALTER TABLE measurements 
  ALTER COLUMN shoulder TYPE TEXT,
  ALTER COLUMN chest TYPE TEXT,
  ALTER COLUMN waist TYPE TEXT,
  ALTER COLUMN sleeve TYPE TEXT,
  ALTER COLUMN length TYPE TEXT,
  ALTER COLUMN neck TYPE TEXT,
  ALTER COLUMN hip TYPE TEXT,
  ALTER COLUMN inseam TYPE TEXT,
  ALTER COLUMN thigh TYPE TEXT,
  ALTER COLUMN seat TYPE TEXT;

-- Verify the changes
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'measurements';
