-- ========================================================
-- MASTER ALERTS SETUP & SAMPLE DATA
-- ========================================================
-- This script creates the alerts table (if missing) and adds sample data.

-- 1. Create ALERTS Table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- 3. Add Basic RLS Policies (Safe approach)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view alerts' AND polrelid = 'public.alerts'::regclass) THEN
        CREATE POLICY "Authenticated users can view alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'System can manage alerts' AND polrelid = 'public.alerts'::regclass) THEN
        CREATE POLICY "System can manage alerts" ON public.alerts FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- 4. INSERT SAMPLE DATASET
INSERT INTO public.alerts (alert_type, severity, title, message, created_at)
VALUES 
    (
        'Maintenance', 
        'warning', 
        'Low Brake Fluid Detected', 
        'Trainset TS-104 reports low brake fluid levels in the rear cabin. Scheduled for immediate inspection.',
        now() - interval '2 hours'
    ),
    (
        'Operations', 
        'error', 
        'Signal Failure - Sector 5', 
        'Intermittent signal failure detected between Sector 5 and Sector 6. Caution advised.',
        now() - interval '45 minutes'
    ),
    (
        'System', 
        'info', 
        'Weekly Maintenance Schedule', 
        'The maintenance schedule for the week starting Feb 24th has been published. Please review your assignments.',
        now() - interval '5 hours'
    ),
    (
        'Safety', 
        'success', 
        'Track Inspection Completed', 
        'Routine track inspection for the Blue Line was completed successfully. No major defects found.',
        now() - interval '1 hour'
    ),
    (
        'Operations', 
        'info', 
        'Staff Training Session', 
        'A mandatory familiarization session for the new AI Dispatcher will be held at 2:00 PM.',
        now() - interval '10 minutes'
    );
