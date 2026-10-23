create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth date := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
  v_admin boolean := coalesce(new.raw_user_meta_data->>'invite_kind', '') = 'admin';
  v_google boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google';
begin
  if v_admin then
    insert into public.profiles (id, full_name, email, whatsapp, birth_date, address, whatsapp_consent, terms_accepted_at)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Admin'), new.email,
            '+620000000000', date '1970-01-01', 'Belum dilengkapi', false, null);
  elsif v_google then
    insert into public.profiles (id, full_name, email, whatsapp, birth_date, address, whatsapp_consent, terms_accepted_at)
    values (new.id, 'Peserta Qurbanity', new.email, '+620000000000', date '1970-01-01', 'Belum dilengkapi', false, null);
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
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    new.id,
    'register',
    'profile',
    new.id,
    case when coalesce((new.raw_user_meta_data->>'terms_accepted')::boolean, false)
      then jsonb_build_object(
        'terms_version', 'draft-1',
        'privacy_version', 'draft-1',
        'consent_method', case when v_google then 'google_profile_form' else 'registration_checkbox' end
      )
      else '{}'::jsonb
    end
  );
  return new;
end;
$$;

create or replace function public.complete_participant_google_profile(
  p_full_name text,
  p_whatsapp text,
  p_birth_date date,
  p_address text,
  p_accept_terms boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Silakan masuk untuk melengkapi profil';
  end if;
  if exists (select 1 from public.admin_members where user_id = v_uid) then
    raise exception 'Akun admin tidak menggunakan formulir peserta';
  end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'participant') then
    raise exception 'Akun peserta tidak ditemukan';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = v_uid and u.raw_app_meta_data->>'provider' = 'google'
  ) then
    raise exception 'Pelengkapan profil ini hanya tersedia untuk akun Google baru';
  end if;
  if p_accept_terms is distinct from true then
    raise exception 'Persetujuan Syarat dan Ketentuan serta Kebijakan Privasi wajib diberikan';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 3 and 120 then
    raise exception 'Nama lengkap harus terdiri dari 3 sampai 120 karakter';
  end if;
  if coalesce(p_whatsapp, '') !~ '^\+628[0-9]{7,12}$' then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;
  if p_birth_date is null or p_birth_date > (current_date - interval '17 years')::date
     or p_birth_date < (current_date - interval '120 years')::date then
    raise exception 'Usia minimal 17 tahun dan tanggal lahir harus valid';
  end if;
  if char_length(btrim(coalesce(p_address, ''))) not between 10 and 500 then
    raise exception 'Alamat harus terdiri dari 10 sampai 500 karakter';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Profil peserta tidak ditemukan';
  end if;
  if v_profile.terms_accepted_at is not null
     and v_profile.whatsapp <> '+620000000000'
     and v_profile.birth_date <> date '1970-01-01'
     and v_profile.address <> 'Belum dilengkapi' then
    raise exception 'Profil sudah dilengkapi';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name), whatsapp = p_whatsapp, birth_date = p_birth_date,
      address = btrim(p_address), terms_accepted_at = now(), updated_at = now()
  where id = v_uid;

  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
  values (
    v_uid,
    'participant.google_profile_complete',
    'profile',
    v_uid,
    'participant',
    jsonb_build_object(
      'provider', 'google',
      'terms_version', 'draft-1',
      'privacy_version', 'draft-1',
      'consent_method', 'google_profile_form'
    )
  );
end;
$$;

revoke execute on function public.complete_participant_google_profile(text, text, date, text, boolean) from public, anon;
grant execute on function public.complete_participant_google_profile(text, text, date, text, boolean) to authenticated;

create or replace function public.require_complete_participant_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id
      and p.terms_accepted_at is not null
      and p.whatsapp <> '+620000000000'
      and p.birth_date <> date '1970-01-01'
      and p.address <> 'Belum dilengkapi'
  ) then
    raise exception 'Lengkapi profil dan persetujuan Syarat dan Ketentuan sebelum membuat komitmen';
  end if;
  return new;
end;
$$;

create trigger qurban_commitments_require_complete_profile
before insert on public.qurban_commitments
for each row execute function public.require_complete_participant_profile();