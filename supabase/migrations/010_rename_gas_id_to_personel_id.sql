-- gas_id -> personel_id yeniden adlandırma + Varol Uçan personel_id ataması
BEGIN;

ALTER TABLE public.staff RENAME COLUMN gas_id TO personel_id;

-- Varol Uçan personel_id ata
UPDATE public.staff SET personel_id = 'vu748265' WHERE id = 12 AND personel_id IS NULL;

COMMIT;
