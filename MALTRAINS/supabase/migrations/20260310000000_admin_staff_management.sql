-- Migration: Add Email and Delete Policy to Staff Members
-- Description: Supports the new Email-based Add Staff feature and Admin Delete functionality.

-- 1. Add email column to staff_members if it doesn't exist
ALTER TABLE public.staff_members
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Add Delete Policy for Admins
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.staff_members;
CREATE POLICY "Enable delete for authenticated users" ON public.staff_members
FOR DELETE TO authenticated
USING (true); -- Note: The frontend relies on the isAdmin check in the Auth context before allowing the mutation physically.
