-- Phase 3b of platform monetisation: enforce plan limits at the
-- database level. The TS resolver knows about limits but doesn't
-- gate writes; this migration installs triggers that do.
--
-- The triggers raise "PLAN_LIMIT_EXCEEDED:" exceptions with a clear
-- human-readable message. UI handlers detect the prefix and surface
-- the message + a link to /admin/billing.
--
-- effective_org_limit() mirrors resolveOrgPricing's precedence:
--   1. Active 'limit' override for this key
--   2. Active 'plan' override → that plan's limit
--   3. Live subscription's plan → its limit
--   4. Free plan's limit
-- Returns NULL when the limit is unlimited (jsonb null).

CREATE OR REPLACE FUNCTION effective_org_limit(
  p_org_id UUID,
  p_limit_key TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_override_value JSONB;
  v_override_plan_slug TEXT;
  v_plan_id UUID;
  v_plan_limits JSONB;
  v_status TEXT;
  v_value JSONB;
BEGIN
  -- 1. Limit-kind override on this key (most recent wins).
  SELECT po.value->'value' INTO v_override_value
  FROM pricing_overrides po
  WHERE po.scope_org_id = p_org_id
    AND po.kind = 'limit'
    AND po.value->>'key' = p_limit_key
    AND po.active = TRUE
    AND (po.expires_at IS NULL OR po.expires_at > NOW())
  ORDER BY po.granted_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_override_value IS NULL OR jsonb_typeof(v_override_value) = 'null' THEN
      RETURN NULL; -- unlimited
    END IF;
    IF jsonb_typeof(v_override_value) = 'number' THEN
      RETURN (v_override_value::text)::INTEGER;
    END IF;
    RETURN NULL;
  END IF;

  -- 2. Plan-kind override → use that plan's limits.
  SELECT po.value->>'plan_slug' INTO v_override_plan_slug
  FROM pricing_overrides po
  WHERE po.scope_org_id = p_org_id
    AND po.kind = 'plan'
    AND po.active = TRUE
    AND (po.expires_at IS NULL OR po.expires_at > NOW())
  ORDER BY po.granted_at DESC
  LIMIT 1;

  IF v_override_plan_slug IS NOT NULL THEN
    SELECT id INTO v_plan_id FROM pricing_plans WHERE slug = v_override_plan_slug;
  ELSE
    -- 3. Live subscription, but only if it's in a "live" status.
    SELECT plan_id, status INTO v_plan_id, v_status
    FROM org_subscriptions
    WHERE org_id = p_org_id;

    IF v_status IS NULL OR v_status NOT IN ('free', 'trialing', 'active', 'past_due') THEN
      v_plan_id := NULL;
    END IF;
  END IF;

  -- 4. Plan limits, or 5. Free fallback.
  IF v_plan_id IS NOT NULL THEN
    SELECT limits INTO v_plan_limits FROM pricing_plans WHERE id = v_plan_id;
  ELSE
    SELECT limits INTO v_plan_limits FROM pricing_plans WHERE slug = 'free';
  END IF;

  IF v_plan_limits IS NULL THEN
    RETURN NULL; -- unlimited if catalogue is missing
  END IF;

  v_value := v_plan_limits->p_limit_key;
  IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(v_value) = 'number' THEN
    RETURN (v_value::text)::INTEGER;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER FUNCTION effective_org_limit(UUID, TEXT) OWNER TO postgres;

-- ============================================================
-- briefs.max_active_briefs — counts rows with status='open' per org.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_active_brief_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  -- Only care when the brief is now (or staying) 'open'. A draft
  -- save would short-circuit here, but the schema has no draft —
  -- briefs default to 'open', so every insert is checked.
  IF NEW.status <> 'open' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' THEN
    -- No transition — already counted, nothing to enforce.
    RETURN NEW;
  END IF;

  v_limit := effective_org_limit(NEW.org_id, 'max_active_briefs');
  IF v_limit IS NULL THEN
    RETURN NEW; -- unlimited
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM briefs
  WHERE org_id = NEW.org_id
    AND status = 'open'
    AND id <> NEW.id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'PLAN_LIMIT_EXCEEDED: Your plan allows up to % active brief(s). Upgrade or archive an existing one to publish another.',
      v_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION enforce_active_brief_limit() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_active_brief_limit ON briefs;
CREATE TRIGGER trigger_active_brief_limit
  BEFORE INSERT OR UPDATE ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_brief_limit();

-- ============================================================
-- memberships.max_creators — counts active creator memberships.
-- Fires for invite-code redemption, application approval, and any
-- direct insert.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_creator_count_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  IF NEW.role <> 'creator' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE, skip if the row was already an active creator
  -- membership before. Only enforce on transitions into the counted
  -- state.
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'creator'
     AND OLD.status = 'active'
  THEN
    RETURN NEW;
  END IF;

  v_limit := effective_org_limit(NEW.org_id, 'max_creators');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM memberships
  WHERE org_id = NEW.org_id
    AND role = 'creator'
    AND status = 'active'
    AND id <> NEW.id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'PLAN_LIMIT_EXCEEDED: Your plan allows up to % creator(s). Upgrade your plan to add more, or archive an existing creator first.',
      v_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION enforce_creator_count_limit() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_creator_count_limit ON memberships;
CREATE TRIGGER trigger_creator_count_limit
  BEFORE INSERT OR UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION enforce_creator_count_limit();
