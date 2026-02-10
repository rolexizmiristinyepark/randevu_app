-- =====================================================================
-- 012_schedule_hour_and_reminder_cron.sql
-- notification_flows tablosuna schedule_hour kolonu + hatirlatma cron job
-- =====================================================================

-- schedule_hour kolonu ekle (HATIRLATMA trigger'li flow'lar icin)
ALTER TABLE public.notification_flows
  ADD COLUMN IF NOT EXISTS schedule_hour TEXT DEFAULT NULL;

-- =====================================================================
-- Hatirlatma cron job
-- Her saat basinda calisir, o saate ayarli HATIRLATMA flow'larini tetikler
-- pg_net ile Edge Function cagirir
-- =====================================================================
SELECT cron.schedule(
  'trigger-scheduled-reminders',
  '0 * * * *',  -- Her saat basinda
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.anon_key')
    ),
    body := jsonb_build_object(
      'action', 'triggerScheduledReminders'
    )
  );
  $$
);
