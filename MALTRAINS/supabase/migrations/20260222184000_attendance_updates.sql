-- Create staff_members table to hold master data
CREATE TABLE IF NOT EXISTS public.staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    leave_balance INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on staff_members
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Policies for staff_members
CREATE POLICY "Enable read access for all authenticated users" ON public.staff_members
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable all for admins" ON public.staff_members
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Add foreign key and reason to staff_attendance if not already handled
DO $$ 
BEGIN 
    -- Make check_in_time nullable
    ALTER TABLE public.staff_attendance ALTER COLUMN check_in_time DROP NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_attendance' AND column_name='reason') THEN
        ALTER TABLE public.staff_attendance ADD COLUMN reason TEXT;
    END IF;
    
    -- Ensure employee_id is linked to staff_members
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'staff_attendance' AND constraint_name = 'staff_attendance_employee_id_fkey') THEN
        ALTER TABLE public.staff_attendance 
        ADD CONSTRAINT staff_attendance_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES public.staff_members(employee_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Drop and recreate some policies for attendance to allow updates by staff if needed
-- But generally only admins/supervisors manage this in the plan.

-- Trigger to automatically reduce leave balance when someone is marked absent
CREATE OR REPLACE FUNCTION public.handle_leave_reduction()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'absent' AND (OLD.status IS NULL OR OLD.status != 'absent')) THEN
        UPDATE public.staff_members
        SET leave_balance = leave_balance - 1
        WHERE employee_id = NEW.employee_id;
    ELSIF (NEW.status = 'present' AND OLD.status = 'absent') THEN
        -- Refund leave if marked present by mistake
        UPDATE public.staff_members
        SET leave_balance = leave_balance + 1
        WHERE employee_id = NEW.employee_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_staff_attendance_absent
BEFORE INSERT OR UPDATE ON public.staff_attendance
FOR EACH ROW EXECUTE FUNCTION public.handle_leave_reduction();

-- Seed some initial staff if the table is empty
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

-- Ensure RLS allows inserting attendance for all
CREATE POLICY "Enable insert for all authenticated users" ON public.staff_attendance
    FOR INSERT TO authenticated WITH CHECK (true);
    
CREATE POLICY "Enable update for all authenticated users" ON public.staff_attendance
    FOR UPDATE TO authenticated USING (true);

-- Seed some initial attendance for today
INSERT INTO public.staff_attendance (employee_id, staff_name, status, check_in_time, created_at)
VALUES 
    ('EMP001', 'Rajesh Kumar', 'present', now() - interval '4 hours', now()),
    ('EMP002', 'Priya Menon', 'present', now() - interval '3.5 hours', now()),
    ('EMP003', 'Anil Nair', 'present', now() - interval '3 hours', now()),
    ('EMP004', 'Deepa Thomas', 'present', now() - interval '2.5 hours', now()),
    ('EMP005', 'Suresh Pillai', 'absent', NULL, now()),
    ('EMP006', 'Lakshmi Devi', 'present', now() - interval '2 hours', now()),
    ('EMP007', 'Mohammed Ali', 'present', now() - interval '1.5 hours', now())
ON CONFLICT DO NOTHING;

-- Update absent record with a reason
UPDATE public.staff_attendance 
SET reason = 'Sick Leave'
WHERE employee_id = 'EMP005' AND status = 'absent' AND reason IS NULL;
