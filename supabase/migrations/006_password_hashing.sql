-- =============================================
-- 006: Strong password hashing (Task 6.1)
-- =============================================
-- Replaces the fast, single-static-salt SHA-256 ('crm_salt_2026') scheme with a slow,
-- per-user-salted bcrypt scheme computed SERVER-SIDE via pgcrypto. The RPCs now accept the
-- RAW password over the server (TLS) boundary instead of a client-computed hash.
--
-- BACKWARD COMPATIBILITY (important):
--   The seeded default admins from 003_multiuser.sql were stored as legacy SHA-256 hashes
--   and their PLAINTEXT passwords are unknown, so we cannot re-seed them as bcrypt up front.
--   Instead, check_login tolerates BOTH formats: if the stored hash looks like bcrypt
--   ('$2...') it is verified with crypt(); otherwise it is verified against the legacy
--   SHA-256(password || 'crm_salt_2026') and, on a successful match, the row is transparently
--   RE-HASHED to bcrypt. This means existing users (including the seeded admins) keep working
--   and are auto-upgraded to bcrypt on their next successful login. We do NOT delete the
--   seeded admin rows.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- The operators.password column now holds a bcrypt hash (per-user salt embedded). Legacy
-- SHA-256(password || 'crm_salt_2026') hashes are still tolerated until the owner's next
-- successful login, at which point check_login transparently re-hashes them to bcrypt.
COMMENT ON COLUMN operators.password IS
  'bcrypt hash via pgcrypto crypt(password, gen_salt(''bf'',12)); legacy SHA-256(password+''crm_salt_2026'') tolerated until next successful login (auto-upgraded).';

-- The hashed-password argument is replaced by a raw-password argument, which Postgres
-- cannot rename with a plain CREATE OR REPLACE, so drop the old signatures first, then
-- recreate.
DROP FUNCTION IF EXISTS check_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS register_operator(TEXT, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- register_operator: now accepts the RAW password and stores a bcrypt hash with a
-- unique per-user salt. Same JSON shape/reasons as 004 (exists / success).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_operator(p_phone TEXT, p_name TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE new_id UUID;
BEGIN
  -- Check if phone already exists
  IF EXISTS (SELECT 1 FROM operators WHERE phone = p_phone) THEN
    RETURN json_build_object('success', false, 'reason', 'exists');
  END IF;

  INSERT INTO operators (phone, name, password, role, status)
  VALUES (p_phone, p_name, crypt(p_password, gen_salt('bf', 12)), 'operator', 'pending')
  RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION register_operator TO anon;

-- ---------------------------------------------------------------------------
-- check_login: now accepts the RAW password and verifies it server-side, with
-- backward-compatible support for legacy SHA-256 hashes (auto-upgraded to bcrypt on
-- success). Preserves the EXACT reasons from 004: not_found / pending / blocked / success.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_login(p_phone TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
  op      RECORD;
  v_valid BOOLEAN := false;
BEGIN
  SELECT id, name, phone, role, status, password INTO op
  FROM operators
  WHERE phone = p_phone
  LIMIT 1;

  -- Unknown phone OR (below) a wrong password both surface as 'not_found', matching the
  -- 004 behavior where a non-matching password produced no row.
  IF op.id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF op.password LIKE '$2%' THEN
    -- Modern bcrypt hash: crypt() re-derives using the salt embedded in the stored hash.
    v_valid := (op.password = crypt(p_password, op.password));
  ELSE
    -- Legacy SHA-256(password || 'crm_salt_2026') hash (incl. the seeded admins).
    v_valid := (op.password = encode(digest(p_password || 'crm_salt_2026', 'sha256'), 'hex'));
    IF v_valid THEN
      -- Transparently retire the legacy hash: upgrade to bcrypt on this successful login.
      UPDATE operators
      SET password = crypt(p_password, gen_salt('bf', 12))
      WHERE id = op.id;
    END IF;
  END IF;

  IF NOT v_valid THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF op.status = 'pending' THEN RETURN json_build_object('success', false, 'reason', 'pending'); END IF;
  IF op.status = 'blocked' THEN RETURN json_build_object('success', false, 'reason', 'blocked'); END IF;

  RETURN json_build_object('success', true, 'id', op.id, 'name', op.name, 'phone', op.phone, 'role', op.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION check_login TO anon;

-- ---------------------------------------------------------------------------
-- admin_create_operator: server-side creation of an ACTIVE operator/admin by an admin.
-- Replaces the previous client-side SHA-256 hashing path in app/admin/operators/page.tsx
-- so NO password is ever hashed in the browser. Stores a bcrypt hash with a per-user salt.
-- (Authorization is enforced in the Node route handler via verifySession before this RPC
-- is called.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_create_operator(
  p_phone TEXT,
  p_name TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'operator'
)
RETURNS JSON AS $$
DECLARE new_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM operators WHERE phone = p_phone) THEN
    RETURN json_build_object('success', false, 'reason', 'exists');
  END IF;

  INSERT INTO operators (phone, name, password, role, is_active, status)
  VALUES (
    p_phone,
    p_name,
    crypt(p_password, gen_salt('bf', 12)),
    CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'operator' END,
    true,
    'active'
  )
  RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION admin_create_operator TO anon;
