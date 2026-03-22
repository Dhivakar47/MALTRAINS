-- Force schema cache reload by a dummy change and using notify
ALTER TABLE public.staff_attendance ALTER COLUMN reason SET DATA TYPE TEXT; -- No-op if already text

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
