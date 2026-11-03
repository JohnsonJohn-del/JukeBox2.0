-- Add is_video_mode to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_video_mode BOOLEAN DEFAULT FALSE;

-- Add music_video_id and has_video to queue_items
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS music_video_id VARCHAR(50);
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_items_has_video ON queue_items(has_video);
