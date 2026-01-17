-- ============================================
-- DATA INTEGRITY SCHEMA - STRICT ENFORCEMENT
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Drop existing constraints if they exist
-- ============================================
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_unique;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_business_id_id_unique;
ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_business_id_client_id_id_unique;
ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_client_business_check;

-- ============================================
-- STEP 2: Enforce NOT NULL on critical fields
-- ============================================
ALTER TABLE businesses 
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE clients 
    ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE measurements 
    ALTER COLUMN business_id SET NOT NULL,
    ALTER COLUMN client_id SET NOT NULL;

-- ============================================
-- STEP 3: Add UNIQUE constraints (strict identity)
-- ============================================

-- Business: ONE business per user (strict)
ALTER TABLE businesses 
    ADD CONSTRAINT businesses_user_id_unique UNIQUE (user_id);

-- Client: Unique within business scope
ALTER TABLE clients 
    ADD CONSTRAINT clients_business_id_id_unique UNIQUE (business_id, id);

-- Measurement: Unique within business+client scope
ALTER TABLE measurements 
    ADD CONSTRAINT measurements_business_id_client_id_id_unique UNIQUE (business_id, client_id, id);

-- ============================================
-- STEP 4: Add foreign key constraints (cascade deletes)
-- ============================================
ALTER TABLE businesses 
    DROP CONSTRAINT IF EXISTS businesses_user_id_fkey,
    ADD CONSTRAINT businesses_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE clients 
    DROP CONSTRAINT IF EXISTS clients_business_id_fkey,
    ADD CONSTRAINT clients_business_id_fkey 
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE measurements 
    DROP CONSTRAINT IF EXISTS measurements_business_id_fkey,
    ADD CONSTRAINT measurements_business_id_fkey 
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS measurements_client_id_fkey,
    ADD CONSTRAINT measurements_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- ============================================
-- STEP 5: Add check constraint (measurement.business_id === client.business_id)
-- ============================================
-- This ensures measurements cannot reference clients from different businesses
CREATE OR REPLACE FUNCTION check_measurement_client_business_match()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM clients 
        WHERE id = NEW.client_id 
        AND business_id = NEW.business_id
    ) THEN
        RAISE EXCEPTION 'Measurement client_id must belong to the same business_id';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_measurement_client_business ON measurements;
CREATE TRIGGER check_measurement_client_business
    BEFORE INSERT OR UPDATE ON measurements
    FOR EACH ROW
    EXECUTE FUNCTION check_measurement_client_business_match();

-- ============================================
-- STEP 6: Update indexes for strict querying
-- ============================================
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_measurements_business_id ON measurements(business_id);
CREATE INDEX IF NOT EXISTS idx_measurements_client_id ON measurements(client_id);
CREATE INDEX IF NOT EXISTS idx_measurements_business_client ON measurements(business_id, client_id);

-- ============================================
-- STEP 7: Update RLS policies (strict scope)
-- ============================================
-- Clients: Can only access clients from their business
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
CREATE POLICY "Users can view own clients"
    ON clients FOR SELECT
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
CREATE POLICY "Users can insert own clients"
    ON clients FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own clients" ON clients;
CREATE POLICY "Users can update own clients"
    ON clients FOR UPDATE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
CREATE POLICY "Users can delete own clients"
    ON clients FOR DELETE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    );

-- Measurements: Can only access measurements from their business
DROP POLICY IF EXISTS "Users can view own measurements" ON measurements;
CREATE POLICY "Users can view own measurements"
    ON measurements FOR SELECT
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own measurements" ON measurements;
CREATE POLICY "Users can insert own measurements"
    ON measurements FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
        AND client_id IN (
            SELECT id FROM clients WHERE business_id = measurements.business_id
        )
    );

DROP POLICY IF EXISTS "Users can update own measurements" ON measurements;
CREATE POLICY "Users can update own measurements"
    ON measurements FOR UPDATE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
        AND client_id IN (
            SELECT id FROM clients WHERE business_id = measurements.business_id
        )
    );

DROP POLICY IF EXISTS "Users can delete own measurements" ON measurements;
CREATE POLICY "Users can delete own measurements"
    ON measurements FOR DELETE
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify constraints:
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'businesses'::regclass;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'clients'::regclass;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'measurements'::regclass;

