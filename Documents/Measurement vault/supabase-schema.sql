-- Tailors Vault Database Schema
-- Run this in your Supabase SQL Editor

-- Businesses table (single row per project, but structured as table for future multi-tenancy)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  device_id TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make email column nullable if it exists as NOT NULL
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'email' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE businesses ALTER COLUMN email DROP NOT NULL;
  END IF;
END $$;

-- Add device_id column to existing businesses table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE businesses ADD COLUMN device_id TEXT;
  END IF;
END $$;

-- Create index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_businesses_device_id ON businesses(device_id);

-- Add email verification columns to existing businesses table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE businesses ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'verification_token'
  ) THEN
    ALTER TABLE businesses ADD COLUMN verification_token TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'verification_token_expires_at'
  ) THEN
    ALTER TABLE businesses ADD COLUMN verification_token_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for email lookups (for cross-device sync)
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email) WHERE email IS NOT NULL;

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  sex TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Measurements table
CREATE TABLE IF NOT EXISTS measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  garment_type TEXT,
  sex TEXT,
  -- Standard measurement fields
  shoulder NUMERIC,
  chest NUMERIC,
  waist NUMERIC,
  sleeve NUMERIC,
  length NUMERIC,
  neck NUMERIC,
  hip NUMERIC,
  inseam NUMERIC,
  thigh NUMERIC,
  seat NUMERIC,
  -- Custom fields stored as JSONB
  custom_fields JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_measurements_business_id ON measurements(business_id);
CREATE INDEX IF NOT EXISTS idx_measurements_client_id ON measurements(client_id);

-- Enable Row Level Security (RLS) - disabled for now since we're doing single-user
-- ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

