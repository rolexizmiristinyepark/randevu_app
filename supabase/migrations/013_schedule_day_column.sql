-- =====================================================================
-- 013_schedule_day_column.sql
-- notification_flows tablosuna schedule_day kolonu (today/tomorrow)
-- Time-based hatirlatma flow'larinda gun secimi icin
-- =====================================================================

-- schedule_day kolonu ekle (HATIRLATMA trigger'li flow'lar icin)
-- 'today' = bugunun randevulari, 'tomorrow' = yarinin randevulari
ALTER TABLE public.notification_flows
  ADD COLUMN IF NOT EXISTS schedule_day TEXT DEFAULT 'today'
  CHECK (schedule_day IN ('today', 'tomorrow'));

-- Mevcut HATIRLATMA flow'lari icin default 'today' olarak ayarla
UPDATE public.notification_flows
  SET schedule_day = 'today'
  WHERE trigger = 'HATIRLATMA' AND schedule_day IS NULL;
