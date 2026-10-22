-- 3. Audit result column (append-only table, additive)
ALTER TABLE public.audit_logs ADD COLUMN result text NOT NULL DEFAULT 'SUCCESS';

-- 4. In-app admin notifications (real events only, permission-scoped)
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_notifications_user_idx ON public.admin_notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notifications_select ON public.admin_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY admin_notifications_update ON public.admin_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_admins(_perm text, _kind text, _title text, _body text, _link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.admin_notifications (user_id, kind, title, body, link)
  select m.user_id, _kind, _title, _body, _link
  from public.admin_members m
  where m.is_active and public.has_permission(m.user_id, _perm);
end $$;

CREATE OR REPLACE FUNCTION public.notify_new_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public.notify_admins('participants.view', 'participant.new', 'Peserta baru mendaftar', coalesce(nullif(new.full_name, ''), 'Peserta baru') || ' baru saja mendaftar.', '/admin/peserta');
  return new;
end $$;
CREATE TRIGGER trg_notify_new_participant AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_new_participant();

CREATE OR REPLACE FUNCTION public.notify_new_commitment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public.notify_admins('participants.view', 'commitment.new', 'Komitmen baru dibuat', 'Komitmen ' || new.code || ' (' || new.shares || ' bagian) baru dibuat.', '/admin/peserta');
  return new;
end $$;
CREATE TRIGGER trg_notify_new_commitment AFTER INSERT ON public.qurban_commitments FOR EACH ROW EXECUTE FUNCTION public.notify_new_commitment();

CREATE OR REPLACE FUNCTION public.notify_new_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public.notify_admins('docs.publish', 'document.new', 'Dokumen menunggu verifikasi', 'Dokumen "' || new.title || '" baru diunggah.', '/admin/penyaluran');
  return new;
end $$;
CREATE TRIGGER trg_notify_new_document AFTER INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.notify_new_document();

CREATE OR REPLACE FUNCTION public.notify_new_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public.notify_admins('allocation.view', 'allocation.new', 'Alokasi baru dibuat', 'Satu alokasi hewan baru dibuat dan menunggu peninjauan.', '/admin/alokasi');
  return new;
end $$;
CREATE TRIGGER trg_notify_new_allocation AFTER INSERT ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.notify_new_allocation();

CREATE OR REPLACE FUNCTION public.notify_announcement_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  perform public.notify_admins('announcement.view', 'announcement.published', 'Pengumuman dipublikasikan', 'Pengumuman "' || new.title || '" telah dipublikasikan.', '/admin/pengumuman');
  return new;
end $$;
CREATE TRIGGER trg_notify_announcement_published AFTER UPDATE OF status ON public.announcements
FOR EACH ROW WHEN (new.status = 'published' AND old.status IS DISTINCT FROM 'published') EXECUTE FUNCTION public.notify_announcement_published();

-- 5. Known permission registry for server-side validation
CREATE OR REPLACE FUNCTION public.known_permissions()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select permission from public.role_permissions
  union select 'access.manage' union select 'users.manage' union select 'audit.export' union select 'admins.manage'
$$;

-- 6. Access group CRUD (SUPERADMIN-only via access.manage)
CREATE OR REPLACE FUNCTION public.admin_list_groups()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null or not (public.has_permission(auth.uid(), 'access.manage') or public.has_permission(auth.uid(), 'users.manage')) then
    raise exception 'Akses ditolak: kamu tidak memiliki izin untuk tindakan ini' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', g.id, 'slug', g.slug, 'name', g.name, 'description', g.description, 'role', g.role,
    'is_system', g.is_system, 'is_active', g.is_active, 'updated_at', g.updated_at,
    'members', (select count(*) from public.admin_members m where m.group_id = g.id and m.is_active),
    'permissions', coalesce((select jsonb_agg(gp.permission order by gp.permission) from public.access_group_permissions gp where gp.group_id = g.id), '[]'::jsonb)
  ) order by g.is_system desc, g.name) from public.access_groups g), '[]'::jsonb);
end $$;

CREATE OR REPLACE FUNCTION public.admin_save_group(p_id uuid, p jsonb, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_group public.access_groups;
  v_name text := nullif(btrim(coalesce(p->>'name', '')), '');
  v_desc text := coalesce(p->>'description', '');
  v_active boolean := coalesce((p->>'is_active')::boolean, true);
  v_perms text[] := coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p->'permissions', '[]'::jsonb)) as t(value)), '{}'::text[]);
  v_slug text;
  v_id uuid;
