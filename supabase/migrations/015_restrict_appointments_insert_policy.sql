-- =====================================================================
-- 015_restrict_appointments_insert_policy.sql
-- appointments INSERT policy'sini kisitla
--
-- Onceki: WITH CHECK (true) -> herkes INSERT yapabilir
-- Yeni: Sadece admin INSERT yapabilir (anon/authenticated engellensin)
--
-- Neden guvenli: Tum randevu olusturma islemleri Edge Function
-- (service_role) uzerinden geciyor, service_role RLS bypass eder.
-- check_and_create_appointment() da SECURITY DEFINER.
-- Dogrudan client INSERT'e gerek yok.
-- =====================================================================

-- Eski permissive policy'yi kaldir
DROP POLICY IF EXISTS "appointments_insert_all" ON public.appointments;

-- Yeni: Sadece admin INSERT yapabilir (direkt client erisimi icin)
-- Edge Functions service_role ile calistigi icin bu policy'den etkilenmez
CREATE POLICY "appointments_insert_admin" ON public.appointments
  FOR INSERT WITH CHECK (public.is_admin());
