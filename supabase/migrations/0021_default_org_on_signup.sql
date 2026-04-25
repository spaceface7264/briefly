-- Ensure new users get the default org membership and active_org_id set.
-- This covers users who sign up before using an invite code.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_default_org_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles (id, email, name, active_org_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_default_org_id
  );

  -- Create a default membership
  INSERT INTO memberships (user_id, org_id, role, status)
  VALUES (NEW.id, v_default_org_id, 'creator', 'active')
  ON CONFLICT (user_id, org_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Must be owned by postgres so the trigger bypasses RLS
-- (SECURITY DEFINER alone is not enough — RLS still applies unless the owner is a superuser)
ALTER FUNCTION handle_new_user() OWNER TO postgres;
