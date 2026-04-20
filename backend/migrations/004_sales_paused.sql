-- 004_sales_paused.sql
-- Add sales_paused flag to events so organizers can pause/resume ticket sales
-- without cancelling the event or unpublishing it.

ALTER TABLE events ADD COLUMN IF NOT EXISTS sales_paused boolean DEFAULT false;
