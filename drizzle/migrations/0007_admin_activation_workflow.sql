-- 1) Kolom status aktivasi pada admin_members
alter table public.admin_members
  add column setup_status text not null default 'belum_diundang',
  add column invited_at timestamptz,
  add column setup_completed_at timestamptz;

alter table public.admin_members
  add constraint admin_members_setup_status_check
  check (setup_status in ('belum_diundang','menunggu_aktivasi','aktif','gagal_email','dinonaktifkan'));

-- Backfill: anggota aktif yang sudah ada dianggap sudah menyelesaikan aktivasi
update public.admin_members set setup_status = 'aktif', setup_completed_at = created_at where is_active;
update public.admin_members set setup_status = 'dinonaktifkan' where not is_active;

-- 2) Otorisasi: akses admin hanya untuk yang aktif DAN sudah menyelesaikan setup akun
create or replace function public.has_permission(_user_id uuid, _perm text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.admin_members m
    left join public.access_groups g on g.id = m.group_id
    where m.user_id = _user_id and m.is_active and m.setup_status = 'aktif' and (
      case
        when m.group_id is not null then
          g.is_active and exists (
            select 1 from public.access_group_permissions gp
            where gp.group_id = g.id and (gp.permission = _perm or gp.permission = '*'))
        else
          exists (
            select 1 from public.role_permissions rp
            where rp.role = m.role and (rp.permission = _perm or rp.permission = '*'))
      end
    )
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.admin_members where user_id = _user_id and is_active and setup_status = 'aktif')
$$;

create or replace function public.my_admin_access()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select jsonb_build_object(
      'role', m.role,
      'group', case when g.id is null then null else jsonb_build_object('slug', g.slug, 'name', g.name) end,
      'permissions', (
        select coalesce(jsonb_agg(distinct perms.p), '[]'::jsonb) from (
          select gp.permission as p from public.access_group_permissions gp
          join public.access_groups g2 on g2.id = gp.group_id
          where m.group_id is not null and g2.id = m.group_id and g2.is_active
          union
          select rp.permission from public.role_permissions rp
          where m.group_id is null and rp.role = m.role
        ) perms
      ))
    from public.admin_members m
    left join public.access_groups g on g.id = m.group_id
    where m.user_id = auth.uid() and m.is_active and m.setup_status = 'aktif'), 'null'::jsonb)
$$;

-- 3) Daftar pengguna: sertakan status aktivasi + filter status akun
create or replace function public.admin_list_users(p_search text default '', p_group uuid default null, p_status text default '', p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_total bigint; v_rows jsonb;
begin
  perform public.require_perm('users.manage');
  select count(*) into v_total
  from public.admin_members m join public.profiles p on p.id = m.user_id
  where (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
    and (p_group is null or m.group_id = p_group)
    and (p_status = '' or (p_status = 'active' and m.is_active) or (p_status = 'inactive' and not m.is_active)
         or (p_status in ('belum_diundang','menunggu_aktivasi','aktif','gagal_email','dinonaktifkan') and m.setup_status = p_status));
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'user_id', m.user_id, 'full_name', p.full_name, 'email', p.email,
      'role', m.role, 'is_active', m.is_active, 'created_at', m.created_at,
      'setup_status', m.setup_status, 'setup_completed_at', m.setup_completed_at, 'invited_at', m.invited_at,
      'group', case when g.id is null then null else jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name) end,
      'last_sign_in_at', u.last_sign_in_at
    ) as row_data
    from public.admin_members m
    join public.profiles p on p.id = m.user_id
    left join public.access_groups g on g.id = m.group_id
    left join auth.users u on u.id = m.user_id
    where (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
      and (p_group is null or m.group_id = p_group)
      and (p_status = '' or (p_status = 'active' and m.is_active) or (p_status = 'inactive' and not m.is_active)
           or (p_status in ('belum_diundang','menunggu_aktivasi','aktif','gagal_email','dinonaktifkan') and m.setup_status = p_status))
    order by p.full_name
    limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(0, coalesce(p_offset, 0))
  ) s;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- 4) Membuat catatan pengguna admin (nonaktif, belum diundang). Identitas Auth dibuat/ditautkan oleh server function.
