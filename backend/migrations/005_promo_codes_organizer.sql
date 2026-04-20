-- 005_promo_codes_organizer.sql
-- Allow organizers to own and manage their promo codes.
-- restricted_to_email limits a code to a single attendee email (personalized).

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS restricted_to_email text;

-- Index for fast lookup by organizer
CREATE INDEX IF NOT EXISTS promo_codes_admin_id_idx ON promo_codes(admin_id);
