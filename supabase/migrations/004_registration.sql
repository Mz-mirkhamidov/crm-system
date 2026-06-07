-- Add status field to operators
ALTER TABLE operators ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'blocked'));

-- Update check_login to use status
CREATE OR REPLACE FUNCTION check_login(p_phone TEXT, p_password_hash TEXT)
RETURNS JSON AS $$
DECLARE op RECORD;
BEGIN
  SELECT id, name, phone, role, status INTO op FROM operators
  WHERE phone = p_phone AND password = p_password_hash
  LIMIT 1;
  
  IF op.id IS NULL THEN RETURN json_build_object('success', false, 'reason', 'not_found'); END IF;
  IF op.status = 'pending' THEN RETURN json_build_object('success', false, 'reason', 'pending'); END IF;
  IF op.status = 'blocked' THEN RETURN json_build_object('success', false, 'reason', 'blocked'); END IF;
  
  RETURN json_build_object('success', true, 'id', op.id, 'name', op.name, 'phone', op.phone, 'role', op.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Self-registration function (always creates pending)
CREATE OR REPLACE FUNCTION register_operator(p_phone TEXT, p_name TEXT, p_password_hash TEXT)
RETURNS JSON AS $$
DECLARE new_id UUID;
BEGIN
  -- Check if phone already exists
  IF EXISTS (SELECT 1 FROM operators WHERE phone = p_phone) THEN
    RETURN json_build_object('success', false, 'reason', 'exists');
  END IF;
  
  INSERT INTO operators (phone, name, password, role, status)
  VALUES (p_phone, p_name, p_password_hash, 'operator', 'pending')
  RETURNING id INTO new_id;
  
  RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION register_operator TO anon;
