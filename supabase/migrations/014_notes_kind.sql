-- 014: Activity kind for the unified timeline ('note' | 'status').
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'note';
