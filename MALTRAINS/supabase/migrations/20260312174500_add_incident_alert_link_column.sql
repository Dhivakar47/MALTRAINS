-- Add related_incident_id to alerts table
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS related_incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