create or replace function public.admin_create_user(p_user_id uuid, p_group_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_group public.access_groups;
begin
  perform public.require_perm('users.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  select * into v_group from public.access_groups where id = p_group_id;
  if not found then raise exception 'Grup pengguna tidak ditemukan'; end if;
  if not v_group.is_active then raise exception 'Grup tujuan sedang nonaktif'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Akun tidak ditemukan'; end if;
  if exists (select 1 from public.admin_members where user_id = p_user_id) then raise exception 'Email ini sudah terdaftar sebagai pengguna admin'; end if;
  insert into public.admin_members (user_id, role, is_active, group_id, created_by, setup_status)
  values (p_user_id, coalesce(v_group.role, 'program'), false, p_group_id, auth.uid(), 'belum_diundang');
  perform public.write_audit('USER_CREATED', 'admin_members', p_user_id, null,
    jsonb_build_object('group_id', p_group_id, 'group', v_group.name, 'is_active', false, 'setup_status', 'belum_diundang'), p_reason);
end $$;

-- 5) Mencatat kejadian aktivasi + transisi setup_status (daftar aksi terbatas)
create or replace function public.admin_record_activation_event(p_user_id uuid, p_action text, p_reason text default null, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_old text;
begin
  perform public.require_perm('users.manage');
  if p_action not in ('USER_ACTIVATION_REQUESTED','USER_INVITATION_SENT','USER_INVITATION_FAILED','USER_ACTIVATION_EMAIL_RESENT','USER_ACTIVATED','USER_DEACTIVATED') then
    raise exception 'Aksi aktivasi tidak dikenal';
  end if;
  select setup_status into v_old from public.admin_members where user_id = p_user_id for update;
  if not found then raise exception 'Pengguna admin tidak ditemukan'; end if;
  if p_action in ('USER_INVITATION_SENT','USER_ACTIVATION_EMAIL_RESENT') then
    update public.admin_members set setup_status = 'menunggu_aktivasi', invited_at = now(), updated_at = now() where user_id = p_user_id;
  elsif p_action = 'USER_INVITATION_FAILED' then
    update public.admin_members set setup_status = 'gagal_email', updated_at = now() where user_id = p_user_id;
  elsif p_action = 'USER_ACTIVATED' then
    update public.admin_members set setup_status = 'aktif', updated_at = now() where user_id = p_user_id;
  elsif p_action = 'USER_DEACTIVATED' then
    update public.admin_members set setup_status = 'dinonaktifkan', updated_at = now() where user_id = p_user_id;
  end if;
  perform public.write_audit(p_action, 'admin_members', p_user_id,
    jsonb_build_object('setup_status', v_old),
    jsonb_build_object('setup_status', (select setup_status from public.admin_members where user_id = p_user_id)),
    p_reason, p_meta);
end $$;

-- 6) Penyelesaian setup oleh pengguna sendiri setelah mengatur kata sandi
create or replace function public.complete_admin_setup()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v public.admin_members;
begin
  if auth.uid() is null then raise exception 'Sesi tidak valid. Buka kembali tautan aktivasi dari email.'; end if;
  select * into v from public.admin_members where user_id = auth.uid() for update;
  if not found then raise exception 'Akun ini tidak terdaftar sebagai pengguna admin'; end if;
  if not v.is_active or v.setup_status <> 'menunggu_aktivasi' then
    raise exception 'Tautan aktivasi sudah tidak berlaku. Minta Superadmin untuk mengaktifkan ulang akunmu.';
  end if;
  update public.admin_members set setup_status = 'aktif', setup_completed_at = now(), updated_at = now() where user_id = auth.uid();
  perform public.write_audit('USER_EMAIL_VERIFIED', 'admin_members', auth.uid(), null, null, null);
  perform public.write_audit('USER_PASSWORD_SETUP_COMPLETED', 'admin_members', auth.uid(), null, null, null);
  perform public.write_audit('USER_ACTIVATED', 'admin_members', auth.uid(),
    jsonb_build_object('setup_status', 'menunggu_aktivasi'), jsonb_build_object('setup_status', 'aktif'), null);
end $$;

-- 7) Catat USER_GROUP_CHANGED saat grup berubah lewat admin_update_user
create or replace function public.admin_update_user(p_user_id uuid, p_full_name text, p_group_id uuid, p_active boolean, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_old public.admin_members; v_group public.access_groups; v_super_count integer;
begin
  perform public.require_perm('users.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  select * into v_group from public.access_groups where id = p_group_id;
  if not found then raise exception 'Grup pengguna tidak ditemukan'; end if;
  if not v_group.is_active and coalesce(p_active, true) then raise exception 'Grup tujuan sedang nonaktif'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Akun tidak ditemukan'; end if;
  select * into v_old from public.admin_members where user_id = p_user_id for update;
  if p_user_id = auth.uid() and found and (v_old.group_id is distinct from p_group_id or v_old.is_active is distinct from coalesce(p_active, true)) then
    raise exception 'Kamu tidak dapat mengubah grup atau status akunmu sendiri';
  end if;
  if found and (v_old.role = 'superadmin' or (select slug from public.access_groups where id = v_old.group_id) = 'superadmin')
     and ((select slug from public.access_groups where id = p_group_id) is distinct from 'superadmin' or not coalesce(p_active, true)) then
    select count(*) into v_super_count from public.admin_members m
    left join public.access_groups g on g.id = m.group_id
    where m.is_active and (m.role = 'superadmin' or g.slug = 'superadmin');
    if v_super_count <= 1 then raise exception 'Minimal harus ada satu Superadmin aktif'; end if;
  end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is not null then
    update public.profiles set full_name = btrim(p_full_name), updated_at = now() where id = p_user_id;
  end if;
  insert into public.admin_members (user_id, role, is_active, group_id, created_by)
  values (p_user_id, coalesce(v_group.role, 'program'), coalesce(p_active, true), p_group_id, auth.uid())
  on conflict (user_id) do update set group_id = excluded.group_id, is_active = excluded.is_active,
    role = coalesce((select role from public.access_groups where id = excluded.group_id), admin_members.role),
    updated_at = now();
  perform public.write_audit('users.update', 'admin_members', p_user_id,
    case when v_old.user_id is null then null else jsonb_build_object('role', v_old.role, 'group_id', v_old.group_id, 'is_active', v_old.is_active) end,
    jsonb_build_object('group_id', p_group_id, 'group', v_group.name, 'is_active', coalesce(p_active, true), 'full_name', nullif(btrim(coalesce(p_full_name, '')), '')), p_reason);
  if found and v_old.group_id is distinct from p_group_id then
    perform public.write_audit('USER_GROUP_CHANGED', 'admin_members', p_user_id,
      jsonb_build_object('group_id', v_old.group_id), jsonb_build_object('group_id', p_group_id, 'group', v_group.name), p_reason);
  end if;
end $$;

-- 8) Notifikasi "peserta baru" tidak boleh terkirim untuk akun admin hasil undangan
create or replace function public.notify_new_participant()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from auth.users u where u.id = new.id and u.raw_user_meta_data->>'invite_kind' = 'admin') then
    return new;
  end if;
  perform public.notify_admins('participants.view', 'participant.new', 'Peserta baru mendaftar', coalesce(nullif(new.full_name, ''), 'Peserta baru') || ' baru saja mendaftar.', '/admin/peserta');
  return new;
end $$;