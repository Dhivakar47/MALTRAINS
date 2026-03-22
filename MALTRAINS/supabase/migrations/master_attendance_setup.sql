-- ==========================================
-- MASTER ATTENDANCE SETUP SCRIPT
-- ==========================================

-- 1. Create staff_members table
CREATE TABLE IF NOT EXISTS public.staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    leave_balance INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add secret key columns to staff_members
ALTER TABLE public.staff_members 
ADD COLUMN IF NOT EXISTS attendance_key TEXT,
ADD COLUMN IF NOT EXISTS key_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS key_date DATE DEFAULT CURRENT_DATE;

-- 3. Configure staff_attendance table
DO $$ 
BEGIN 
    -- Make check_in_time nullable (for absent staff)
    ALTER TABLE public.staff_attendance ALTER COLUMN check_in_time DROP NOT NULL;

    -- Add reason column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_attendance' AND column_name='reason') THEN
        ALTER TABLE public.staff_attendance ADD COLUMN reason TEXT;
    END IF;
    
    -- Ensure employee_id foreign key link
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendance_employee_id_fkey') THEN
        ALTER TABLE public.staff_attendance 
        ADD CONSTRAINT staff_attendance_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES public.staff_members(employee_id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create Utility Functions
-- Random Key Generator
CREATE OR REPLACE FUNCTION public.generate_random_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Daily Key Generator (RPC)
CREATE OR REPLACE FUNCTION public.generate_daily_keys()
RETURNS VOID AS $$
BEGIN
  UPDATE public.staff_members
  SET 
    attendance_key = public.generate_random_key(),
    key_used = FALSE,
    key_date = CURRENT_DATE
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Leave Reduction Logic
CREATE OR REPLACE FUNCTION public.handle_leave_reduction()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'absent' AND (OLD.status IS NULL OR OLD.status != 'absent')) THEN
        UPDATE public.staff_members
        SET leave_balance = leave_balance - 1
        WHERE employee_id = NEW.employee_id;
    ELSIF (NEW.status = 'present' AND OLD.status = 'absent') THEN
        UPDATE public.staff_members
        SET leave_balance = leave_balance + 1
        WHERE employee_id = NEW.employee_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create Triggers
DROP TRIGGER IF EXISTS on_staff_attendance_absent ON public.staff_attendance;
CREATE TRIGGER on_staff_attendance_absent
BEFORE INSERT OR UPDATE ON public.staff_attendance
FOR EACH ROW EXECUTE FUNCTION public.handle_leave_reduction();

-- 6. Permissions & RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- Staff Members Policies
DROP POLICY IF EXISTS "Enable read for all" ON public.staff_members;
CREATE POLICY "Enable read for all" ON public.staff_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable update for all" ON public.staff_members;
CREATE POLICY "Enable update for all" ON public.staff_members FOR UPDATE TO authenticated USING (true);

-- Staff Attendance Policies
DROP POLICY IF EXISTS "Enable select for all" ON public.staff_attendance;
CREATE POLICY "Enable select for all" ON public.staff_attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for all" ON public.staff_attendance;
CREATE POLICY "Enable insert for all" ON public.staff_attendance FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all" ON public.staff_attendance;
CREATE POLICY "Enable update for all" ON public.staff_attendance FOR UPDATE TO authenticated USING (true);

-- Functions Permissions
GRANT EXECUTE ON FUNCTION public.generate_daily_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_random_key() TO authenticated;

-- 7. Initial Seed Data (10 staff)
INSERT INTO public.staff_members (employee_id, name, role, leave_balance)
VALUES 
    ('EMP001', 'Rajesh Kumar', 'Train Operator', 18),
    ('EMP002', 'Priya Menon', 'Station Manager', 20),
    ('EMP003', 'Anil Nair', 'Maintenance Engineer', 15),
    ('EMP004', 'Deepa Thomas', 'Safety Officer', 20),
    ('EMP005', 'Suresh Pillai', 'Train Operator', 12),
    ('EMP006', 'Lakshmi Devi', 'Ticketing Staff', 19),
    ('EMP007', 'Mohammed Ali', 'Security Guard', 20),
    ('EMP008', 'Sanjay Krishnan', 'Control Room Operator', 17),
    ('EMP009', 'Geetha Rajan', 'Customer Service', 14),
    ('EMP010', 'Vinod Sharma', 'Maintenance Technician', 20)
ON CONFLICT (employee_id) DO UPDATE SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- 8. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
