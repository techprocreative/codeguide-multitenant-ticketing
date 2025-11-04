-- Multi-tenant ticketing system migration
-- Creates tenant management and tenant-specific tables

-- Create tenants table in public schema
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for tenants table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create policies for tenants table
CREATE POLICY "Service role can manage tenants" ON public.tenants
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can read tenants" ON public.tenants
    FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to create tenant schema and tables
CREATE OR REPLACE FUNCTION public.create_tenant_schema(tenant_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Validate tenant slug
    IF tenant_slug IS NULL OR tenant_slug = '' OR NOT tenant_slug ~ '^[a-z0-9_-]+$' THEN
        RAISE EXCEPTION 'Invalid tenant slug: %', tenant_slug;
    END IF;

    schema_name := 'tenant_' || tenant_slug;

    -- Create schema if it doesn't exist
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- Create events table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.events (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            date TIMESTAMPTZ NOT NULL,
            venue TEXT,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            max_tickets INTEGER,
            sold_tickets INTEGER DEFAULT 0,
            status TEXT DEFAULT ''upcoming'' CHECK (status IN (''upcoming'', ''ongoing'', ''completed'', ''cancelled'')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name);

    -- Create users table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            phone TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name);

    -- Create tickets table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.tickets (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            event_id UUID NOT NULL REFERENCES %I.events(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            qr_code TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT ''valid'' CHECK (status IN (''valid'', ''used'', ''expired'', ''cancelled'')),
            purchased_at TIMESTAMPTZ DEFAULT NOW(),
            used_at TIMESTAMPTZ,
            gate_entry_id UUID,
            payment_id TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name, schema_name);

    -- Create payments table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.payments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            ticket_id UUID NOT NULL REFERENCES %I.tickets(id) ON DELETE CASCADE,
            amount DECIMAL(10,2) NOT NULL,
            method TEXT NOT NULL CHECK (method IN (''cash'', ''card'', ''transfer'', ''tripay'')),
            status TEXT DEFAULT ''pending'' CHECK (status IN (''pending'', ''success'', ''failed'', ''refunded'')),
            gateway_response JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name, schema_name);

    -- Create gate_logs table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.gate_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            ticket_id UUID NOT NULL REFERENCES %I.tickets(id) ON DELETE CASCADE,
            gate_id TEXT NOT NULL,
            scan_result TEXT NOT NULL CHECK (scan_result IN (''success'', ''failed'', ''duplicate'', ''invalid'')),
            scan_time TIMESTAMPTZ DEFAULT NOW(),
            scan_data JSONB,
            error_message TEXT
        )', schema_name, schema_name);

    -- Create indexes for performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.tickets(event_id)', 'idx_tix_event_id', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.tickets(user_id)', 'idx_tix_user_id', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.tickets(qr_code)', 'idx_tix_qr_code', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.tickets(status)', 'idx_tix_status', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.gate_logs(ticket_id)', 'idx_gl_ticket_id', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.gate_logs(scan_time)', 'idx_gl_scan_time', schema_name);

    -- Create function to generate unique QR codes for this tenant
    EXECUTE format('
        CREATE OR REPLACE FUNCTION %I.generate_unique_qr_code()
        RETURNS TEXT
        LANGUAGE plpgsql
        AS $$
        DECLARE
            qr_code TEXT;
            attempts INTEGER := 0;
            max_attempts INTEGER := 10;
        BEGIN
            LOOP
                qr_code := ''TICKET_'' || tenant_slug || ''_'' || upper(substring(encode(gen_random_bytes(16), ''hex''), 1, 16));

                -- Check if this QR code already exists
                PERFORM 1 FROM %I.tickets WHERE qr_code = qr_code;

                IF NOT FOUND THEN
                    EXIT;
                END IF;

                attempts := attempts + 1;
                IF attempts >= max_attempts THEN
                    RAISE EXCEPTION ''Failed to generate unique QR code after % attempts'', max_attempts;
                END IF;
            END LOOP;

            RETURN qr_code;
        END;
        $$', schema_name, schema_name);

    -- Grant necessary permissions
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role', schema_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO service_role', schema_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO service_role', schema_name);

    RETURN TRUE;
END;
$$;

-- Function to drop tenant schema
CREATE OR REPLACE FUNCTION public.drop_tenant_schema(tenant_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'tenant_' || tenant_slug;

    -- Drop schema if it exists
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);

    RETURN TRUE;
END;
$$;

-- Function to check if tenant schema exists
CREATE OR REPLACE FUNCTION public.tenant_schema_exists(tenant_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    schema_name TEXT;
    exists BOOLEAN;
BEGIN
    schema_name := 'tenant_' || tenant_slug;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = schema_name
    ) INTO exists;

    RETURN exists;
END;
$$;

-- Create trigger to update updated_at on tenants
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE
    ON public.tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions on functions to service role
GRANT EXECUTE ON FUNCTION public.create_tenant_schema TO service_role;
GRANT EXECUTE ON FUNCTION public.drop_tenant_schema TO service_role;
GRANT EXECUTE ON FUNCTION public.tenant_schema_exists TO service_role;

-- Insert sample tenant data
INSERT INTO public.tenants (name, slug, domain, status, settings) VALUES
('Demo Events Company', 'demo-events', 'demo-events.ticketing.com', 'active', '{"max_events_per_month": 50, "support_email": "support@demo-events.com"}'),
('Concert Venue LLC', 'concert-venue', 'concert-venue.ticketing.com', 'active', '{"max_events_per_month": 100, "support_email": "tickets@concert-venue.com"}')
ON CONFLICT (slug) DO NOTHING;