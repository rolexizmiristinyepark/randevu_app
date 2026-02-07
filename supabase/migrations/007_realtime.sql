-- ============================================
-- 007: REALTIME - Canli Guncelleme
-- ============================================
-- Admin panelinde canli guncelleme icin
-- appointments ve message_log tablolarini
-- supabase_realtime publication'a ekle

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_log;
