-- ============================================
-- EQUISWAP DATABASE SCHEMA
-- PostgreSQL 15+
-- ============================================

-- 1. USERS TABLE
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    trust_score INT DEFAULT 100 CHECK (trust_score >= 0 AND trust_score <= 200),
    rejection_count INT DEFAULT 0,
    cooldown_until TIMESTAMP NULL,
    role VARCHAR(20) DEFAULT 'parent' CHECK (role IN ('parent', 'volunteer', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CATEGORIES TABLE (Lookup)
CREATE TABLE categories (
    c_id SERIAL PRIMARY KEY,
    c_name VARCHAR(50) UNIQUE NOT NULL,
    icon VARCHAR(50) NULL
);

-- 3. ITEMS TABLE
CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    category_id INT NULL REFERENCES categories(c_id) ON DELETE SET NULL,
    condition_score INT DEFAULT 5 CHECK (condition_score BETWEEN 1 AND 10),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'swap_pending', 'swapped')),
    image_url TEXT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. WISHLISTS TABLE
CREATE TABLE wishlists (
    wishlist_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- 5. SWAP PROPOSALS TABLE
CREATE TABLE swap_proposals (
    sp_id SERIAL PRIMARY KEY,
    cycle_id UUID NOT NULL,
    giver_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    expiry_warning_sent BOOLEAN DEFAULT FALSE,
    UNIQUE(cycle_id, giver_id, item_id)
);

-- 6. SWAP HISTORY TABLE
CREATE TABLE swap_history (
    sh_id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    from_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    to_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    cycle_id UUID NULL,
    swap_date TIMESTAMP DEFAULT NOW(),
    notes TEXT NULL
);

-- 7. USER PREFERENCES (Blacklist)
CREATE TABLE user_preferences (
    uf_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    avoid_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, avoid_user_id)
);

-- 8. TRUST LOGS
CREATE TABLE trust_logs (
    tl_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('completed_swap', 'rejected_swap', 'reported')),
    score_change INT NOT NULL,
    logged_at TIMESTAMP DEFAULT NOW(),
    description TEXT NULL
);

-- 9. NOTIFICATIONS
CREATE TABLE notifications (
    n_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('swap_proposal', 'swap_response', 'swap_completed', 'swap_expired', 'system')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    related_cycle_id UUID NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_items_owner_id ON items(owner_id);
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlists_item_id ON wishlists(item_id);
CREATE INDEX idx_swap_proposals_cycle_id ON swap_proposals(cycle_id);
CREATE INDEX idx_swap_proposals_giver_id ON swap_proposals(giver_id);
CREATE INDEX idx_swap_proposals_receiver_id ON swap_proposals(receiver_id);
CREATE INDEX idx_swap_proposals_status ON swap_proposals(status);
CREATE INDEX idx_swap_history_from_user ON swap_history(from_user_id);
CREATE INDEX idx_swap_history_to_user ON swap_history(to_user_id);
CREATE INDEX idx_swap_history_item_id ON swap_history(item_id);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_avoid_id ON user_preferences(avoid_user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();