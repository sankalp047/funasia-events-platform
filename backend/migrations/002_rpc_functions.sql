-- ============================================================
-- RPC Functions (called from app via supabase.rpc())
-- ============================================================

-- Geo search: find events within radius
CREATE OR REPLACE FUNCTION events_within_radius(user_lat FLOAT, user_lng FLOAT, radius_m FLOAT)
RETURNS TABLE(id UUID, distance_m FLOAT) AS $$
BEGIN
  RETURN QUERY
    SELECT
      e.id,
      ST_Distance(
        e.location,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) AS distance_m
    FROM events e
    WHERE e.status = 'published'
      AND e.event_end >= NOW()
      AND ST_DWithin(
        e.location,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_m
      )
    ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment/decrement of tier sold_quantity
CREATE OR REPLACE FUNCTION increment_tier_sold(tier_id UUID, amount INT)
RETURNS void AS $$
BEGIN
  UPDATE ticket_tiers
  SET sold_quantity = GREATEST(0, sold_quantity + amount)
  WHERE id = tier_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment of promo code usage
CREATE OR REPLACE FUNCTION increment_promo_usage(promo_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE promo_codes
  SET used_count = used_count + 1
  WHERE id = promo_id;
END;
$$ LANGUAGE plpgsql;
