create type public.admin_role as enum ('superadmin', 'finance', 'program', 'field_officer', 'auditor', 'content');

create table public.admin_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.admin_role not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.role_permissions (
  role public.admin_role not null,
  permission text not null,
  primary key (role, permission)
);
grant select on public.admin_members, public.role_permissions to authenticated;
grant all on public.admin_members, public.role_permissions to service_role;
alter table public.admin_members enable row level security;
alter table public.role_permissions enable row level security;
create trigger admin_members_touch before update on public.admin_members for each row execute function public.touch_updated_at();

insert into public.role_permissions (role, permission) values
  ('superadmin', '*'),
  ('finance', 'dashboard.view'), ('finance', 'participants.view'), ('finance', 'finance.view'), ('finance', 'finance.manage'),
  ('finance', 'payments.config'), ('finance', 'reports.view'), ('finance', 'reports.export'), ('finance', 'catalog.view'),
  ('finance', 'allocation.view'), ('finance', 'program.view'),
  ('program', 'dashboard.view'), ('program', 'participants.view'), ('program', 'participants.edit'), ('program', 'catalog.view'),
  ('program', 'catalog.manage'), ('program', 'program.view'), ('program', 'program.manage'), ('program', 'allocation.view'),
  ('program', 'allocation.manage'), ('program', 'allocation.lock'), ('program', 'announcement.view'), ('program', 'announcement.manage'),
  ('program', 'journey.view'), ('program', 'journey.manage'), ('program', 'docs.upload'), ('program', 'docs.publish'),
  ('program', 'notifications.manage'), ('program', 'recovery.manage'), ('program', 'characters.manage'), ('program', 'reports.view'),
  ('program', 'settings.view'),
  ('field_officer', 'journey.view'), ('field_officer', 'docs.upload'),
  ('auditor', 'dashboard.view'), ('auditor', 'participants.view'), ('auditor', 'finance.view'), ('auditor', 'catalog.view'),
  ('auditor', 'program.view'), ('auditor', 'allocation.view'), ('auditor', 'announcement.view'), ('auditor', 'journey.view'),
  ('auditor', 'reports.view'), ('auditor', 'reports.export'), ('auditor', 'audit.view'), ('auditor', 'settings.view'),
  ('content', 'journey.view'), ('content', 'docs.upload'), ('content', 'docs.publish'), ('content', 'notifications.manage'),
  ('content', 'content.manage'), ('content', 'settings.view');

create or replace function public.has_permission(_user_id uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_members m join public.role_permissions rp on rp.role = m.role
    where m.user_id = _user_id and m.is_active and (rp.permission = _perm or rp.permission = '*')
  )
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_members where user_id = _user_id and is_active)
$$;
create or replace function public.my_admin_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('role', m.role, 'permissions',
      (select coalesce(jsonb_agg(rp.permission), '[]'::jsonb) from public.role_permissions rp where rp.role = m.role))
    from public.admin_members m where m.user_id = auth.uid() and m.is_active), 'null'::jsonb)
$$;
revoke execute on function public.has_permission(uuid, text), public.is_staff(uuid), public.my_admin_access() from public, anon;
grant execute on function public.has_permission(uuid, text), public.is_staff(uuid), public.my_admin_access() to authenticated;

create policy "staff read own membership" on public.admin_members for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'admins.manage') or public.has_permission(auth.uid(), 'audit.view'));
create policy "staff read permissions" on public.role_permissions for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.require_perm(_perm text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), _perm) then
    raise exception 'Akses ditolak: kamu tidak memiliki izin untuk tindakan ini' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.require_perm(text) from public, anon, authenticated;

alter table public.audit_logs add column if not exists source text not null default 'app',
  add column if not exists old_values jsonb, add column if not exists new_values jsonb,
  add column if not exists reason text, add column if not exists ip_address text;
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
drop policy if exists "admin audit read" on public.audit_logs;
create policy "audit read" on public.audit_logs for select to authenticated using (public.has_permission(auth.uid(), 'audit.view'));

create or replace function public.write_audit(_action text, _entity text, _entity_id uuid, _old jsonb, _new jsonb, _reason text, _meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text;
begin
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1);
  exception when others then v_ip := null; end;
  insert into public.audit_logs (actor_id, action, entity, entity_id, old_values, new_values, reason, metadata, source, ip_address)
  values (auth.uid(), _action, _entity, _entity_id, _old, _new, nullif(_reason, ''), coalesce(_meta, '{}'::jsonb),
          case when auth.uid() is null then 'system' else 'admin' end, nullif(btrim(v_ip), ''));
end $$;
revoke execute on function public.write_audit(text, text, uuid, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(lower(tg_table_name) || '.' || lower(tg_op), tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(old)->>'id')::uuid else (to_jsonb(new)->>'id')::uuid end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    current_setting('app.reason', true));
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

create policy "staff read profiles" on public.profiles for select to authenticated using (public.has_permission(auth.uid(), 'participants.view'));
drop policy if exists "own commitments" on public.qurban_commitments;
create policy "own commitments" on public.qurban_commitments for select to authenticated
  using (auth.uid() = user_id or public.has_permission(auth.uid(), 'participants.view') or public.has_permission(auth.uid(), 'allocation.view') or public.has_permission(auth.uid(), 'finance.view'));
drop policy if exists "own shares" on public.qurban_shares;
create policy "own shares" on public.qurban_shares for select to authenticated using (exists (
  select 1 from public.qurban_commitments c where c.id = qurban_shares.commitment_id
  and (c.user_id = auth.uid() or public.has_permission(auth.uid(), 'participants.view') or public.has_permission(auth.uid(), 'allocation.view'))));
drop policy if exists "own plans" on public.payment_plans;
create policy "own plans" on public.payment_plans for select to authenticated using (exists (
  select 1 from public.qurban_commitments c where c.id = payment_plans.commitment_id
  and (c.user_id = auth.uid() or public.has_permission(auth.uid(), 'participants.view'))));
drop policy if exists "own consents" on public.contract_consents;
create policy "own consents" on public.contract_consents for select to authenticated
  using (auth.uid() = user_id or public.has_permission(auth.uid(), 'participants.view'));
drop policy if exists "own pub read" on public.participant_publication_consents;
create policy "own pub read" on public.participant_publication_consents for select to authenticated
  using (auth.uid() = user_id or public.has_permission(auth.uid(), 'participants.view') or public.has_permission(auth.uid(), 'announcement.view'));
create policy "staff read notif" on public.notification_preferences for select to authenticated using (public.has_permission(auth.uid(), 'participants.view'));

alter table public.programs add column if not exists date_status text not null default 'estimated' check (date_status in ('estimated', 'official')),
  add column if not exists registration_opens_at timestamptz,
  add column if not exists minimum_payment bigint not null default 10000 check (minimum_payment >= 0),
  add column if not exists announcement_days int not null default 7 check (announcement_days between 1 and 60);
create unique index if not exists programs_one_open on public.programs ((true)) where status = 'open';
create policy "staff read programs" on public.programs for select to authenticated using (public.has_permission(auth.uid(), 'program.view') or public.has_permission(auth.uid(), 'dashboard.view'));

create or replace function public.validate_program() returns trigger language plpgsql set search_path = public as $$
begin
  if new.payment_deadline::date >= new.iduladha_date then raise exception 'Batas pelunasan harus sebelum tanggal Iduladha'; end if;
  if new.registration_opens_at is not null and new.registration_opens_at >= new.payment_deadline then
    raise exception 'Tanggal pembukaan pendaftaran harus sebelum batas pelunasan'; end if;
  if tg_op = 'INSERT' and exists (select 1 from public.programs p where p.iduladha_date >= new.iduladha_date or p.hijri_year >= new.hijri_year) then
    raise exception 'Periode baru harus setelah periode sebelumnya (tahun Hijriah dan tanggal Iduladha)'; end if;
  return new;
end $$;
create trigger programs_validate before insert or update on public.programs for each row execute function public.validate_program();
create trigger programs_audit after insert or update on public.programs for each row execute function public.audit_row_change();

