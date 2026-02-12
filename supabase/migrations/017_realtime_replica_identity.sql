-- Migration 017: Realtime icin REPLICA IDENTITY FULL
-- Sorun: message_log Realtime event'leri gelmiyor
-- Neden: REPLICA IDENTITY tanimlanmamis → payload.new bos gelebilir
-- Ayrica publication'a tekrar ekle (idempotent)

-- message_log icin REPLICA IDENTITY FULL
ALTER TABLE public.message_log REPLICA IDENTITY FULL;

-- appointments icin de ekle (tutarlilik)
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
