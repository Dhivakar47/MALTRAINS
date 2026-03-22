
-- Update the handle_new_user_role function to check admin_registrations table
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_to_assign public.app_role;
  is_admin_registered BOOLEAN;
BEGIN
  -- 1. Check if email is in admin_registrations table (approved)
  -- NEW.email is available for auth.users
  SELECT EXISTS (
    SELECT 1 FROM public.admin_registrations 
    WHERE email = NEW.email 
      AND (status = 'approved' OR status IS NULL)
  ) INTO is_admin_registered;

  IF is_admin_registered THEN
    role_to_assign := 'admin';
  -- 2. Fallback to requested_role from metadata if it exists
  ELSIF (NEW.raw_user_meta_data->>'requested_role') IS NOT NULL THEN
    BEGIN
      role_to_assign := (NEW.raw_user_meta_data->>'requested_role')::public.app_role;
    EXCEPTION WHEN OTHERS THEN
      role_to_assign := 'user';
    END;
  ELSE
    role_to_assign := 'user';
  END IF;

  -- Default to 'user' if role_to_assign is still null
  IF role_to_assign IS NULL THEN
    role_to_assign := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, role_to_assign)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;
