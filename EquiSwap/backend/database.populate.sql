-- ============================================
-- EQUISWAP DUMMY DATA SEED
-- Run after backend/database_create.sql
-- PostgreSQL 15+
-- ============================================

BEGIN;

-- Optional reset for repeatable local seeding.
TRUNCATE TABLE notifications, trust_logs, user_preferences, swap_history, swap_proposals, wishlists, items, categories, users RESTART IDENTITY CASCADE;

-- 1) USERS
INSERT INTO users (name, email, password_hash, trust_score, rejection_count, role, is_active)
VALUES
	('Alice Chen', 'alice@example.com', '$2b$12$examplehashforalice', 100, 0, 'parent', TRUE),
	('Ben Kumar', 'ben@example.com', '$2b$12$examplehashforben', 92, 1, 'parent', TRUE),
	('Chloe Martin', 'chloe@example.com', '$2b$12$examplehashforchloe', 88, 2, 'volunteer', TRUE),
	('Admin User', 'admin@example.com', '$2b$12$examplehashforadmin', 100, 0, 'admin', TRUE);

-- 2) CATEGORIES
INSERT INTO categories (c_name, icon)
VALUES
	('Books', 'book'),
	('Toys', 'puzzle'),
	('STEM Kits', 'flask'),
	('Outdoor', 'tree');

-- 3) ITEMS
INSERT INTO items (owner_id, name, description, category_id, condition_score, status, image_url)
VALUES
	(1, 'Picture Book Bundle', 'A set of 6 early-reader books.', 1, 8, 'available', NULL),
	(1, 'Wooden Blocks', 'Natural wood blocks, full set.', 2, 9, 'available', NULL),
	(2, 'LEGO Starter Set', 'Mixed bricks and instruction cards.', 2, 7, 'swap_pending', NULL),
	(2, 'Beginner Microscope', 'Includes slides and tweezers.', 3, 8, 'available', NULL),
	(3, 'Kids Scooter', 'Three-wheel scooter, lightly used.', 4, 6, 'swapped', NULL);

-- 4) WISHLISTS
INSERT INTO wishlists (user_id, item_id)
VALUES
	(1, 3),
	(2, 1),
	(3, 2);

-- 5) SWAP PROPOSALS
INSERT INTO swap_proposals (cycle_id, giver_id, receiver_id, item_id, status, expires_at, created_at, responded_at, rejection_reason)
VALUES
	('11111111-1111-1111-1111-111111111111', 1, 2, 2, 'accepted', NOW() + INTERVAL '12 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NULL),
	('22222222-2222-2222-2222-222222222222', 2, 1, 3, 'pending', NOW() + INTERVAL '20 hours', NOW() - INTERVAL '30 minutes', NULL, NULL),
	('33333333-3333-3333-3333-333333333333', 3, 1, 5, 'rejected', NOW() + INTERVAL '6 hours', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 'Owner no longer interested');

-- 6) SWAP HISTORY
INSERT INTO swap_history (item_id, from_user_id, to_user_id, cycle_id, swap_date, notes)
VALUES
	(5, 3, 1, '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '7 days', 'Smooth exchange at community center.');

-- 7) USER PREFERENCES
INSERT INTO user_preferences (user_id, avoid_user_id, reason)
VALUES
	(2, 3, 'Timing mismatch for pickups');

-- 8) TRUST LOGS
INSERT INTO trust_logs (user_id, action, score_change, logged_at, description)
VALUES
	(1, 'completed_swap', 5, NOW() - INTERVAL '7 days', 'Completed scooter exchange'),
	(2, 'rejected_swap', -3, NOW() - INTERVAL '2 days', 'Rejected after acceptance'),
	(3, 'reported', -5, NOW() - INTERVAL '1 day', 'Late handover complaint');

-- 9) NOTIFICATIONS
INSERT INTO notifications (user_id, type, message, is_read, created_at, related_cycle_id)
VALUES
	(1, 'swap_response', 'Ben accepted your swap proposal.', FALSE, NOW() - INTERVAL '1 hour', '11111111-1111-1111-1111-111111111111'),
	(2, 'swap_proposal', 'Alice proposed a swap for Wooden Blocks.', TRUE, NOW() - INTERVAL '2 hours', '22222222-2222-2222-2222-222222222222'),
	(3, 'swap_expired', 'Your proposal for Kids Scooter is about to expire.', FALSE, NOW() - INTERVAL '10 minutes', '33333333-3333-3333-3333-333333333333');

COMMIT;