begin
  perform public.require_perm('access.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  if v_name is null or char_length(v_name) < 3 then raise exception 'Nama grup minimal 3 karakter'; end if;
  if exists (select 1 from unnest(v_perms) as up where up not in (select public.known_permissions())) then
    raise exception 'Ada hak akses yang tidak dikenal';
  end if;
  if p_id is null then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if exists (select 1 from public.access_groups where slug = v_slug) then v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4); end if;
    insert into public.access_groups (slug, name, description, is_system, is_active) values (v_slug, v_name, v_desc, false, v_active) returning id into v_id;
    insert into public.access_group_permissions (group_id, permission) select v_id, unnest(v_perms);
    perform public.write_audit('access.group_create', 'access_groups', v_id, null,
      jsonb_build_object('name', v_name, 'is_active', v_active, 'permissions', to_jsonb(v_perms)), p_reason);
    return v_id;
  end if;
  select * into v_group from public.access_groups where id = p_id for update;
  if not found then raise exception 'Grup tidak ditemukan'; end if;
  if v_group.slug = 'superadmin' and (not v_active or v_perms is distinct from array(select permission from public.access_group_permissions where group_id = p_id)) then
    raise exception 'Grup Superadmin tidak dapat dinonaktifkan atau diubah hak aksesnya';
  end if;
  update public.access_groups set name = v_name, description = v_desc, is_active = v_active, updated_at = now() where id = p_id;
  delete from public.access_group_permissions where group_id = p_id;
  insert into public.access_group_permissions (group_id, permission) select p_id, unnest(v_perms);
  perform public.write_audit('access.group_update', 'access_groups', p_id,
    jsonb_build_object('name', v_group.name, 'description', v_group.description, 'is_active', v_group.is_active),
    jsonb_build_object('name', v_name, 'description', v_desc, 'is_active', v_active, 'permissions', to_jsonb(v_perms)), p_reason);
  return p_id;
end $$;

CREATE OR REPLACE FUNCTION public.admin_duplicate_group(p_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_group public.access_groups; v_id uuid; v_slug text;
begin
  perform public.require_perm('access.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  select * into v_group from public.access_groups where id = p_id;
  if not found then raise exception 'Grup tidak ditemukan'; end if;
  v_slug := v_group.slug || '-salinan-' || substr(gen_random_uuid()::text, 1, 4);
  insert into public.access_groups (slug, name, description, is_system, is_active)
  values (v_slug, v_group.name || ' (salinan)', v_group.description, false, v_group.is_active) returning id into v_id;
  insert into public.access_group_permissions (group_id, permission)
  select v_id, permission from public.access_group_permissions where group_id = p_id;
  perform public.write_audit('access.group_duplicate', 'access_groups', v_id,
    jsonb_build_object('source', v_group.name), jsonb_build_object('name', v_group.name || ' (salinan)'), p_reason);
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.admin_delete_group(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_group public.access_groups;
begin
  perform public.require_perm('access.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  select * into v_group from public.access_groups where id = p_id for update;
  if not found then raise exception 'Grup tidak ditemukan'; end if;
  if v_group.is_system then raise exception 'Grup bawaan sistem tidak dapat dihapus'; end if;
  if exists (select 1 from public.admin_members where group_id = p_id and is_active) then
    raise exception 'Grup masih dipakai pengguna aktif. Pindahkan pengguna terlebih dahulu.';
  end if;
  delete from public.access_group_permissions where group_id = p_id;
  delete from public.access_groups where id = p_id;
  perform public.write_audit('access.group_delete', 'access_groups', p_id,
    jsonb_build_object('name', v_group.name, 'slug', v_group.slug), null, p_reason);
end $$;

-- 7. Admin user management
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT '', p_group uuid DEFAULT NULL, p_status text DEFAULT '', p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare v_total bigint; v_rows jsonb;
begin
  perform public.require_perm('users.manage');
  select count(*) into v_total
  from public.admin_members m join public.profiles p on p.id = m.user_id
  where (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
    and (p_group is null or m.group_id = p_group)
    and (p_status = '' or (p_status = 'active' and m.is_active) or (p_status = 'inactive' and not m.is_active));
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'user_id', m.user_id, 'full_name', p.full_name, 'email', p.email,
      'role', m.role, 'is_active', m.is_active, 'created_at', m.created_at,
      'group', case when g.id is null then null else jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name) end,
      'last_sign_in_at', u.last_sign_in_at
    ) as row_data
    from public.admin_members m
    join public.profiles p on p.id = m.user_id
    left join public.access_groups g on g.id = m.group_id
    left join auth.users u on u.id = m.user_id
    where (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
      and (p_group is null or m.group_id = p_group)
      and (p_status = '' or (p_status = 'active' and m.is_active) or (p_status = 'inactive' and not m.is_active))
    order by p.full_name
    limit greatest(1, least(coalesce(p_limit, 25), 100)) offset greatest(0, coalesce(p_offset, 0))
  ) s;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_full_name text, p_group_id uuid, p_active boolean, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    role = coalesce((select role from public.access_groups where id = excluded.group_id), admin_members.role);
  perform public.write_audit('users.update', 'admin_members', p_user_id,
    case when v_old.user_id is null then null else jsonb_build_object('role', v_old.role, 'group_id', v_old.group_id, 'is_active', v_old.is_active) end,
    jsonb_build_object('group_id', p_group_id, 'group', v_group.name, 'is_active', coalesce(p_active, true), 'full_name', nullif(btrim(coalesce(p_full_name, '')), '')), p_reason);
end $$;

CREATE OR REPLACE FUNCTION public.admin_user_activity(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform public.require_perm('users.manage');
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', a.id, 'action', a.action, 'entity', a.entity, 'result', a.result, 'reason', a.reason, 'created_at', a.created_at
  ) order by a.created_at desc) from (
    select * from public.audit_logs where actor_id = p_user_id order by created_at desc limit greatest(1, least(coalesce(p_limit, 20), 50))
  ) a), '[]'::jsonb);
end $$;