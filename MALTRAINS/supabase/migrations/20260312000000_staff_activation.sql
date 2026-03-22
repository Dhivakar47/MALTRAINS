-- Migration: Add Account Activation to Staff Members
-- Description: Supports deactivating staff accounts from Admin Settings.

ALTER TABLE public.staff_members
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing records to be active by default (redundant but safe)
UPDATE public.staff_members SET is_active = TRUE WHERE is_active IS NULL;
