-- ============================================
-- SYSTEM UPDATES: FIXES, DATASET & ALERTS
-- ============================================

-- 1. Ensure Enums Exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trainset_status') THEN
        CREATE TYPE public.trainset_status AS ENUM ('service_ready', 'standby', 'maintenance', 'ibl_routed', 'out_of_service');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_type') THEN
        CREATE TYPE public.certificate_type AS ENUM ('rolling_stock', 'signalling', 'telecom');
    END IF;
END $$;

-- 2. Ensure Tables Exist
CREATE TABLE IF NOT EXISTS public.trainsets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rake_id TEXT NOT NULL UNIQUE,
    depot_id UUID,
    car_count INTEGER NOT NULL DEFAULT 4,
    total_mileage_km DECIMAL(12, 2) NOT NULL DEFAULT 0,
    avg_daily_km DECIMAL(10, 2) NOT NULL DEFAULT 150.00, -- Default daily run
    current_status trainset_status NOT NULL DEFAULT 'standby',
    current_bay TEXT,
    route TEXT,
    last_service_date DATE,
    next_scheduled_maintenance DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add avg_daily_km if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trainsets' AND column_name='avg_daily_km') THEN
        ALTER TABLE public.trainsets ADD COLUMN avg_daily_km DECIMAL(10, 2) NOT NULL DEFAULT 150.00;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fitness_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    certificate_type certificate_type NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    issuing_authority TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trainset_id, certificate_type)
);

-- Ensure alerts table has related_trainset_id
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alerts' AND column_name='related_trainset_id') THEN
        ALTER TABLE public.alerts ADD COLUMN related_trainset_id UUID REFERENCES public.trainsets(id);
    END IF;
END $$;

-- 3. Create Incidents Table
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type TEXT NOT NULL,
    location TEXT NOT NULL,
    incident_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    phone_number TEXT,
    description TEXT NOT NULL,
    reporter_name TEXT,
    reporter_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for Incidents
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Incidents RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view incidents' AND polrelid = 'public.incidents'::regclass) THEN
        CREATE POLICY "Authenticated users can view incidents" ON public.incidents FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can report incidents' AND polrelid = 'public.incidents'::regclass) THEN
        CREATE POLICY "Authenticated users can report incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- 4. Fix missing check_out_time column in staff_attendance
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_attendance') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_attendance' AND column_name='check_out_time') THEN
            ALTER TABLE public.staff_attendance ADD COLUMN check_out_time TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

-- 5. Seed 15 Trainsets with Avg Daily KM
INSERT INTO public.trainsets (rake_id, car_count, total_mileage_km, avg_daily_km, current_status, last_service_date, next_scheduled_maintenance)
VALUES 
    ('Rake-01', 4, 1250.50, 150.00, 'service_ready', '2026-01-15', '2026-06-15'),
    ('Rake-02', 4, 4890.20, 180.00, 'service_ready', '2026-01-20', '2026-06-20'),
    ('Rake-03', 4, 2100.00, 0.00, 'standby', '2026-02-05', '2026-07-05'),
    ('Rake-04', 4, 5200.00, 140.00, 'service_ready', '2026-01-10', '2026-05-10'),
    ('Rake-05', 4, 3400.75, 120.00, 'maintenance', '2025-12-20', '2026-04-20'),
    ('Rake-06', 4, 150.00, 200.00, 'service_ready', '2026-02-25', '2026-08-25'),
    ('Rake-07', 4, 4100.00, 160.00, 'service_ready', '2026-01-05', '2026-06-05'),
    ('Rake-08', 4, 980.30, 0.00, 'standby', '2026-02-15', '2026-07-15'),
    ('Rake-09', 4, 5500.00, 175.00, 'service_ready', '2025-11-30', '2026-03-30'),
    ('Rake-10', 4, 2800.00, 150.00, 'service_ready', '2026-01-30', '2026-06-30'),
    ('Rake-11', 4, 6100.50, 130.00, 'service_ready', '2025-11-15', '2026-03-15'),
    ('Rake-12', 4, 750.25, 0.00, 'standby', '2026-02-20', '2026-08-20'),
    ('Rake-13', 4, 3800.00, 145.00, 'service_ready', '2026-01-12', '2026-06-12'),
    ('Rake-14', 4, 4950.00, 155.00, 'service_ready', '2026-01-18', '2026-06-18'),
    ('Rake-15', 4, 1200.40, 165.00, 'service_ready', '2026-02-01', '2026-07-01')
ON CONFLICT (rake_id) DO UPDATE SET 
    total_mileage_km = EXCLUDED.total_mileage_km,
    avg_daily_km = EXCLUDED.avg_daily_km,
    current_status = EXCLUDED.current_status,
    next_scheduled_maintenance = EXCLUDED.next_scheduled_maintenance;

-- 6. Seed Fitness Certificates
INSERT INTO public.fitness_certificates (trainset_id, certificate_type, issue_date, expiry_date, issuing_authority)
SELECT 
    id, 
    'rolling_stock', 
    CURRENT_DATE - interval '6 months', 
    CASE 
        WHEN rake_id IN ('Rake-04', 'Rake-09', 'Rake-11') THEN CURRENT_DATE - interval '2 days' -- Expired
        WHEN rake_id IN ('Rake-02', 'Rake-14') THEN CURRENT_DATE + interval '5 days' -- Near Expiry
        ELSE CURRENT_DATE + interval '6 months' -- Valid
    END,
    'Metro Safety Board'
FROM public.trainsets
ON CONFLICT (trainset_id, certificate_type) DO UPDATE SET 
    expiry_date = EXCLUDED.expiry_date;

-- 7. Seed Sample Incidents
INSERT INTO public.incidents (incident_type, location, incident_date, description, reporter_name, reporter_email)
VALUES 
    ('medical_emergency', 'MG Road Station, Platform 1', now() - interval '2 days', 'Passenger fainted on the platform. First aid administered.', 'John Doe', 'john@example.com'),
    ('safety_hazard', 'Between Sector 4 and 5', now() - interval '1 day', 'Loose cables spotted near the track. Required technician attention.', 'Jane Smith', 'jane@example.com'),
    ('other', 'Aluva Depot', now() - interval '5 hours', 'Vandalism (graffiti) on Rake-05 side panel.', 'System Bot', 'system@maltrains.com');

-- 8. AUTOMATION: Daily Mileage Increment
CREATE OR REPLACE FUNCTION public.apply_daily_mileage_increment()
RETURNS void AS $$
BEGIN
    UPDATE public.trainsets
    SET total_mileage_km = total_mileage_km + avg_daily_km
    WHERE current_status = 'service_ready';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Maintenance Alert Function & Trigger
CREATE OR REPLACE FUNCTION public.check_train_mileage_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Threshold: 5000 km
    IF NEW.total_mileage_km >= 5000 AND (OLD.total_mileage_km < 5000 OR OLD.total_mileage_km IS NULL) THEN
        INSERT INTO public.alerts (alert_type, severity, title, message, related_trainset_id)
        VALUES (
            'Maintenance',
            'high',
            'Maintenance Required: ' || NEW.rake_id,
            'Train ' || NEW.rake_id || ' has exceeded the 5000km mileage threshold. Total Mileage: ' || NEW.total_mileage_km || ' km.',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_mileage ON public.trainsets;
CREATE TRIGGER tr_check_mileage
AFTER UPDATE OF total_mileage_km ON public.trainsets
FOR EACH ROW
EXECUTE FUNCTION public.check_train_mileage_alerts();

-- 10. Force Reload Schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
