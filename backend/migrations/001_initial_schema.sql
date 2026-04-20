-- ============================================================
-- FunAsia Events Platform — Database Schema
-- PostgreSQL (Supabase-compatible)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For location-based queries

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE ticket_type AS ENUM ('free', 'paid');
CREATE TYPE order_status AS ENUM ('reserved', 'paid', 'cancelled', 'refunded', 'expired');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE media_type AS ENUM ('image', 'video');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),  -- NULL if using OAuth
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    auth_provider VARCHAR(50) DEFAULT 'email',  -- 'email', 'google', 'phone'
    google_id VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Location preferences
    default_city VARCHAR(100),
    default_state VARCHAR(100),
    default_lat DECIMAL(10, 8),
    default_lng DECIMAL(11, 8),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADMIN PROFILES (extends users with role='admin')
-- ============================================================
CREATE TABLE admin_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255),
    business_email VARCHAR(255),
    business_phone VARCHAR(20),
    tax_id VARCHAR(50),
    
    -- Stripe Connect for payouts
    stripe_account_id VARCHAR(255),  -- Stripe Connected Account ID
    stripe_onboarded BOOLEAN DEFAULT FALSE,
    
    -- Bank / payout preferences
    default_bank_name VARCHAR(255),
    default_bank_last4 VARCHAR(4),
    
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id),
    
    -- Basic info
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    
    -- Type
    ticket_type ticket_type NOT NULL DEFAULT 'paid',
    status event_status DEFAULT 'draft',
    
    -- Venue & Location
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'US',
    location GEOGRAPHY(POINT, 4326),  -- PostGIS point for geo queries
    
    -- Seat map image uploaded by admin
    seat_map_image_url TEXT,
    
    -- Timing
    event_start TIMESTAMPTZ NOT NULL,
    event_end TIMESTAMPTZ NOT NULL,
    doors_open TIMESTAMPTZ,
    
    -- Platform fees (flexible — super admin can configure)
    platform_fee_percent DECIMAL(5, 2) DEFAULT 0,  -- e.g. 5.00 = 5%
    platform_fee_flat DECIMAL(10, 2) DEFAULT 0,     -- e.g. 2.00 = $2 per ticket
    
    -- Stripe payout config for this event's admin
    payout_stripe_account VARCHAR(255),  -- overrides admin_profiles default if set
    
    -- Metadata
    is_featured BOOLEAN DEFAULT FALSE,
    max_tickets_per_user INT DEFAULT 10,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_city_state ON events(city, state);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start ON events(event_start);
CREATE INDEX idx_events_admin ON events(admin_id);

-- ============================================================
-- EVENT MEDIA (images 16:9 + optional short video)
-- ============================================================
CREATE TABLE event_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    media_type media_type NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,          -- auto-generated thumbnail for videos
    display_order INT DEFAULT 0, -- ordering for carousel
    is_cover BOOLEAN DEFAULT FALSE,
    
    -- Dimensions stored for responsive rendering
    width INT,
    height INT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_media_event ON event_media(event_id);

-- ============================================================
-- TICKET TIERS (pricing tiers per event)
-- ============================================================
CREATE TABLE ticket_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,         -- e.g. "VIP", "General Admission", "Front Row"
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,      -- 0.00 for free events
    
    total_quantity INT NOT NULL,
    sold_quantity INT DEFAULT 0,
    
    -- Per-user limit for this tier
    max_per_user INT DEFAULT 10,
    
    -- Sale window
    sale_start TIMESTAMPTZ,
    sale_end TIMESTAMPTZ,
    
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_tiers_event ON ticket_tiers(event_id);

-- ============================================================
-- SEATS (individual seats linked to a tier)
-- ============================================================
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES ticket_tiers(id) ON DELETE CASCADE,
    
    section VARCHAR(50),    -- e.g. "A", "Balcony", "Floor"
    row_label VARCHAR(10),  -- e.g. "A", "B", "1"
    seat_number VARCHAR(10),-- e.g. "12", "13"
    label VARCHAR(50),      -- computed display: "A-12"
    
    is_available BOOLEAN DEFAULT TRUE,
    is_reserved BOOLEAN DEFAULT FALSE,  -- temporarily held during checkout
    reserved_until TIMESTAMPTZ,
    reserved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seats_event ON seats(event_id);
CREATE INDEX idx_seats_tier ON seats(tier_id);
CREATE INDEX idx_seats_available ON seats(event_id, is_available, is_reserved);
CREATE INDEX idx_seats_reserved_until ON seats(reserved_until) WHERE is_reserved = TRUE;

