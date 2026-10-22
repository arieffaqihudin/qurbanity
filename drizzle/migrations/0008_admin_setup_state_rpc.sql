-- Status setup admin milik pemanggil (dipakai halaman /aktivasi-akun untuk memvalidasi tautan)
create or replace function public.my_admin_setup_state()
returns text language sql stable security definer set search_path to 'public' as $$
  select case when m.is_active then m.setup_status else null end
  from public.admin_members m where m.user_id = auth.uid()
$$;