create or replace function public.admin_save_program(p_id uuid, p jsonb, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('program.manage');
  perform set_config('app.reason', coalesce(p_reason, ''), true);
  if p_id is null then
    insert into public.programs (code, name, hijri_year, status, iduladha_date, date_status, registration_opens_at, payment_deadline, minimum_payment, announcement_days)
    values ('QRB-' || (p->>'hijri_year'), p->>'name', (p->>'hijri_year')::int, 'draft', (p->>'iduladha_date')::date, coalesce(p->>'date_status', 'estimated'),
            nullif(p->>'registration_opens_at', '')::timestamptz, (p->>'payment_deadline')::timestamptz,
            coalesce((p->>'minimum_payment')::bigint, 10000), coalesce((p->>'announcement_days')::int, 7))
    returning id into v_id;
  else
    update public.programs set name = p->>'name', iduladha_date = (p->>'iduladha_date')::date, date_status = coalesce(p->>'date_status', date_status),
      registration_opens_at = nullif(p->>'registration_opens_at', '')::timestamptz, payment_deadline = (p->>'payment_deadline')::timestamptz,
      minimum_payment = coalesce((p->>'minimum_payment')::bigint, minimum_payment), announcement_days = coalesce((p->>'announcement_days')::int, announcement_days)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Program tidak ditemukan'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_set_program_status(p_id uuid, p_status public.program_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('program.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  if p_status = 'open' and exists (select 1 from public.programs where status = 'open' and id <> p_id) then
    raise exception 'Hanya boleh ada satu periode yang dibuka. Tutup periode aktif terlebih dahulu.'; end if;
  perform set_config('app.reason', p_reason, true);
  update public.programs set status = p_status where id = p_id;
  if not found then raise exception 'Program tidak ditemukan'; end if;
end $$;

alter table public.animal_categories add column if not exists is_available boolean not null default true;
create policy "staff read categories" on public.animal_categories for select to authenticated using (public.has_permission(auth.uid(), 'catalog.view'));
create trigger categories_audit after insert or update on public.animal_categories for each row execute function public.audit_row_change();
create trigger prices_audit after insert on public.animal_prices for each row execute function public.audit_row_change();
create index if not exists animal_prices_final_idx on public.animal_prices (category_id, is_final, effective_from desc);

create or replace function public.current_price(_category_id uuid)
returns public.animal_prices language sql stable security definer set search_path = public as $$
  select * from public.animal_prices where category_id = _category_id and is_final and effective_from <= now()
  order by effective_from desc, created_at desc limit 1
$$;
revoke execute on function public.current_price(uuid) from public, anon, authenticated;

create or replace function public.admin_save_category(p_id uuid, p jsonb, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('catalog.manage');
  perform set_config('app.reason', coalesce(p_reason, ''), true);
  if p_id is null then
    insert into public.animal_categories (program_id, code, name, kind, max_shares, weight_range, description, sort_order, is_available)
    values ((p->>'program_id')::uuid, p->>'code', p->>'name', (p->>'kind')::public.animal_kind,
            case when p->>'kind' = 'kambing' then 1 else 7 end, p->>'weight_range', p->>'description',
            coalesce((p->>'sort_order')::int, 99), coalesce((p->>'is_available')::boolean, true))
    returning id into v_id;
  else
    update public.animal_categories set name = p->>'name', weight_range = p->>'weight_range', description = p->>'description',
      is_available = coalesce((p->>'is_available')::boolean, is_available), sort_order = coalesce((p->>'sort_order')::int, sort_order)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Kategori tidak ditemukan'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_add_price(p_category_id uuid, p_animal_cost bigint, p_operational_cost bigint, p_is_final boolean, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('catalog.manage');
  if p_animal_cost is null or p_animal_cost <= 0 then raise exception 'Harga hewan harus lebih dari 0'; end if;
  if p_operational_cost is null or p_operational_cost < 0 then raise exception 'Biaya operasional tidak boleh negatif'; end if;
  if char_length(coalesce(btrim(p_note), '')) < 5 then raise exception 'Catatan perubahan minimal 5 karakter'; end if;
  perform set_config('app.reason', p_note, true);
  insert into public.animal_prices (category_id, animal_cost, operational_cost, is_final, note, created_by)
  values (p_category_id, p_animal_cost, p_operational_cost, coalesce(p_is_final, false), p_note, auth.uid()) returning id into v_id;
  return v_id;
end $$;

do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid = 'public.qurban_commitments'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) like '%price_per_share_snapshot * shares%' loop
    execute format('alter table public.qurban_commitments drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.qurban_commitments add constraint qurban_commitments_total_components check (total_amount = animal_cost_snapshot + operational_cost_snapshot) not valid;

create or replace function public.share_component(_cost bigint, _shares int, _max int)
returns bigint language sql immutable set search_path = public as $$
  select ((_cost * _shares + _max - 1) / _max)::bigint
$$;

create or replace function public.create_commitment(p_category_id uuid, p_shares integer, p_shahibul text[], p_frequency payment_frequency, p_consents jsonb, p_publication publication_preference, p_user_agent text default null)
returns table(id uuid, code text) language plpgsql security definer set search_path = public as $function$
declare
  v_uid uuid := auth.uid();
  v_cat public.animal_categories; v_prog public.programs; v_price public.animal_prices;
  v_total bigint; v_animal bigint; v_ops bigint; v_round bigint;
  v_id uuid; v_code text; v_periods int; v_names text[]; v_name text; i int;
  v_cv public.contract_versions; v_dec text;
begin
  if v_uid is null then raise exception 'Kamu harus masuk terlebih dahulu'; end if;
  select * into v_cat from public.animal_categories c where c.id = p_category_id and c.is_active;
  if not found then raise exception 'Kategori hewan tidak ditemukan'; end if;
  if not v_cat.is_available then raise exception 'Kategori ini sedang tidak tersedia'; end if;
  select * into v_prog from public.programs p where p.id = v_cat.program_id;
  if v_prog.status <> 'open' then raise exception 'Program sedang tidak menerima komitmen baru'; end if;
  if v_prog.registration_opens_at is not null and now() < v_prog.registration_opens_at then raise exception 'Pendaftaran program belum dibuka'; end if;
  if now() >= v_prog.payment_deadline then raise exception 'Batas pelunasan program telah lewat'; end if;
  v_price := public.current_price(v_cat.id);
  if v_price.id is null then raise exception 'Harga final kategori ini belum ditetapkan'; end if;
  if p_shares is null or p_shares < 1 or p_shares > v_cat.max_shares then raise exception 'Jumlah bagian tidak valid untuk kategori ini'; end if;

  select array_agg(btrim(n)) into v_names from unnest(coalesce(p_shahibul, '{}')) n where btrim(n) <> '';
  if coalesce(array_length(v_names, 1), 0) <> p_shares then raise exception 'Jumlah nama shahibul harus sama dengan jumlah bagian'; end if;
  foreach v_name in array v_names loop
    if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Nama shahibul harus 2–120 karakter'; end if;
  end loop;

  select * into v_cv from public.contract_versions cv where cv.program_id = v_prog.id and cv.contract_code = 'akad_1' and cv.is_active order by created_at desc limit 1;
  if not found then raise exception 'Akad 1 belum tersedia'; end if;
  if coalesce(p_consents->>v_cv.id::text, '') <> 'accepted' then raise exception 'Akad 1 wajib disetujui'; end if;

  v_animal := public.share_component(v_price.animal_cost, p_shares, v_cat.max_shares);
  v_ops := public.share_component(v_price.operational_cost, p_shares, v_cat.max_shares);
  v_total := v_animal + v_ops;
  v_round := (v_animal - (v_price.animal_cost * p_shares / v_cat.max_shares)) + (v_ops - (v_price.operational_cost * p_shares / v_cat.max_shares));

  loop
    v_code := 'QBN-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from public.qurban_commitments q where q.code = v_code);
  end loop;

  insert into public.qurban_commitments (code, user_id, program_id, category_id, price_id, category_name_snapshot, animal_kind_snapshot,
    shares, price_per_share_snapshot, animal_cost_snapshot, operational_cost_snapshot, rounding_adjustment, total_amount)
  values (v_code, v_uid, v_prog.id, v_cat.id, v_price.id, v_cat.name, v_cat.kind, p_shares, (v_total + p_shares - 1) / p_shares, v_animal, v_ops, v_round, v_total)
  returning qurban_commitments.id into v_id;

  for i in 1..p_shares loop
    insert into public.qurban_shares (commitment_id, position, shahibul_name) values (v_id, i, v_names[i]);
  end loop;

  v_periods := public.count_periods(p_frequency, now(), v_prog.payment_deadline);
  insert into public.payment_plans (commitment_id, frequency, periods, suggested_amount, deadline)
  values (v_id, p_frequency, v_periods, case when v_periods > 0 then (ceil(v_total::numeric / v_periods / 1000) * 1000)::bigint else v_total end, v_prog.payment_deadline);

  for v_cv in select * from public.contract_versions cv where cv.program_id = v_prog.id and cv.is_active loop
    v_dec := coalesce(p_consents->>v_cv.id::text, '');
    if v_dec not in ('accepted', 'declined') then raise exception 'Keputusan untuk % wajib diisi', v_cv.title; end if;
    if v_cv.is_mandatory and v_dec <> 'accepted' then raise exception '% wajib disetujui', v_cv.title; end if;
    insert into public.contract_consents (user_id, commitment_id, contract_version_id, contract_code, contract_version, contract_status_at_consent, decision, user_agent)
    values (v_uid, v_id, v_cv.id, v_cv.contract_code, v_cv.version, v_cv.status, v_dec::public.consent_decision, left(p_user_agent, 300));
  end loop;

  insert into public.participant_publication_consents (user_id, commitment_id, preference) values (v_uid, v_id, p_publication);
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata, source)
  values (v_uid, 'commitment.create', 'qurban_commitment', v_id, jsonb_build_object('code', v_code, 'total', v_total, 'price_id', v_price.id, 'shares', p_shares), 'participant');

  return query select v_id, v_code;
end $function$;

alter table public.contract_versions add column if not exists contract_type text,
  add column if not exists sharia_reviewer text, add column if not exists legal_reviewer text,
  add column if not exists review_notes text, add column if not exists approved_by uuid,
  add column if not exists requires_reconsent boolean not null default false,
  add column if not exists created_by uuid;
update public.contract_versions set contract_type = case contract_code when 'akad_1' then 'purchase' when 'akad_2a' then 'excess_allocation' else 'sedekah_transfer' end
where contract_type is null;
create trigger contracts_audit after insert or update on public.contract_versions for each row execute function public.audit_row_change();

create or replace function public.protect_contract_version() returns trigger language plpgsql set search_path = public as $$
begin
  if (new.body <> old.body or new.title <> old.title or new.summary <> old.summary or new.version <> old.version or new.contract_code <> old.contract_code)
     and (old.status <> 'draft' or exists (select 1 from public.contract_consents c where c.contract_version_id = old.id)) then
    raise exception 'Versi akad yang sudah disetujui atau sudah disepakati peserta tidak dapat diubah. Buat versi baru.';
  end if;
  return new;
end $$;
create trigger contracts_protect before update on public.contract_versions for each row execute function public.protect_contract_version();

create or replace function public.admin_save_contract_draft(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text := p->>'contract_code';
begin
  perform public.require_perm('program.manage');
  if v_code not in ('akad_1', 'akad_2a', 'akad_2b') then raise exception 'Jenis akad tidak valid'; end if;
  if char_length(coalesce(p->>'body', '')) < 20 then raise exception 'Isi akad minimal 20 karakter'; end if;
  if p_id is null then
    insert into public.contract_versions (program_id, contract_code, contract_type, version, title, summary, body, status, is_active, is_mandatory, requires_reconsent, created_by)
    values ((p->>'program_id')::uuid, v_code, case v_code when 'akad_1' then 'purchase' when 'akad_2a' then 'excess_allocation' else 'sedekah_transfer' end,
            p->>'version', p->>'title', p->>'summary', p->>'body', 'draft', false, v_code = 'akad_1',
            coalesce((p->>'requires_reconsent')::boolean, false), auth.uid())
    returning id into v_id;
  else
    update public.contract_versions set title = p->>'title', summary = p->>'summary', body = p->>'body', version = p->>'version',
      requires_reconsent = coalesce((p->>'requires_reconsent')::boolean, requires_reconsent)
    where id = p_id and status = 'draft' returning id into v_id;
    if v_id is null then raise exception 'Hanya draf yang dapat diedit'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_approve_contract(p_id uuid, p_sharia_reviewer text, p_legal_reviewer text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.contract_versions;
begin
  perform public.require_perm('program.manage');
  if char_length(coalesce(btrim(p_sharia_reviewer), '')) < 3 or char_length(coalesce(btrim(p_legal_reviewer), '')) < 3 then
    raise exception 'Nama peninjau syariah dan hukum wajib diisi'; end if;
  select * into v from public.contract_versions where id = p_id for update;
  if not found then raise exception 'Versi akad tidak ditemukan'; end if;
  if v.status <> 'draft' then raise exception 'Hanya draf yang dapat disetujui'; end if;
  perform set_config('app.reason', coalesce(p_notes, 'Persetujuan akad'), true);
  update public.contract_versions set is_active = false where program_id = v.program_id and contract_code = v.contract_code and is_active and id <> p_id;
  update public.contract_versions set status = 'approved', is_active = true, approved_at = now(), approved_by = auth.uid(),
    sharia_reviewer = btrim(p_sharia_reviewer), legal_reviewer = btrim(p_legal_reviewer), review_notes = p_notes
  where id = p_id;
end $$;

create or replace function public.admin_reconsent_candidates(p_program_id uuid)
returns table(contract_code text, active_version text, requires_reconsent boolean, affected_commitments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_perm('program.view');
  return query
  select cv.contract_code, cv.version, cv.requires_reconsent,
    (select count(distinct cc.commitment_id) from public.contract_consents cc
     where cc.contract_code = cv.contract_code and cc.contract_version_id <> cv.id
       and not exists (select 1 from public.contract_consents c2 where c2.commitment_id = cc.commitment_id and c2.contract_version_id = cv.id))
  from public.contract_versions cv where cv.program_id = p_program_id and cv.is_active;
end $$;

create or replace function public.admin_correct_profile(p_user_id uuid, p_changes jsonb, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old public.profiles; v_new public.profiles; k text;
begin
  perform public.require_perm('participants.edit');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan koreksi minimal 5 karakter'; end if;
  for k in select jsonb_object_keys(p_changes) loop
    if k not in ('full_name', 'whatsapp', 'address', 'birth_date') then raise exception 'Kolom % tidak dapat dikoreksi', k; end if;
  end loop;
  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Peserta tidak ditemukan'; end if;
  if p_changes ? 'full_name' and char_length(btrim(p_changes->>'full_name')) < 3 then raise exception 'Nama minimal 3 karakter'; end if;
  if p_changes ? 'whatsapp' and (p_changes->>'whatsapp') !~ '^\+628[0-9]{7,12}$' then raise exception 'Nomor WhatsApp harus berformat +628…'; end if;
  if p_changes ? 'address' and char_length(btrim(p_changes->>'address')) < 10 then raise exception 'Alamat minimal 10 karakter'; end if;
  if p_changes ? 'birth_date' and (p_changes->>'birth_date')::date > (current_date - interval '17 years')::date then raise exception 'Usia minimal peserta adalah 17 tahun'; end if;
  update public.profiles set
    full_name = coalesce(btrim(p_changes->>'full_name'), full_name), whatsapp = coalesce(p_changes->>'whatsapp', whatsapp),
    address = coalesce(btrim(p_changes->>'address'), address), birth_date = coalesce((p_changes->>'birth_date')::date, birth_date)
  where id = p_user_id returning * into v_new;
  perform public.write_audit('participant.correct', 'profiles', p_user_id,
    jsonb_build_object('full_name', v_old.full_name, 'whatsapp', v_old.whatsapp, 'address', v_old.address, 'birth_date', v_old.birth_date),
    jsonb_build_object('full_name', v_new.full_name, 'whatsapp', v_new.whatsapp, 'address', v_new.address, 'birth_date', v_new.birth_date), p_reason);
end $$;

create or replace function public.admin_correct_shahibul(p_share_id uuid, p_name text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; v_cid uuid;
begin
  perform public.require_perm('participants.edit');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan koreksi minimal 5 karakter'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then raise exception 'Nama shahibul harus 2–120 karakter'; end if;
  select s.shahibul_name, s.commitment_id into v_old, v_cid from public.qurban_shares s where s.id = p_share_id for update;
  if not found then raise exception 'Data shahibul tidak ditemukan'; end if;
  if exists (select 1 from public.allocations a join public.animal_units u on u.id = a.unit_id where a.commitment_id = v_cid and a.is_active and u.status = 'locked') then
    raise exception 'Alokasi sudah dikunci; nama shahibul tidak dapat dikoreksi'; end if;
  update public.qurban_shares set shahibul_name = btrim(p_name) where id = p_share_id;
  perform public.write_audit('shahibul.correct', 'qurban_shares', p_share_id, jsonb_build_object('shahibul_name', v_old), jsonb_build_object('shahibul_name', btrim(p_name)), p_reason);
end $$;

create type public.ledger_account as enum ('EXTERNAL', 'COMMITMENT', 'ANIMAL', 'OPERATIONAL', 'SEDEKAH', 'EXCESS', 'KUASA', 'REFUND', 'CANCEL_COST', 'USED');
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  source_account public.ledger_account not null,
  dest_account public.ledger_account not null,
  amount bigint not null check (amount > 0),
  commitment_id uuid references public.qurban_commitments(id) on delete restrict,
  program_id uuid references public.programs(id) on delete restrict,
  reference text not null,
  basis text not null,
  idempotency_key text not null unique,
  actor_id uuid,
  system_source text,
  reverses_id uuid references public.ledger_entries(id),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  check (source_account <> dest_account),
  check (actor_id is not null or system_source is not null)
);
create index on public.ledger_entries (commitment_id);
create index on public.ledger_entries (created_at desc);
create index on public.ledger_entries (source_account);
create index on public.ledger_entries (dest_account);
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;
alter table public.ledger_entries enable row level security;
create policy "finance read ledger" on public.ledger_entries for select to authenticated using (public.has_permission(auth.uid(), 'finance.view'));
create trigger ledger_immutable before update or delete on public.ledger_entries for each row execute function public.prevent_mutation();

create or replace function public.post_ledger(_src public.ledger_account, _dst public.ledger_account, _amount bigint, _commitment uuid,
  _reference text, _basis text, _key text, _system text default null, _reverses uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal bigint; v_prog uuid;
begin
  select id into v_id from public.ledger_entries where idempotency_key = _key;
  if found then return v_id; end if;
  if _amount is null or _amount <= 0 then raise exception 'Nominal posting harus lebih dari 0'; end if;
  if coalesce(btrim(_basis), '') = '' or coalesce(btrim(_reference), '') = '' then raise exception 'Referensi dan dasar posting wajib diisi'; end if;
  perform pg_advisory_xact_lock(hashtext('ledger:' || _src::text || ':' || coalesce(_commitment::text, '-')));
  if _src <> 'EXTERNAL' then
    select coalesce(sum(case when dest_account = _src then amount else 0 end) - sum(case when source_account = _src then amount else 0 end), 0)
      into v_bal from public.ledger_entries where (source_account = _src or dest_account = _src) and commitment_id is not distinct from _commitment;
    if v_bal < _amount then raise exception 'Saldo akun % tidak mencukupi (saldo %, dibutuhkan %)', _src, v_bal, _amount; end if;
  end if;
  if _commitment is not null then select program_id into v_prog from public.qurban_commitments where id = _commitment; end if;
  insert into public.ledger_entries (source_account, dest_account, amount, commitment_id, program_id, reference, basis, idempotency_key, actor_id, system_source, reverses_id)
  values (_src, _dst, _amount, _commitment, v_prog, _reference, _basis, _key, auth.uid(), coalesce(_system, case when auth.uid() is null then 'system' end), _reverses)
  returning id into v_id;
  perform public.write_audit('ledger.post', 'ledger_entries', v_id, null,
    jsonb_build_object('source', _src, 'dest', _dst, 'amount', _amount, 'commitment_id', _commitment, 'reference', _reference), _basis);
  return v_id;
end $$;
revoke execute on function public.post_ledger(public.ledger_account, public.ledger_account, bigint, uuid, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.admin_reverse_entry(p_entry_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.ledger_entries;
begin
  perform public.require_perm('finance.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan pembalikan minimal 5 karakter'; end if;
  select * into e from public.ledger_entries where id = p_entry_id;
  if not found then raise exception 'Entri tidak ditemukan'; end if;
  if e.reverses_id is not null then raise exception 'Entri pembalik tidak dapat dibalik lagi'; end if;
  return public.post_ledger(e.dest_account, e.source_account, e.amount, e.commitment_id, 'REV-' || e.reference, 'Pembalikan: ' || p_reason, 'reverse:' || e.id, null, e.id);
end $$;

create or replace function public.admin_ledger_balances(p_program_id uuid default null)
returns table(account public.ledger_account, balance bigint, entries bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_perm('finance.view');
  return query
  select a.acc, coalesce((select sum(amount) from public.ledger_entries where dest_account = a.acc and (p_program_id is null or program_id = p_program_id)), 0)::bigint
    - coalesce((select sum(amount) from public.ledger_entries where source_account = a.acc and (p_program_id is null or program_id = p_program_id)), 0)::bigint,
    (select count(*) from public.ledger_entries where (dest_account = a.acc or source_account = a.acc) and (p_program_id is null or program_id = p_program_id))
  from unnest(enum_range(null::public.ledger_account)) as a(acc);
end $$;

create type public.unit_status as enum ('draft', 'final', 'locked');
create table public.animal_units (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  category_id uuid not null references public.animal_categories(id) on delete restrict,
  code text not null unique,
  estimated_weight text,
  details text,
  status public.unit_status not null default 'draft',
  locked_at timestamptz,
  locked_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.animal_units (program_id, status);
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.animal_units(id) on delete restrict,
  commitment_id uuid not null references public.qurban_commitments(id) on delete restrict,
  shares int not null check (shares between 1 and 7),
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid,
  removed_reason text
);
create unique index allocations_one_active on public.allocations (commitment_id) where is_active;
create index on public.allocations (unit_id) where is_active;
grant select on public.animal_units, public.allocations to authenticated;
grant all on public.animal_units, public.allocations to service_role;
alter table public.animal_units enable row level security;
alter table public.allocations enable row level security;
create policy "staff read units" on public.animal_units for select to authenticated using (public.has_permission(auth.uid(), 'allocation.view'));
create policy "staff read allocations" on public.allocations for select to authenticated using (public.has_permission(auth.uid(), 'allocation.view'));
create policy "own allocations" on public.allocations for select to authenticated using (exists (select 1 from public.qurban_commitments c where c.id = allocations.commitment_id and c.user_id = auth.uid()));
create policy "own units" on public.animal_units for select to authenticated using (exists (
  select 1 from public.allocations a join public.qurban_commitments c on c.id = a.commitment_id where a.unit_id = animal_units.id and a.is_active and c.user_id = auth.uid()));
create trigger units_touch before update on public.animal_units for each row execute function public.touch_updated_at();
create trigger units_audit after insert or update on public.animal_units for each row execute function public.audit_row_change();
create trigger allocations_audit after insert or update on public.allocations for each row execute function public.audit_row_change();

create or replace function public.admin_create_unit(p_program_id uuid, p_category_id uuid, p_code text, p_weight text, p_details text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('allocation.manage');
  if coalesce(btrim(p_code), '') !~ '^[A-Za-z0-9\-]{3,30}$' then raise exception 'Kode hewan 3–30 karakter (huruf, angka, tanda -)'; end if;
  if not exists (select 1 from public.animal_categories where id = p_category_id and program_id = p_program_id) then
    raise exception 'Kategori tidak termasuk program ini'; end if;
  insert into public.animal_units (program_id, category_id, code, estimated_weight, details, created_by)
  values (p_program_id, p_category_id, upper(btrim(p_code)), p_weight, p_details, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_allocate(p_unit_id uuid, p_commitment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare u public.animal_units; c public.qurban_commitments; cap int; used int; v_id uuid;
begin
  perform public.require_perm('allocation.manage');
  select * into u from public.animal_units where id = p_unit_id for update;
  if not found then raise exception 'Unit hewan tidak ditemukan'; end if;
  if u.status <> 'draft' then raise exception 'Unit sudah final/terkunci; kembalikan ke draf untuk mengubah alokasi'; end if;
  select * into c from public.qurban_commitments where id = p_commitment_id for update;
  if not found then raise exception 'Komitmen tidak ditemukan'; end if;
  if c.payment_status <> 'lunas' then raise exception 'Hanya komitmen yang sudah lunas (terverifikasi) yang dapat dialokasikan'; end if;
  if c.execution_status = 'dibatalkan' then raise exception 'Komitmen dibatalkan tidak dapat dialokasikan'; end if;
  if c.program_id <> u.program_id or c.category_id <> u.category_id then raise exception 'Komitmen harus dari program dan kategori yang sama dengan unit'; end if;
  if exists (select 1 from public.allocations where commitment_id = p_commitment_id and is_active) then raise exception 'Komitmen ini sudah dialokasikan'; end if;
  select max_shares into cap from public.animal_categories where id = u.category_id;
  select coalesce(sum(shares), 0) into used from public.allocations where unit_id = p_unit_id and is_active;
  if used + c.shares > cap then raise exception 'Kapasitas unit terlampaui (terisi %, ditambah %, maksimal %)', used, c.shares, cap; end if;
  insert into public.allocations (unit_id, commitment_id, shares, created_by) values (p_unit_id, p_commitment_id, c.shares, auth.uid()) returning id into v_id;
  update public.qurban_commitments set animal_label = u.code where id = p_commitment_id;
  return v_id;
end $$;

create or replace function public.admin_remove_allocation(p_allocation_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.allocations; u public.animal_units;
begin
  perform public.require_perm('allocation.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  select * into a from public.allocations where id = p_allocation_id and is_active for update;
  if not found then raise exception 'Alokasi aktif tidak ditemukan'; end if;
  select * into u from public.animal_units where id = a.unit_id for update;
  if u.status <> 'draft' then raise exception 'Unit sudah final/terkunci'; end if;
  perform set_config('app.reason', p_reason, true);
  update public.allocations set is_active = false, removed_at = now(), removed_by = auth.uid(), removed_reason = p_reason where id = a.id;
  update public.qurban_commitments set animal_label = null where id = a.commitment_id;
end $$;

create or replace function public.admin_set_unit_status(p_unit_id uuid, p_status public.unit_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare u public.animal_units; cap int; used int;
begin
  perform public.require_perm('allocation.manage');
  if p_status = 'locked' then raise exception 'Gunakan proses penguncian alokasi'; end if;
  select * into u from public.animal_units where id = p_unit_id for update;
  if not found then raise exception 'Unit hewan tidak ditemukan'; end if;
  if u.status = 'locked' then raise exception 'Unit terkunci tidak dapat diubah'; end if;
  if p_status = 'final' then
    select max_shares into cap from public.animal_categories where id = u.category_id;
    select coalesce(sum(shares), 0) into used from public.allocations where unit_id = p_unit_id and is_active;
    if used <> cap then raise exception 'Unit belum penuh (terisi % dari %); tidak dapat difinalkan', used, cap; end if;
  elsif char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan mengembalikan ke draf minimal 5 karakter';
  end if;
  perform set_config('app.reason', coalesce(p_reason, ''), true);
  update public.animal_units set status = p_status where id = p_unit_id;
end $$;

create or replace function public.admin_lock_unit(p_unit_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare u public.animal_units; a record; v_bal bigint;
begin
  perform public.require_perm('allocation.lock');
  select * into u from public.animal_units where id = p_unit_id for update;
  if not found then raise exception 'Unit hewan tidak ditemukan'; end if;
  if u.status = 'locked' then return; end if;
  if u.status <> 'final' then raise exception 'Unit harus berstatus FINAL sebelum dikunci'; end if;
  for a in select al.id, c.id cid, c.code, c.animal_cost_snapshot, c.operational_cost_snapshot, c.total_amount
           from public.allocations al join public.qurban_commitments c on c.id = al.commitment_id where al.unit_id = p_unit_id and al.is_active loop
    select coalesce(sum(case when dest_account = 'COMMITMENT' then amount else 0 end) - sum(case when source_account = 'COMMITMENT' then amount else 0 end), 0)
      into v_bal from public.ledger_entries where commitment_id = a.cid;
    if v_bal < a.total_amount then
      raise exception 'Dana terverifikasi di ledger untuk % belum mencukupi (saldo %, dibutuhkan %). Penguncian membutuhkan pembayaran terverifikasi.', a.code, v_bal, a.total_amount;
    end if;
    perform public.post_ledger('COMMITMENT', 'ANIMAL', a.animal_cost_snapshot, a.cid, 'LOCK-' || u.code || '-' || a.code, 'Akad 1: penguncian alokasi hewan ' || u.code, 'lock:animal:' || a.id);
    if a.operational_cost_snapshot > 0 then
      perform public.post_ledger('COMMITMENT', 'OPERATIONAL', a.operational_cost_snapshot, a.cid, 'LOCK-' || u.code || '-' || a.code, 'Akad 1: biaya operasional ' || u.code, 'lock:ops:' || a.id);
    end if;
    update public.qurban_commitments set execution_status = 'dialokasikan' where id = a.cid and execution_status = 'menunggu';
  end loop;
  update public.animal_units set status = 'locked', locked_at = now(), locked_by = auth.uid() where id = p_unit_id;
end $$;

create type public.announcement_status as enum ('draft', 'approved', 'scheduled', 'published', 'withdrawn');
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  version int not null,
  title text not null,
  status public.announcement_status not null default 'draft',
  snapshot jsonb not null default '[]'::jsonb,
  unlocked_warning int not null default 0,
  scheduled_at timestamptz,
  approved_at timestamptz, approved_by uuid,
  published_at timestamptz, published_by uuid,
  withdrawn_at timestamptz, withdrawn_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, version)
);
grant select on public.announcements to anon, authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "public read published announcements" on public.announcements for select to anon, authenticated
  using (status = 'published' or (status = 'scheduled' and scheduled_at <= now()));
create policy "staff read announcements" on public.announcements for select to authenticated using (public.has_permission(auth.uid(), 'announcement.view'));
create trigger announcements_touch before update on public.announcements for each row execute function public.touch_updated_at();
create trigger announcements_audit after insert or update on public.announcements for each row execute function public.audit_row_change();
create or replace function public.freeze_announcement() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> 'draft' and (new.snapshot <> old.snapshot or new.title <> old.title) then
    raise exception 'Snapshot pengumuman yang sudah disetujui dibekukan; buat versi baru'; end if;
  return new;
end $$;
create trigger announcements_freeze before update on public.announcements for each row execute function public.freeze_announcement();

create or replace function public.mask_name(_n text) returns text language sql immutable set search_path = public as $$
  select string_agg(left(w, 1) || repeat('*', greatest(char_length(w) - 1, 2)), ' ') from regexp_split_to_table(btrim(_n), '\s+') w
$$;

create or replace function public.admin_generate_announcement(p_program_id uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_snapshot jsonb; v_unlocked int; v_ver int; v_id uuid;
begin
  perform public.require_perm('announcement.manage');
  select count(*) into v_unlocked from public.animal_units where program_id = p_program_id and status <> 'locked';
  select coalesce(jsonb_agg(jsonb_build_object('unit_code', u.code, 'category', cat.name, 'names', (
      select coalesce(jsonb_agg(case coalesce(pp.preference, 'private')
          when 'full' then s.shahibul_name when 'masked' then public.mask_name(s.shahibul_name) else 'Shahibul (privat)' end
          order by c.code, s.position), '[]'::jsonb)
      from public.allocations a join public.qurban_commitments c on c.id = a.commitment_id
      join public.qurban_shares s on s.commitment_id = c.id
      left join lateral (select preference from public.participant_publication_consents x where x.commitment_id = c.id order by x.created_at desc limit 1) pp on true
      where a.unit_id = u.id and a.is_active)) order by cat.sort_order, u.code), '[]'::jsonb)
  into v_snapshot
  from public.animal_units u join public.animal_categories cat on cat.id = u.category_id
  where u.program_id = p_program_id and u.status = 'locked';
  select coalesce(max(version), 0) + 1 into v_ver from public.announcements where program_id = p_program_id;
  insert into public.announcements (program_id, version, title, snapshot, unlocked_warning, created_by)
  values (p_program_id, v_ver, coalesce(nullif(btrim(p_title), ''), 'Pengumuman Kelompok Hewan Kurban'), v_snapshot, v_unlocked, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_announcement_transition(p_id uuid, p_to public.announcement_status, p_reason text default null, p_scheduled_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.announcements;
begin
  perform public.require_perm('announcement.manage');
  select * into a from public.announcements where id = p_id for update;
  if not found then raise exception 'Pengumuman tidak ditemukan'; end if;
  if not ((a.status = 'draft' and p_to = 'approved') or (a.status = 'approved' and p_to in ('scheduled', 'published'))
       or (a.status = 'scheduled' and p_to = 'published') or (a.status in ('approved', 'scheduled', 'published') and p_to = 'withdrawn')) then
    raise exception 'Perubahan status dari % ke % tidak diizinkan', a.status, p_to; end if;
  if p_to = 'approved' and jsonb_array_length(a.snapshot) = 0 then raise exception 'Snapshot kosong: belum ada unit hewan terkunci'; end if;
  if p_to = 'scheduled' and (p_scheduled_at is null or p_scheduled_at <= now()) then raise exception 'Jadwal publikasi harus di masa depan'; end if;
  if p_to = 'withdrawn' and char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan penarikan minimal 5 karakter'; end if;
  if p_to = 'published' and exists (select 1 from public.announcements where program_id = a.program_id and id <> a.id and status = 'published') then
    update public.announcements set status = 'withdrawn', withdrawn_at = now(), withdrawn_reason = 'Digantikan versi ' || a.version
    where program_id = a.program_id and id <> a.id and status = 'published';
  end if;
  perform set_config('app.reason', coalesce(p_reason, ''), true);
  update public.announcements set status = p_to,
    approved_at = case when p_to = 'approved' then now() else approved_at end, approved_by = case when p_to = 'approved' then auth.uid() else approved_by end,
    scheduled_at = case when p_to = 'scheduled' then p_scheduled_at else scheduled_at end,
    published_at = case when p_to = 'published' then now() else published_at end, published_by = case when p_to = 'published' then auth.uid() else published_by end,
    withdrawn_at = case when p_to = 'withdrawn' then now() else withdrawn_at end, withdrawn_reason = case when p_to = 'withdrawn' then p_reason else withdrawn_reason end
  where id = p_id;
end $$;

create table public.journey_stages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  stage int not null check (stage between 1 and 4),
  status text not null default 'pending' check (status in ('pending', 'verified')),
  stage_date date,
  location text,
  notes text,
  responsible_id uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, stage)
);
create type public.doc_category as enum ('animal_photo', 'preparation', 'slaughter', 'distribution', 'beneficiaries', 'supporting', 'impact_report');
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  stage int check (stage between 1 and 4),
  category public.doc_category not null,
  title text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  visibility text not null default 'draft' check (visibility in ('draft', 'published')),
  privacy_confirmed boolean not null check (privacy_confirmed),
  uploaded_by uuid not null,
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.documents (program_id, visibility);
grant select on public.journey_stages, public.documents to authenticated;
grant all on public.journey_stages, public.documents to service_role;
alter table public.journey_stages enable row level security;
alter table public.documents enable row level security;
create policy "read journey" on public.journey_stages for select to authenticated using (
  public.has_permission(auth.uid(), 'journey.view') or exists (select 1 from public.qurban_commitments c where c.program_id = journey_stages.program_id and c.user_id = auth.uid()));
create policy "staff read documents" on public.documents for select to authenticated using (public.has_permission(auth.uid(), 'journey.view') or public.has_permission(auth.uid(), 'docs.upload'));
create policy "participant read published documents" on public.documents for select to authenticated using (
  visibility = 'published' and exists (select 1 from public.qurban_commitments c where c.program_id = documents.program_id and c.user_id = auth.uid()));
create trigger journey_touch before update on public.journey_stages for each row execute function public.touch_updated_at();
create trigger journey_audit after insert or update on public.journey_stages for each row execute function public.audit_row_change();
create trigger documents_audit after insert or update on public.documents for each row execute function public.audit_row_change();

create or replace function public.admin_verify_stage(p_program_id uuid, p_stage int, p_date date, p_location text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('journey.manage');
  if p_stage not between 1 and 4 then raise exception 'Tahap tidak valid'; end if;
  if p_date is null or char_length(coalesce(btrim(p_location), '')) < 3 then raise exception 'Verifikasi membutuhkan tanggal dan lokasi'; end if;
  if p_date > (now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal verifikasi tidak boleh di masa depan'; end if;
  if p_stage > 1 and not exists (select 1 from public.journey_stages where program_id = p_program_id and stage = p_stage - 1 and status = 'verified') then
    raise exception 'Tahap sebelumnya harus diverifikasi terlebih dahulu'; end if;
  if exists (select 1 from public.journey_stages where program_id = p_program_id and stage = p_stage and status = 'verified') then
    raise exception 'Tahap ini sudah diverifikasi'; end if;
  if p_stage = 4 and not exists (select 1 from public.documents where program_id = p_program_id and category = 'distribution' and visibility = 'published') then
    raise exception 'Laporan dampak membutuhkan dokumentasi distribusi yang sudah dipublikasikan'; end if;
  insert into public.journey_stages (program_id, stage, status, stage_date, location, notes, responsible_id, verified_by, verified_at)
  values (p_program_id, p_stage, 'verified', p_date, btrim(p_location), p_notes, auth.uid(), auth.uid(), now())
  on conflict (program_id, stage) do update set status = 'verified', stage_date = excluded.stage_date, location = excluded.location,
    notes = excluded.notes, responsible_id = excluded.responsible_id, verified_by = excluded.verified_by, verified_at = excluded.verified_at;
end $$;

create or replace function public.admin_register_document(p_program_id uuid, p_stage int, p_category public.doc_category, p_title text,
  p_path text, p_mime text, p_size bigint, p_privacy boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('docs.upload');
  if not coalesce(p_privacy, false) then raise exception 'Konfirmasi privasi wajib dicentang'; end if;
  if char_length(coalesce(btrim(p_title), '')) < 3 then raise exception 'Judul minimal 3 karakter'; end if;
  if p_path not like p_program_id::text || '/%' then raise exception 'Lokasi berkas tidak valid'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'documentation' and name = p_path) then raise exception 'Berkas belum terunggah'; end if;
  insert into public.documents (program_id, stage, category, title, storage_path, mime_type, size_bytes, privacy_confirmed, uploaded_by)
  values (p_program_id, p_stage, p_category, btrim(p_title), p_path, p_mime, p_size, true, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_set_document_visibility(p_id uuid, p_visibility text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('docs.publish');
  if p_visibility not in ('draft', 'published') then raise exception 'Visibilitas tidak valid'; end if;
  perform set_config('app.reason', coalesce(p_reason, ''), true);
  update public.documents set visibility = p_visibility,
    published_at = case when p_visibility = 'published' then now() else null end,
    published_by = case when p_visibility = 'published' then auth.uid() else null end
  where id = p_id;
  if not found then raise exception 'Dokumen tidak ditemukan'; end if;
end $$;

create table public.app_settings (
  key text primary key check (key in ('organization', 'website_content', 'notifications', 'animal_characters', 'payment_config', 'website')),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "public read public settings" on public.app_settings for select to anon, authenticated using (key in ('organization', 'website_content', 'animal_characters'));
create policy "staff read settings" on public.app_settings for select to authenticated using (public.has_permission(auth.uid(), 'settings.view') or public.has_permission(auth.uid(), 'payments.config') or public.has_permission(auth.uid(), 'content.manage') or public.has_permission(auth.uid(), 'notifications.manage'));
insert into public.app_settings (key, value) values
  ('organization', '{"name": "Manfaat Mengalir", "logo_url": "", "email": "", "whatsapp": "", "address": "", "legal_entity": "", "issuer_name": "", "issuer_title": ""}'),
  ('website_content', '{"hero_title": "", "hero_subtitle": "", "contact_email": "", "contact_whatsapp": "", "program_info": ""}'),
  ('notifications', '{"payment_reminder": "Halo {nama}, ini pengingat setoran kurbanmu ({kode}).", "payment_verified": "Pembayaran {nominal} untuk {kode} sudah terverifikasi.", "h7_announcement": "Pengumuman kelompok hewan kurban sudah terbit.", "channels_email": true, "channels_whatsapp": false}'),
  ('animal_characters', '{"cow_names": "Si Belang, Si Coklat, Si Manis", "goat_names": "Si Putih, Si Kecil", "show_names": true}'),
  ('payment_config', '{"minimum_payment": 10000, "maximum_payment": 50000000, "presets": "50000, 100000, 250000, 500000", "methods": "transfer_bank, qris, virtual_account", "service_fee": 0, "processing_active": false}'),
  ('website', '{"maintenance_mode": false, "show_countdown": true, "show_impact_samples": true}');

create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old jsonb;
begin
  perform public.require_perm(case p_key when 'organization' then 'settings.manage' when 'website' then 'settings.manage'
    when 'website_content' then 'content.manage' when 'notifications' then 'notifications.manage'
    when 'animal_characters' then 'characters.manage' when 'payment_config' then 'payments.config' else 'settings.manage' end);
  if jsonb_typeof(p_value) <> 'object' then raise exception 'Format pengaturan tidak valid'; end if;
  if p_key = 'payment_config' then
    if (p_value->>'processing_active')::boolean then raise exception 'Pemrosesan pembayaran nyata belum dapat diaktifkan'; end if;
    if coalesce((p_value->>'minimum_payment')::bigint, 0) < 1000 then raise exception 'Minimum pembayaran minimal Rp 1.000'; end if;
    if (p_value->>'maximum_payment')::bigint < (p_value->>'minimum_payment')::bigint then raise exception 'Maksimum harus lebih besar dari minimum'; end if;
  end if;
  select value into v_old from public.app_settings where key = p_key for update;
  update public.app_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then raise exception 'Kunci pengaturan tidak dikenal'; end if;
  perform public.write_audit('setting.update', 'app_settings', null, v_old, p_value, p_reason, jsonb_build_object('key', p_key));
end $$;

create or replace function public.admin_set_member(p_email text, p_role public.admin_role, p_active boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_old public.admin_members;
begin
  perform public.require_perm('admins.manage');
  if char_length(coalesce(btrim(p_reason), '')) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  select id into v_uid from public.profiles where lower(email) = lower(btrim(p_email));
  if v_uid is null then raise exception 'Akun dengan email tersebut belum terdaftar. Minta calon admin mendaftar terlebih dahulu.'; end if;
  if v_uid = auth.uid() then raise exception 'Kamu tidak dapat mengubah peran akunmu sendiri'; end if;
  select * into v_old from public.admin_members where user_id = v_uid for update;
  if found and v_old.role = 'superadmin' and (p_role <> 'superadmin' or not p_active)
     and (select count(*) from public.admin_members where role = 'superadmin' and is_active) <= 1 then
    raise exception 'Minimal harus ada satu SUPERADMIN aktif'; end if;
  insert into public.admin_members (user_id, role, is_active, created_by) values (v_uid, p_role, coalesce(p_active, true), auth.uid())
  on conflict (user_id) do update set role = excluded.role, is_active = excluded.is_active;
  perform public.write_audit('admin.role_change', 'admin_members', v_uid,
    case when v_old.user_id is null then null else jsonb_build_object('role', v_old.role, 'is_active', v_old.is_active) end,
    jsonb_build_object('role', p_role, 'is_active', coalesce(p_active, true), 'email', lower(btrim(p_email))), p_reason);
end $$;

create or replace function public.admin_dashboard(p_program_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_prog uuid := p_program_id;
begin
  perform public.require_perm('dashboard.view');
  with c as (select * from public.qurban_commitments where (v_prog is null or program_id = v_prog) and execution_status <> 'dibatalkan'),
  pay as (select * from public.ledger_entries where source_account = 'EXTERNAL' and dest_account = 'COMMITMENT' and (v_prog is null or program_id = v_prog))
  select jsonb_build_object(
    'participants', (select count(distinct user_id) from c),
    'commitments', (select count(*) from c),
    'committed_total', (select coalesce(sum(total_amount), 0) from c),
    'verified_total', (select coalesce(sum(verified_paid_amount), 0) from c),
    'paid_off', (select count(*) from c where payment_status = 'lunas'),
    'not_paid_off', (select count(*) from c where payment_status <> 'lunas'),
    'allocated_units', (select count(*) from public.animal_units u where (v_prog is null or u.program_id = v_prog) and u.status = 'locked'),
    'units', (select jsonb_build_object('draft', count(*) filter (where status = 'draft'), 'final', count(*) filter (where status = 'final'), 'locked', count(*) filter (where status = 'locked'))
              from public.animal_units u where v_prog is null or u.program_id = v_prog),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w), '[]'::jsonb) from (
        select to_char(date_trunc('week', created_at at time zone 'Asia/Jakarta'), 'YYYY-MM-DD') w, count(*) n from c group by 1) x),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'amount', a) order by d), '[]'::jsonb) from (
        select to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') d, sum(amount) a from pay where created_at > now() - interval '30 days' group by 1) x),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'amount', a) order by m), '[]'::jsonb) from (
        select to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM') m, sum(amount) a from pay group by 1) x),
    'progress', (select jsonb_build_object(
        '0-24', count(*) filter (where verified_paid_amount * 100 < total_amount * 25),
        '25-49', count(*) filter (where verified_paid_amount * 100 >= total_amount * 25 and verified_paid_amount * 100 < total_amount * 50),
        '50-74', count(*) filter (where verified_paid_amount * 100 >= total_amount * 50 and verified_paid_amount * 100 < total_amount * 75),
        '75-99', count(*) filter (where verified_paid_amount * 100 >= total_amount * 75 and verified_paid_amount < total_amount),
        'lunas', count(*) filter (where verified_paid_amount >= total_amount)) from c),
    'composition', (select coalesce(jsonb_agg(jsonb_build_object('name', category_name_snapshot, 'commitments', n, 'shares', s)), '[]'::jsonb) from (
        select category_name_snapshot, count(*) n, sum(shares) s from c group by 1) x),
    'execution', (select coalesce(jsonb_object_agg(execution_status, n), '{}'::jsonb) from (select execution_status, count(*) n from c group by 1) x),
    'attention', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select c.id, c.code, c.category_name_snapshot, c.total_amount, c.verified_paid_amount, c.created_at, p.full_name
        from c join public.programs pr on pr.id = c.program_id left join public.profiles p on p.id = c.user_id
        where c.payment_status <> 'lunas' and c.verified_paid_amount * 100 < c.total_amount * 50 and pr.payment_deadline < now() + interval '60 days'
        order by c.verified_paid_amount::numeric / c.total_amount, c.created_at limit 8) x),
    'recent', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select a.action, a.entity, a.created_at, a.source, p.full_name actor from public.audit_logs a left join public.profiles p on p.id = a.actor_id
        order by a.created_at desc limit 8) x),
    'announcement', (select to_jsonb(x) from (select version, status, published_at, scheduled_at from public.announcements
        where v_prog is null or program_id = v_prog order by version desc limit 1) x),
    'journey', (select coalesce(jsonb_agg(jsonb_build_object('stage', stage, 'status', status, 'date', stage_date) order by stage), '[]'::jsonb)
        from public.journey_stages where v_prog is null or program_id = v_prog)
  ) into r;
  return r;
end $$;

create or replace function public.admin_participants(p_search text default null, p_status text default null, p_program_id uuid default null, p_limit int default 20, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.require_perm('participants.view');
  with base as (
    select p.id, p.full_name, p.email, p.whatsapp, p.created_at,
      count(c.id) commitments, coalesce(sum(c.total_amount), 0) total, coalesce(sum(c.verified_paid_amount), 0) paid,
      case when count(c.id) = 0 then 'tanpa_komitmen'
           when bool_and(c.payment_status = 'lunas') then 'lunas'
           when bool_or(c.verified_paid_amount > 0) then 'dalam_cicilan' else 'belum_lunas' end status
    from public.profiles p
    left join public.qurban_commitments c on c.user_id = p.id and (p_program_id is null or c.program_id = p_program_id) and c.execution_status <> 'dibatalkan'
    where not exists (select 1 from public.admin_members m where m.user_id = p.id)
      and (coalesce(btrim(p_search), '') = '' or p.full_name ilike '%' || btrim(p_search) || '%' or p.email ilike '%' || btrim(p_search) || '%'
           or (regexp_replace(btrim(p_search), '\D', '', 'g') <> '' and p.whatsapp like '%' || regexp_replace(btrim(p_search), '\D', '', 'g') || '%'))
    group by p.id
  ), f as (select * from base where (p_status is null or p_status = '' or status = p_status) and (p_program_id is null or commitments > 0 or p_status = 'tanpa_komitmen'))
  select jsonb_build_object('total', (select count(*) from f),
    'rows', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select * from f order by created_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) x))
  into r;
  return r;
end $$;

create or replace function public.admin_report(p_kind text, p_program_id uuid default null, p_export boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.require_perm('reports.view');
  if p_export then perform public.require_perm('reports.export'); end if;
  if p_kind in ('transaksi', 'keuangan', 'sedekah', 'pengembalian', 'penggunaan') then perform public.require_perm('finance.view'); end if;
  if p_kind = 'audit' then perform public.require_perm('audit.view'); end if;
  if p_kind = 'peserta' then perform public.require_perm('participants.view'); end if;
  r := case p_kind
  when 'transaksi' then (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (select e.created_at, e.reference, e.source_account, e.dest_account, e.amount, c.code komitmen, e.basis, e.is_fixture
     from public.ledger_entries e left join public.qurban_commitments c on c.id = e.commitment_id where p_program_id is null or e.program_id = p_program_id) x)
  when 'keuangan' then (select coalesce(jsonb_agg(x), '[]') from (select * from public.admin_ledger_balances(p_program_id)) x)
  when 'peserta' then (select coalesce(jsonb_agg(x), '[]') from (select p.full_name, p.email, p.whatsapp, p.created_at bergabung, count(c.id) komitmen, coalesce(sum(c.total_amount), 0) nilai, coalesce(sum(c.verified_paid_amount), 0) terverifikasi
     from public.profiles p left join public.qurban_commitments c on c.user_id = p.id and (p_program_id is null or c.program_id = p_program_id)
     where not exists (select 1 from public.admin_members m where m.user_id = p.id) group by p.id order by p.created_at) x)
  when 'kategori' then (select coalesce(jsonb_agg(x), '[]') from (select cat.name kategori, count(c.id) komitmen, coalesce(sum(c.shares), 0) bagian, coalesce(sum(c.total_amount), 0) nilai
     from public.animal_categories cat left join public.qurban_commitments c on c.category_id = cat.id where p_program_id is null or cat.program_id = p_program_id group by cat.id order by cat.sort_order) x)
  when 'akad' then (select coalesce(jsonb_agg(x), '[]') from (select cc.contract_code akad, cc.contract_version versi, cc.contract_status_at_consent status_saat_akad, cc.decision keputusan, count(*) jumlah
     from public.contract_consents cc join public.qurban_commitments c on c.id = cc.commitment_id where p_program_id is null or c.program_id = p_program_id group by 1, 2, 3, 4 order by 1, 2) x)
  when 'alokasi' then (select coalesce(jsonb_agg(x), '[]') from (select u.code unit, cat.name kategori, u.status, coalesce(sum(a.shares) filter (where a.is_active), 0) terisi, cat.max_shares kapasitas
     from public.animal_units u join public.animal_categories cat on cat.id = u.category_id left join public.allocations a on a.unit_id = u.id where p_program_id is null or u.program_id = p_program_id group by u.id, cat.id order by u.code) x)
  when 'sedekah' then (select coalesce(jsonb_agg(x), '[]') from (select created_at, reference, amount, basis from public.ledger_entries where dest_account = 'SEDEKAH' and (p_program_id is null or program_id = p_program_id)) x)
  when 'pengembalian' then (select coalesce(jsonb_agg(x), '[]') from (select created_at, reference, source_account, dest_account, amount, basis from public.ledger_entries where 'REFUND' in (source_account, dest_account) and (p_program_id is null or program_id = p_program_id)) x)
  when 'penggunaan' then (select coalesce(jsonb_agg(x), '[]') from (select created_at, reference, source_account, amount, basis from public.ledger_entries where dest_account = 'USED' and (p_program_id is null or program_id = p_program_id)) x)
  when 'penyaluran' then (select coalesce(jsonb_agg(x), '[]') from (select stage tahap, status, stage_date tanggal, location lokasi, verified_at diverifikasi from public.journey_stages where p_program_id is null or program_id = p_program_id order by stage) x)
  when 'penerima' then (select coalesce(jsonb_agg(x), '[]') from (select title judul, category kategori, visibility, created_at from public.documents where category in ('beneficiaries', 'distribution', 'impact_report') and (p_program_id is null or program_id = p_program_id)) x)
  when 'audit' then (select coalesce(jsonb_agg(x), '[]') from (select a.created_at, p.full_name aktor, a.action, a.entity, a.entity_id, a.reason, a.source from public.audit_logs a left join public.profiles p on p.id = a.actor_id order by a.created_at desc limit 2000) x)
  when 'eksekutif' then jsonb_build_array(public.admin_dashboard(p_program_id) - 'recent' - 'attention')
  else null end;
  if r is null then raise exception 'Jenis laporan tidak dikenal'; end if;
  if p_export then perform public.write_audit('report.export', 'report', null, null, null, null, jsonb_build_object('kind', p_kind, 'program_id', p_program_id)); end if;
  return r;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'admin_save_program(uuid, jsonb, text)', 'admin_set_program_status(uuid, public.program_status, text)',
    'admin_save_category(uuid, jsonb, text)', 'admin_add_price(uuid, bigint, bigint, boolean, text)',
    'admin_save_contract_draft(uuid, jsonb)', 'admin_approve_contract(uuid, text, text, text)', 'admin_reconsent_candidates(uuid)',
    'admin_correct_profile(uuid, jsonb, text)', 'admin_correct_shahibul(uuid, text, text)',
    'admin_reverse_entry(uuid, text)', 'admin_ledger_balances(uuid)',
    'admin_create_unit(uuid, uuid, text, text, text)', 'admin_allocate(uuid, uuid)', 'admin_remove_allocation(uuid, text)',
    'admin_set_unit_status(uuid, public.unit_status, text)', 'admin_lock_unit(uuid)',
    'admin_generate_announcement(uuid, text)', 'admin_announcement_transition(uuid, public.announcement_status, text, timestamptz)',
    'admin_verify_stage(uuid, int, date, text, text)', 'admin_register_document(uuid, int, public.doc_category, text, text, text, bigint, boolean)',
    'admin_set_document_visibility(uuid, text, text)', 'admin_set_setting(text, jsonb, text)',
    'admin_set_member(text, public.admin_role, boolean, text)', 'admin_dashboard(uuid)',
    'admin_participants(text, text, uuid, int, int)', 'admin_report(text, uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.share_component(bigint, int, int), public.mask_name(text) from anon;

create policy "docs upload by staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentation' and public.has_permission(auth.uid(), 'docs.upload')
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'pdf'));
create policy "docs read by staff" on storage.objects for select to authenticated
  using (bucket_id = 'documentation' and (public.has_permission(auth.uid(), 'journey.view') or public.has_permission(auth.uid(), 'docs.upload')));
create policy "docs read published by participant" on storage.objects for select to authenticated
  using (bucket_id = 'documentation' and exists (
    select 1 from public.documents d join public.qurban_commitments c on c.program_id = d.program_id
    where d.storage_path = storage.objects.name and d.visibility = 'published' and c.user_id = auth.uid()));