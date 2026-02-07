-- =====================================================================
-- 005_auth_triggers.sql
-- Auth claim senkronizasyonu
-- Staff tablosu guncellendiginde auth.users.raw_app_meta_data'ya
-- role, is_admin, staff_id, staff_name yazilir
-- Bu sayede JWT icinde bu claim'ler otomatik gelir
-- =====================================================================

-- Staff -> Auth claim senkronizasyon fonksiyonu
CREATE OR REPLACE FUNCTION public.sync_staff_claims()
RETURNS TRIGGER AS $$
BEGIN
  -- auth_user_id bos degilse, claim'leri guncelle
  IF NEW.auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'role', NEW.role,
        'is_admin', NEW.is_admin,
        'staff_id', NEW.id,
        'staff_name', NEW.name,
        'active', NEW.active
      )
    WHERE id = NEW.auth_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff INSERT/UPDATE'te claim senkronizasyonu
CREATE TRIGGER sync_staff_claims_on_change
  AFTER INSERT OR UPDATE OF role, is_admin, name, active, auth_user_id
  ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_claims();

-- Staff silindiginde (soft delete: active=false degil, gercek silme)
-- auth claim'lerden staff bilgilerini temizle
CREATE OR REPLACE FUNCTION public.clear_staff_claims()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data - 'staff_id' - 'staff_name' - 'is_admin'
    WHERE id = OLD.auth_user_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER clear_staff_claims_on_delete
  AFTER DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_staff_claims();
