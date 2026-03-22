-- Migration: Create RPC to safely check if email exists in auth.users and get the name 

CREATE OR REPLACE FUNCTION public.get_user_details_by_email(check_email TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id, 
        CAST(au.raw_user_meta_data->>'display_name' AS TEXT) as name
    FROM auth.users au
    WHERE au.email = check_email
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_details_by_email(TEXT) TO authenticated;