-- ============================================================
-- FOOD & DRINK OPTIONS (per event, set by admin)
-- ============================================================
CREATE TABLE food_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,       -- e.g. "Chicken Biryani Plate"
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),             -- 'food', 'drink', 'combo'
    image_url TEXT,
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    max_quantity INT,                  -- NULL = unlimited
    sold_quantity INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_food_options_event ON food_options(event_id);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,  -- human-readable: FA-XXXXX
    user_id UUID NOT NULL REFERENCES users(id),
    event_id UUID NOT NULL REFERENCES events(id),
    
    status order_status DEFAULT 'reserved',
    
    -- Pricing breakdown
    subtotal DECIMAL(10, 2) NOT NULL,
    food_total DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    stripe_fee DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Promo
    promo_code_id UUID REFERENCES promo_codes(id),
    
    -- Stripe
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    
    -- Reservation timer
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    reservation_expires_at TIMESTAMPTZ,  -- reserved_at + 5 minutes
    
    paid_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Mailgun email tracking
    confirmation_email_id VARCHAR(255),
    confirmation_email_sent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_event ON orders(event_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_reservation ON orders(reservation_expires_at) WHERE status = 'reserved';

-- ============================================================
-- ORDER ITEMS (individual tickets in an order)
-- ============================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES ticket_tiers(id),
    seat_id UUID REFERENCES seats(id),  -- NULL for GA
    
    -- Per-attendee info (for individual barcodes)
    attendee_name VARCHAR(255),
    attendee_email VARCHAR(255),
    
    price DECIMAL(10, 2) NOT NULL,
    
    -- Barcode for scanning at entry
    barcode VARCHAR(255) UNIQUE NOT NULL,
    barcode_url TEXT,  -- URL to generated barcode image
    
    is_checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES users(id),  -- staff who scanned
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_barcode ON order_items(barcode);

-- ============================================================
-- ORDER FOOD ITEMS (food/drink added to order)
-- ============================================================
CREATE TABLE order_food_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    food_option_id UUID NOT NULL REFERENCES food_options(id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_food_order ON order_food_items(order_id);

-- ============================================================
-- PROMO CODES
-- ============================================================
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,  -- NULL = platform-wide
    
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL,  -- 'percent' or 'flat'
    discount_value DECIMAL(10, 2) NOT NULL,
    
    max_uses INT,           -- NULL = unlimited
    used_count INT DEFAULT 0,
    max_per_user INT DEFAULT 1,
    
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_event ON promo_codes(event_id);

-- ============================================================
-- PAYOUTS (from platform to event admins)
-- ============================================================
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id),
    event_id UUID NOT NULL REFERENCES events(id),
    
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee_collected DECIMAL(10, 2) NOT NULL,
    stripe_fee_collected DECIMAL(10, 2) NOT NULL,
    net_amount DECIMAL(10, 2) NOT NULL,  -- amount - fees
    
    status payout_status DEFAULT 'pending',
    
    stripe_transfer_id VARCHAR(255),
    stripe_payout_id VARCHAR(255),
    
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_admin ON payouts(admin_id);
CREATE INDEX idx_payouts_event ON payouts(event_id);

-- ============================================================
-- PLATFORM SETTINGS (super admin configurable)
-- ============================================================
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
    ('default_platform_fee_percent', '5.00', 'Default platform fee percentage for paid events'),
    ('default_platform_fee_flat', '0.00', 'Default flat fee per ticket'),
    ('reservation_timeout_minutes', '5', 'Minutes to hold reserved seats before expiring'),
    ('max_tickets_per_user_default', '10', 'Default max tickets per user per event'),
    ('stripe_application_fee_percent', '2.90', 'Stripe processing fee percentage'),
    ('stripe_application_fee_flat', '0.30', 'Stripe flat fee per transaction'),
    ('default_search_radius_miles', '100', 'Default radius for location-based event search'),
    ('mailgun_from_email', 'tickets@funasia.events', 'Email sender address'),
    ('support_email', 'support@funasia.events', 'Support email address');

-- ============================================================
-- AUDIT LOG (super admin visibility)
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,  -- 'event.created', 'order.paid', 'user.registered', etc.
    entity_type VARCHAR(50),       -- 'event', 'order', 'user', etc.
    entity_id UUID,
    metadata JSONB,                -- flexible extra data
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'FA-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 6));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ticket_tiers_updated_at BEFORE UPDATE ON ticket_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Release expired seat reservations (run via pg_cron or app-level cron)
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS void AS $$
BEGIN
    -- Release seats
    UPDATE seats
    SET is_reserved = FALSE, reserved_until = NULL, reserved_by = NULL
    WHERE is_reserved = TRUE AND reserved_until < NOW();
    
    -- Expire orders
    UPDATE orders
    SET status = 'expired'
    WHERE status = 'reserved' AND reservation_expires_at < NOW();
    
    -- Restore ticket tier counts
    UPDATE ticket_tiers tt
    SET sold_quantity = sold_quantity - sub.cnt
    FROM (
        SELECT oi.tier_id, COUNT(*) as cnt
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'expired'
        AND o.updated_at >= NOW() - INTERVAL '1 minute'
        GROUP BY oi.tier_id
    ) sub
    WHERE tt.id = sub.tier_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (Supabase)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_self ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_self ON users FOR UPDATE USING (auth.uid() = id);

-- Published events are public
CREATE POLICY events_public_read ON events FOR SELECT USING (status = 'published');
-- Admins can manage their own events
CREATE POLICY events_admin_all ON events FOR ALL USING (auth.uid() = admin_id);
-- Super admins can manage all events
CREATE POLICY events_super_admin ON events FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
);

-- Users see their own orders
CREATE POLICY orders_self ON orders FOR SELECT USING (auth.uid() = user_id);
-- Admins see orders for their events
CREATE POLICY orders_admin ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND admin_id = auth.uid())
);
-- Super admins see all orders
CREATE POLICY orders_super_admin ON orders FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
);
