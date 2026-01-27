-- Add skip intro/outro timestamp columns to content table (for movies)
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS intro_start REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS intro_end REAL,
ADD COLUMN IF NOT EXISTS outro_start REAL;

-- Add skip intro/outro timestamp columns to episodes table (for series)
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS intro_start REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS intro_end REAL,
ADD COLUMN IF NOT EXISTS outro_start REAL;

-- Add comments for documentation
COMMENT ON COLUMN public.content.intro_start IS 'Timestamp in seconds when intro starts (default 0)';
COMMENT ON COLUMN public.content.intro_end IS 'Timestamp in seconds when intro ends (skip target)';
COMMENT ON COLUMN public.content.outro_start IS 'Timestamp in seconds when outro/credits start';

COMMENT ON COLUMN public.episodes.intro_start IS 'Timestamp in seconds when intro starts (default 0)';
COMMENT ON COLUMN public.episodes.intro_end IS 'Timestamp in seconds when intro ends (skip target)';
COMMENT ON COLUMN public.episodes.outro_start IS 'Timestamp in seconds when outro/credits start';