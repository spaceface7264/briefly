-- Pricing v2 follow-up: RPCs for atomic brief-publish counter
-- mutations.
--
-- 0044 added briefs_published_this_period + period_anchor on
-- org_subscriptions. The publish flow needs to (a) lazily reset the
-- counter when period_anchor has expired and (b) increment it
-- atomically so concurrent publishes don't both write 1 over the
-- old value.
--
-- Both helpers are SECURITY DEFINER + owner=postgres so they bypass
-- the RLS on org_subscriptions (members can SELECT but only platform
-- admins can write — these RPCs are the safe write path for app
-- code, called from server actions that already gated by org admin).

-- ============================================================
-- commit_brief_publish — lazily reset the period if needed and
-- increment the counter by 1 in one atomic UPDATE. Returns the new
-- count and the (possibly bumped) period anchor.
-- ============================================================
CREATE OR REPLACE FUNCTION commit_brief_publish(p_org_id UUID)
RETURNS TABLE(new_count INTEGER, period_anchor TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  UPDATE org_subscriptions
  SET
    briefs_published_this_period =
      CASE
        WHEN org_subscriptions.period_anchor + INTERVAL '1 month' < NOW()
          THEN 1
        ELSE org_subscriptions.briefs_published_this_period + 1
      END,
    period_anchor =
      CASE
        WHEN org_subscriptions.period_anchor + INTERVAL '1 month' < NOW()
          THEN NOW()
        ELSE org_subscriptions.period_anchor
      END
  WHERE org_subscriptions.org_id = p_org_id
  RETURNING
    org_subscriptions.briefs_published_this_period AS new_count,
    org_subscriptions.period_anchor AS period_anchor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION commit_brief_publish(UUID) OWNER TO postgres;

-- ============================================================
-- decrement_brief_publish — compensating rollback when a publish
-- step after the increment fails. Clamps at zero so repeated calls
-- don't underflow.
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_brief_publish(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE org_subscriptions
  SET briefs_published_this_period = GREATEST(0, briefs_published_this_period - 1)
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION decrement_brief_publish(UUID) OWNER TO postgres;

-- ============================================================
-- reset_brief_publish_period — called from the Stripe webhook on
-- invoice.paid and on subscription period changes. Sets the counter
-- to 0 and the anchor to NOW() (or the supplied timestamp from the
-- Stripe event).
-- ============================================================
CREATE OR REPLACE FUNCTION reset_brief_publish_period(
  p_org_id UUID,
  p_anchor TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
  UPDATE org_subscriptions
  SET briefs_published_this_period = 0,
      period_anchor = p_anchor
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION reset_brief_publish_period(UUID, TIMESTAMPTZ) OWNER TO postgres;
