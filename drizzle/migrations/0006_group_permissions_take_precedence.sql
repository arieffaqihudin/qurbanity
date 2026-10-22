create or replace function public.has_permission(_user_id uuid, _perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_members m
    left join public.access_groups g on g.id = m.group_id
    where m.user_id = _user_id and m.is_active and (
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

create or replace function public.my_admin_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
    where m.user_id = auth.uid() and m.is_active), 'null'::jsonb)
$$;