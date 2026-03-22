ALTER TABLE public.fitness_certificates
ADD COLUMN IF NOT EXISTS renewal_number TEXT,
ADD COLUMN IF NOT EXISTS renewal_location TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
