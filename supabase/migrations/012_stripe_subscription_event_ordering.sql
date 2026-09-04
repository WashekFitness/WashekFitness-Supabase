-- ============================================================
-- 012_stripe_subscription_event_ordering.sql
-- ============================================================
--
-- Stripe does not guarantee webhook event ordering.
--
-- This migration adds subscription-level ordering protection so
-- an older Stripe subscription event cannot overwrite newer
-- subscription state in the profiles table.
--
-- IMPORTANT:
-- This migration is designed to be safe to run against a
-- database where the webhook-event idempotency migration
-- (011) has already been applied.
-- ============================================================


-- ============================================================
-- 1. ADD SUBSCRIPTION INFORMATION TO WEBHOOK EVENTS
-- ============================================================

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS subscription_id TEXT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS event_created BIGINT;


-- ============================================================
-- 2. INDEX SUBSCRIPTION EVENTS
-- ============================================================

CREATE INDEX IF NOT EXISTS
  idx_stripe_webhook_events_subscription_created
ON public.stripe_webhook_events (
  subscription_id,
  event_created DESC
);


-- ============================================================
-- 3. ALLOW "IGNORED" EVENTS
--
-- An event can be successfully received and recorded while
-- intentionally not being applied because a newer event for the
-- same Stripe subscription has already been processed.
-- ============================================================

ALTER TABLE public.stripe_webhook_events
  DROP CONSTRAINT IF EXISTS stripe_webhook_events_status_check;

ALTER TABLE public.stripe_webhook_events
  ADD CONSTRAINT stripe_webhook_events_status_check
  CHECK (
    status IN (
      'processing',
      'succeeded',
      'failed',
      'ignored'
    )
  );


-- ============================================================
-- 4. SUBSCRIPTION-LEVEL EVENT CLAIM
-- ============================================================
--
-- This function:
--
--   • serializes processing for one Stripe subscription
--   • records the incoming event
--   • compares its creation time with the newest event already
--     processed for that subscription
--   • rejects older events
--   • allows newer events to proceed
--
-- Returns:
--
--   allowed = true
--      The webhook should process the event.
--
--   allowed = false
--      The event is stale and should be ignored.
--
-- The advisory transaction lock prevents two simultaneous
-- subscription events from both passing the ordering check.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_stripe_subscription_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_subscription_id TEXT,
  p_event_created BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_event_created BIGINT;
  existing_event_id TEXT;
BEGIN

  -- ----------------------------------------------------------
  -- Validate required values.
  -- ----------------------------------------------------------

  IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
    RAISE EXCEPTION 'Stripe event ID is required.';
  END IF;

  IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RAISE EXCEPTION 'Stripe event type is required.';
  END IF;

  IF p_subscription_id IS NULL
     OR length(trim(p_subscription_id)) = 0 THEN
    RAISE EXCEPTION 'Stripe subscription ID is required.';
  END IF;

  IF p_event_created IS NULL THEN
    RAISE EXCEPTION 'Stripe event creation timestamp is required.';
  END IF;


  -- ----------------------------------------------------------
  -- Serialize events for this subscription.
  --
  -- hashtextextended gives us a stable 64-bit advisory-lock key.
  -- The lock exists only for the current database transaction.
  -- ----------------------------------------------------------

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_subscription_id, 0)
  );


  -- ----------------------------------------------------------
  -- Check whether this exact event has already been recorded.
  -- ----------------------------------------------------------

  SELECT
    event_created
  INTO
    existing_event_created
  FROM public.stripe_webhook_events
  WHERE event_id = p_event_id
  LIMIT 1;


  IF FOUND THEN

    RETURN jsonb_build_object(
      'allowed',
      false,

      'reason',
      'duplicate_event',

      'event_id',
      p_event_id
    );

  END IF;


  -- ----------------------------------------------------------
  -- Find the newest previously recorded event for this
  -- subscription.
  --
  -- Only events that actually advanced subscription state are
  -- considered here.
  -- ----------------------------------------------------------

  SELECT
    event_created,
    event_id
  INTO
    existing_event_created,
    existing_event_id
  FROM public.stripe_webhook_events
  WHERE subscription_id = p_subscription_id
    AND status = 'succeeded'
    AND event_created IS NOT NULL
  ORDER BY
    event_created DESC,
    event_id DESC
  LIMIT 1;


  -- ----------------------------------------------------------
  -- If a newer event has already been successfully processed,
  -- record this event as ignored.
  -- ----------------------------------------------------------

  IF existing_event_created IS NOT NULL
     AND p_event_created < existing_event_created THEN

    INSERT INTO public.stripe_webhook_events (
      event_id,
      event_type,
      event_created,
      subscription_id,
      status,
      created_at,
      updated_at
    )
    VALUES (
      p_event_id,
      p_event_type,
      p_event_created,
      p_subscription_id,
      'ignored',
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'allowed',
      false,

      'reason',
      'stale_event',

      'event_id',
      p_event_id,

      'subscription_id',
      p_subscription_id,

      'event_created',
      p_event_created,

      'newer_event_created',
      existing_event_created,

      'newer_event_id',
      existing_event_id
    );

  END IF;


  -- ----------------------------------------------------------
  -- Record the event as processing.
  --
  -- The webhook handler is responsible for marking it
  -- succeeded or failed after the actual Stripe state update.
  -- ----------------------------------------------------------

  INSERT INTO public.stripe_webhook_events (
    event_id,
    event_type,
    event_created,
    subscription_id,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_event_id,
    p_event_type,
    p_event_created,
    p_subscription_id,
    'processing',
    NOW(),
    NOW()
  );


  RETURN jsonb_build_object(
    'allowed',
    true,

    'reason',
    'new_event',

    'event_id',
    p_event_id,

    'subscription_id',
    p_subscription_id,

    'event_created',
    p_event_created
  );

END;
$$;


-- ============================================================
-- 5. RESTRICT FUNCTION EXECUTION
-- ============================================================
--
-- Webhook processing is server-side and uses the service role.
-- Normal authenticated users should not be able to invoke this
-- function directly.
-- ============================================================

REVOKE ALL
ON FUNCTION public.claim_stripe_subscription_event(
  TEXT,
  TEXT,
  TEXT,
  BIGINT
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.claim_stripe_subscription_event(
  TEXT,
  TEXT,
  TEXT,
  BIGINT
)
FROM anon;

REVOKE ALL
ON FUNCTION public.claim_stripe_subscription_event(
  TEXT,
  TEXT,
  TEXT,
  BIGINT
)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.claim_stripe_subscription_event(
  TEXT,
  TEXT,
  TEXT,
  BIGINT
)
TO service_role;


-- ============================================================
-- END OF MIGRATION
-- ============================================================
