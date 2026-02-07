-- ============================================
-- 007: REALTIME - Canli Guncelleme
-- ============================================
-- Admin panelinde canli guncelleme icin
-- appointments ve message_log tablolarini
-- supabase_realtime publication'a ekle

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_log;
  END IF;
END $$;
