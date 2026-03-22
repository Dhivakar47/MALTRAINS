-- Add secret key columns to staff_members
ALTER TABLE public.staff_members 
ADD COLUMN IF NOT EXISTS attendance_key TEXT,
ADD COLUMN IF NOT EXISTS key_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS key_date DATE DEFAULT CURRENT_DATE;

-- Create function to generate a random 6-character alphanumeric key
CREATE OR REPLACE FUNCTION public.generate_random_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluded ambiguous chars like 0, O, 1, I, L
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Create RPC function for admins to generate daily keys
CREATE OR REPLACE FUNCTION public.generate_daily_keys()
RETURNS VOID AS $$
BEGIN
  -- Logic: If it's a new day or keys haven't been generated for today
  -- For this implementation, we'll allow regeneraton if requested.
  UPDATE public.staff_members
  SET 
    attendance_key = public.generate_random_key(),
    key_used = FALSE,
    key_date = CURRENT_DATE
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.generate_daily_keys() TO authenticated;
