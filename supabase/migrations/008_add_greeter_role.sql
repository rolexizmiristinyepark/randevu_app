-- Add 'greeter' role to staff table constraint
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('sales', 'management', 'reception', 'service', 'greeter'));
