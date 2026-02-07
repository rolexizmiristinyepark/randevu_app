-- =====================================================================
-- 006_cron_jobs.sql
-- pg_cron zamanlanmis gorevler
-- GAS kaynak: Daily triggers, CacheService TTL
--
-- NOT: pg_cron Supabase'de varsayilan olarak aktiftir
-- Supabase Dashboard -> Database -> Extensions -> pg_cron
-- =====================================================================

-- pg_cron ve pg_net extension'lari (Supabase'de zaten aktif)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================================
-- 1. KVKK: Eski mesaj loglarini anonimlesitir (30 gun)
-- Her gun 03:00 Istanbul (00:00 UTC)
-- GAS: cleanupOldMessageLogs trigger
-- =====================================================================
SELECT cron.schedule(
  'kvkk-anonymize',
  '0 0 * * *',  -- 00:00 UTC = 03:00 Istanbul
  $$SELECT public.anonymize_old_messages()$$
);

-- =====================================================================
-- 2. KVKK: Eski mesaj iceriklerini sil (7 gun)
-- Her gun 00:30 UTC
-- GAS: cleanupOldMessageContent trigger
-- =====================================================================
SELECT cron.schedule(
  'kvkk-delete-content',
  '30 0 * * *',
  $$SELECT public.delete_old_message_content()$$
);

-- =====================================================================
-- 3. Rate limit temizligi
-- Her saat - suresi dolmus rate limit kayitlarini sil
-- GAS: CacheService TTL (otomatik)
-- =====================================================================
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$DELETE FROM public.rate_limits
    WHERE (locked_until IS NOT NULL AND locked_until < NOW())
       OR (first_request < NOW() - INTERVAL '1 hour')$$
);

-- =====================================================================
-- 4. Eski audit log temizligi (1 yildan eski)
-- Ayda bir (ayin 1'i, 02:00 UTC)
-- =====================================================================
SELECT cron.schedule(
  'cleanup-old-audit',
  '0 2 1 * *',
  $$DELETE FROM public.audit_log WHERE timestamp < NOW() - INTERVAL '1 year'$$
);

-- =====================================================================
-- 5. Realtime publication
-- appointments ve message_log tablolarini Realtime'a ekle
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_log;
