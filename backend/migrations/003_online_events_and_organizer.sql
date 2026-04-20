-- ============================================================
-- Migration 003: Online events support + organizer profiles
-- Run in Supabase SQL Editor
-- ============================================================

-- Add online event support to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link_sent_at TIMESTAMPTZ;

-- Update category values to match new design system
-- (existing events with old categories will keep their values; new events use new list)
-- Categories: Music, Nightlife, Hobbies, Business, Dance
-- (no schema change needed — category is a free VARCHAR(50))

-- Index for online event filtering
CREATE INDEX IF NOT EXISTS idx_events_is_online ON events(is_online);

-- ============================================================
-- Expand admin_profiles with organizer onboarding fields
-- ============================================================
ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS org_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS org_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- ============================================================
-- RPC: send_meeting_link_reminders
-- Called by a daily cron job — finds events starting tomorrow
-- that are online and have a meeting link, marks them as sent.
-- The actual email send happens in the Node.js cron job.
-- ============================================================
CREATE OR REPLACE FUNCTION get_upcoming_online_events_for_reminder()
RETURNS TABLE(
  event_id UUID,
  event_title TEXT,
  meeting_link TEXT,
  event_start TIMESTAMPTZ,
  admin_id UUID
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      e.id AS event_id,
      e.title AS event_title,
      e.meeting_link,
      e.event_start,
      e.admin_id
    FROM events e
    WHERE
      e.is_online = TRUE
      AND e.meeting_link IS NOT NULL
      AND e.meeting_link_sent_at IS NULL
      AND e.status = 'published'
      AND e.event_start BETWEEN NOW() + INTERVAL '20 hours' AND NOW() + INTERVAL '28 hours';
END;
$$ LANGUAGE plpgsql;
