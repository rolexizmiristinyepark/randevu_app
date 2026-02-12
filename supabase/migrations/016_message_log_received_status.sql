-- Migration 016: message_log status CHECK constraint'ine 'received' ekle
-- Sorun: webhook-whatsapp gelen mesajlari status='received' ile kaydetmeye calisiyor
-- ama CHECK constraint'te 'received' yok → INSERT basarisiz oluyor
-- Sonuc: Gelen WhatsApp mesajlari DB'ye hic yazilmiyor

ALTER TABLE public.message_log
  DROP CONSTRAINT IF EXISTS message_log_status_check;

ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_status_check
  CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending', 'received'));
