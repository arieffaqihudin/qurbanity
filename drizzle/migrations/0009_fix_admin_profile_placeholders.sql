-- Placeholder profil admin harus memenuhi CHECK constraint profiles
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_birth date := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
  v_admin boolean := coalesce(new.raw_user_meta_data->>'invite_kind', '') = 'admin';
begin
  if v_admin then
    -- Akun admin dibuat lewat modul Pengguna; kolom wajib peserta diisi placeholder
    -- yang memenuhi constraint sampai orang tersebut melengkapi profilnya sendiri.
    insert into public.profiles (id, full_name, email, whatsapp, birth_date, address, whatsapp_consent, terms_accepted_at)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Admin'), new.email,
            '+620000000000', date '1970-01-01', 'Belum dilengkapi', false, null);
  else
    if v_birth is null or v_birth > (current_date - interval '17 years')::date then
      raise exception 'Usia minimal peserta adalah 17 tahun';
    end if;
    insert into public.profiles (id, full_name, email, whatsapp, birth_date, address, whatsapp_consent, terms_accepted_at)
    values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'whatsapp', v_birth,
            new.raw_user_meta_data->>'address', coalesce((new.raw_user_meta_data->>'whatsapp_consent')::boolean, false),
            case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() end);
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'participant');
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (new.id, 'register', 'profile', new.id);
  return new;
end $$;