ALTER TABLE items
    ADD COLUMN IF NOT EXISTS age_group VARCHAR(20) NULL
    CHECK (age_group IN ('0-2', '3-5', '6-8', '9-12', '13+'));
