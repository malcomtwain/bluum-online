-- Add lyrics column to songs table
alter table public.songs
add column lyrics jsonb;

-- Create index for lyrics queries
create index songs_lyrics_idx on public.songs using gin(lyrics);
