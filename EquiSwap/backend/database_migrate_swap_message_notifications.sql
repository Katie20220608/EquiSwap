ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (
        type IN (
            'swap_proposal',
            'swap_response',
            'swap_completed',
            'swap_expired',
            'swap_message',
            'system'
        )
    );