CREATE TABLE public.playlist_tracks (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playlist_id, track_id),
  UNIQUE(playlist_id, position)
);

-- Add comments for documentation
COMMENT ON TABLE public.playlist_tracks IS 'Junction table linking tracks to playlists with ordering';
COMMENT ON COLUMN public.playlist_tracks.position IS 'Order of track within the playlist';