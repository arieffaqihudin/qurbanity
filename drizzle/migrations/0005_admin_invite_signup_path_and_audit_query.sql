-- Allow server-side admin invitations to create an account without participant KTP-style fields.
-- Participant signup validation (min age 17, required fields) is unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_birth date := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
  v_admin boolean := coalesce(new.raw_user_meta_data->>'invite_kind', '') = 'admin';
begin
  if v_admin then
    -- Admin accounts are invited by a SUPERADMIN; participant fields are placeholders
    -- until the person completes their own profile.
    insert into public.profiles (id, full_name, email, whatsapp, birth_date, address, whatsapp_consent, terms_accepted_at)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Admin'), new.email, '-', date '1970-01-01', '-', false, null);
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

-- Server-side audit query with user/group/result/date filters and accurate totals
CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_search text DEFAULT '', p_entity text DEFAULT '', p_source text DEFAULT '', p_result text DEFAULT '',
  p_user text DEFAULT '', p_group uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  v_total bigint;
  v_rows jsonb;
  v_search text := '%' || replace(replace(coalesce(p_search, ''), '%', '\%'), '_', '\_') || '%';
  v_user text := '%' || replace(replace(coalesce(p_user, ''), '%', '\%'), '_', '\_') || '%';
begin
  perform public.require_perm('audit.view');
  select count(*) into v_total
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  left join public.admin_members m on m.user_id = a.actor_id
  where (p_search is null or p_search = '' or a.action ilike v_search or coalesce(a.reason, '') ilike v_search)
    and (p_entity is null or p_entity = '' or a.entity = p_entity)
    and (p_source is null or p_source = '' or a.source = p_source)
    and (p_result is null or p_result = '' or a.result = p_result)
    and (p_user is null or p_user = '' or p.full_name ilike v_user or p.email ilike v_user)
    and (p_group is null or m.group_id = p_group)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at < p_to);
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'id', a.id, 'created_at', a.created_at, 'action', a.action, 'entity', a.entity, 'entity_id', a.entity_id,
      'result', a.result, 'source', a.source, 'reason', a.reason, 'ip_address', a.ip_address,
      'actor_name', p.full_name, 'actor_email', p.email, 'group_name', g.name,
      'has_detail', (a.old_values is not null or a.new_values is not null or a.metadata <> '{}'::jsonb)
    ) as row_data
    from public.audit_logs a
    left join public.profiles p on p.id = a.actor_id
    left join public.admin_members m on m.user_id = a.actor_id
    left join public.access_groups g on g.id = m.group_id
    where (p_search is null or p_search = '' or a.action ilike v_search or coalesce(a.reason, '') ilike v_search)
      and (p_entity is null or p_entity = '' or a.entity = p_entity)
      and (p_source is null or p_source = '' or a.source = p_source)
      and (p_result is null or p_result = '' or a.result = p_result)
      and (p_user is null or p_user = '' or p.full_name ilike v_user or p.email ilike v_user)
      and (p_group is null or m.group_id = p_group)
      and (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at < p_to)
    order by a.created_at desc
    limit greatest(1, least(coalesce(p_limit, 25), 1000)) offset greatest(0, coalesce(p_offset, 0))
  ) s;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;