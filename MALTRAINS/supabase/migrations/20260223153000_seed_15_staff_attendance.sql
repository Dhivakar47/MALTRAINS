-- Seed 5 additional staff members (EMP011-EMP015) to bring total to 15
INSERT INTO public.staff_members (employee_id, name, role, leave_balance)
VALUES 
    ('EMP011', 'Kavitha Sundaram', 'Train Operator', 16),
    ('EMP012', 'Arjun Reddy', 'Signal Engineer', 20),
    ('EMP013', 'Meena Iyer', 'Station Supervisor', 18),
    ('EMP014', 'Ravi Chandran', 'Electrical Technician', 14),
    ('EMP015', 'Fatima Begum', 'Customer Service', 19)
ON CONFLICT (employee_id) DO UPDATE SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- Seed attendance records for today for ALL 15 members
-- First clear any existing today's records to avoid duplicates
DELETE FROM public.staff_attendance
WHERE created_at::date = CURRENT_DATE;

-- Insert attendance for all 15 members with realistic mixed statuses
INSERT INTO public.staff_attendance (employee_id, staff_name, status, check_in_time, check_out_time, reason, created_at)
VALUES 
    -- Present with check-in and check-out
    ('EMP001', 'Rajesh Kumar',       'present', now() - interval '6 hours',   now() - interval '30 minutes', NULL, now()),
    ('EMP002', 'Priya Menon',        'present', now() - interval '5.5 hours', NULL, NULL, now()),
    ('EMP003', 'Anil Nair',          'present', now() - interval '5 hours',   now() - interval '15 minutes', NULL, now()),
    ('EMP004', 'Deepa Thomas',       'present', now() - interval '4.5 hours', NULL, NULL, now()),
    
    -- Absent with reasons
    ('EMP005', 'Suresh Pillai',      'absent',  NULL, NULL, 'Sick Leave – Fever', now()),
    ('EMP006', 'Lakshmi Devi',       'absent',  NULL, NULL, 'Family Emergency', now()),
    
    -- Present (checked in, still working)
    ('EMP007', 'Mohammed Ali',       'present', now() - interval '4 hours',   NULL, NULL, now()),
    ('EMP008', 'Sanjay Krishnan',    'present', now() - interval '3.5 hours', NULL, NULL, now()),
    ('EMP009', 'Geetha Rajan',       'present', now() - interval '3 hours',   now() - interval '10 minutes', NULL, now()),
    ('EMP010', 'Vinod Sharma',       'present', now() - interval '2.5 hours', NULL, NULL, now()),
    
    -- New members attendance
    ('EMP011', 'Kavitha Sundaram',   'present', now() - interval '5 hours',   NULL, NULL, now()),
    ('EMP012', 'Arjun Reddy',        'present', now() - interval '4 hours',   NULL, NULL, now()),
    ('EMP013', 'Meena Iyer',         'absent',  NULL, NULL, 'Annual Leave', now()),
    ('EMP014', 'Ravi Chandran',      'present', now() - interval '3 hours',   NULL, NULL, now()),
    ('EMP015', 'Fatima Begum',       'present', now() - interval '2 hours',   NULL, NULL, now())
ON CONFLICT DO NOTHING;
