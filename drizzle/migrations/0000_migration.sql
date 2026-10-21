-- ========== ENUMS ==========
create type public.app_role as enum ('admin', 'participant');
create type public.program_status as enum ('draft', 'open', 'closed', 'completed');
create type public.animal_kind as enum ('sapi', 'kambing');
create type public.contract_status as enum ('draft', 'approved', 'retired');
create type public.consent_decision as enum ('accepted', 'declined');
create type public.payment_frequency as enum ('harian', 'mingguan', 'bulanan', 'fleksibel');
create type public.execution_status as enum ('menunggu', 'dialokasikan', 'disembelih', 'didistribusikan', 'selesai', 'dibatalkan');
create type public.publication_preference as enum ('full', 'masked', 'private');

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ========== PROFILES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 120),
  email text not null,
  whatsapp text not null check (whatsapp ~ '^\+62[0-9]{8,13}$'),
  birth_date date not null,
  address text not null check (char_length(address) between 10 and 500),
  whatsapp_consent boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (full_name, whatsapp, address, whatsapp_consent) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ========== ROLES ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ========== PROGRAMS / CATEGORIES / PRICES ==========
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  hijri_year int not null,
  status public.program_status not null default 'draft',
  iduladha_date date not null,
  payment_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.animal_categories (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  code text not null,
  name text not null,
  kind public.animal_kind not null,
  max_shares int not null check (max_shares in (1, 7)),
  weight_range text,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, code),
  check ((kind = 'kambing' and max_shares = 1) or (kind = 'sapi' and max_shares = 7))
);
create index on public.animal_categories (program_id);
create table public.animal_prices (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.animal_categories(id) on delete restrict,
  animal_cost bigint not null check (animal_cost > 0),
  operational_cost bigint not null check (operational_cost >= 0),
  is_final boolean not null default false,
  effective_from timestamptz not null default now(),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.animal_prices (category_id, effective_from desc);

grant select on public.programs, public.animal_categories, public.animal_prices to anon, authenticated;
grant all on public.programs, public.animal_categories, public.animal_prices to service_role;
alter table public.programs enable row level security;
alter table public.animal_categories enable row level security;
alter table public.animal_prices enable row level security;
create policy "public read programs" on public.programs for select to anon, authenticated using (status <> 'draft');
create policy "public read categories" on public.animal_categories for select to anon, authenticated using (is_active);
create policy "public read prices" on public.animal_prices for select to anon, authenticated using (true);
create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.animal_categories for each row execute function public.touch_updated_at();

-- Price history is append-only
create or replace function public.prevent_mutation() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Catatan ini tidak dapat diubah atau dihapus (append-only)'; end $$;
create trigger animal_prices_immutable before update or delete on public.animal_prices for each row execute function public.prevent_mutation();

-- ========== CONTRACTS ==========
create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  contract_code text not null check (contract_code in ('akad_1', 'akad_2a', 'akad_2b')),
  version text not null,
  title text not null,
  summary text not null,
  body text not null,
  status public.contract_status not null default 'draft',
  is_active boolean not null default true,
  is_mandatory boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (program_id, contract_code, version)
);
grant select on public.contract_versions to anon, authenticated;
grant all on public.contract_versions to service_role;
alter table public.contract_versions enable row level security;
create policy "public read contracts" on public.contract_versions for select to anon, authenticated using (status <> 'retired' or true);

-- ========== COMMITMENTS ==========
create table public.qurban_commitments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null,
  program_id uuid not null references public.programs(id) on delete restrict,
  category_id uuid not null references public.animal_categories(id) on delete restrict,
  price_id uuid not null references public.animal_prices(id) on delete restrict,
  -- snapshots (exact integer Rupiah)
  category_name_snapshot text not null,
  animal_kind_snapshot public.animal_kind not null,
  shares int not null check (shares between 1 and 7),
  price_per_share_snapshot bigint not null check (price_per_share_snapshot > 0),
  animal_cost_snapshot bigint not null,
  operational_cost_snapshot bigint not null,
  rounding_adjustment bigint not null default 0,
  total_amount bigint not null check (total_amount > 0),
  -- maintained ONLY by the future verified-payment ledger
  verified_paid_amount bigint not null default 0 check (verified_paid_amount >= 0),
  payment_status text generated always as (
    case when verified_paid_amount <= 0 then 'belum_lunas'
         when verified_paid_amount < total_amount then 'dalam_cicilan'
         else 'lunas' end) stored,
  execution_status public.execution_status not null default 'menunggu',
  animal_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((animal_kind_snapshot = 'kambing' and shares = 1) or animal_kind_snapshot = 'sapi'),
  check (total_amount = price_per_share_snapshot * shares)
);
create index on public.qurban_commitments (user_id, created_at desc);
create index on public.qurban_commitments (program_id);
create trigger commitments_touch before update on public.qurban_commitments for each row execute function public.touch_updated_at();

-- Lock contractual snapshot columns forever
create or replace function public.lock_commitment_snapshot() returns trigger language plpgsql set search_path = public as $$
begin
  if new.code <> old.code or new.user_id <> old.user_id or new.program_id <> old.program_id
     or new.category_id <> old.category_id or new.price_id <> old.price_id or new.shares <> old.shares
     or new.price_per_share_snapshot <> old.price_per_share_snapshot or new.animal_cost_snapshot <> old.animal_cost_snapshot
     or new.operational_cost_snapshot <> old.operational_cost_snapshot or new.total_amount <> old.total_amount
     or new.category_name_snapshot <> old.category_name_snapshot or new.rounding_adjustment <> old.rounding_adjustment then
    raise exception 'Snapshot akad komitmen tidak dapat diubah';
  end if;
  return new;
end $$;
create trigger commitments_lock before update on public.qurban_commitments for each row execute function public.lock_commitment_snapshot();

create table public.qurban_shares (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.qurban_commitments(id) on delete cascade,
  position int not null check (position between 1 and 7),
  shahibul_name text not null check (char_length(shahibul_name) between 2 and 120),
  created_at timestamptz not null default now(),
  unique (commitment_id, position)
);
create index on public.qurban_shares (commitment_id);

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null unique references public.qurban_commitments(id) on delete cascade,
  frequency public.payment_frequency not null,
  periods int not null check (periods >= 0),
  suggested_amount bigint not null check (suggested_amount >= 0),
  deadline timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_touch before update on public.payment_plans for each row execute function public.touch_updated_at();

create table public.contract_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commitment_id uuid not null references public.qurban_commitments(id) on delete restrict,
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  contract_code text not null,
  contract_version text not null,
  contract_status_at_consent public.contract_status not null,
  decision public.consent_decision not null,
  consented_at timestamptz not null default now(),
  user_agent text,
  unique (commitment_id, contract_version_id)
);
create index on public.contract_consents (user_id);
create trigger consents_immutable before update or delete on public.contract_consents for each row execute function public.prevent_mutation();

create table public.notification_preferences (
  user_id uuid primary key,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  payment_reminders boolean not null default true,
  journey_updates boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notif_touch before update on public.notification_preferences for each row execute function public.touch_updated_at();

create table public.participant_publication_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commitment_id uuid references public.qurban_commitments(id) on delete cascade,
  preference public.publication_preference not null,
  created_at timestamptz not null default now()
);
create index on public.participant_publication_consents (user_id, created_at desc);
create trigger pubconsent_immutable before update or delete on public.participant_publication_consents for each row execute function public.prevent_mutation();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (entity, entity_id);
create index on public.audit_logs (actor_id, created_at desc);
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function public.prevent_mutation();

-- grants: participants read own; writes only via security-definer RPCs
grant select on public.qurban_commitments, public.qurban_shares, public.payment_plans, public.contract_consents, public.participant_publication_consents to authenticated;
grant insert on public.participant_publication_consents to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.qurban_commitments, public.qurban_shares, public.payment_plans, public.contract_consents, public.notification_preferences, public.participant_publication_consents, public.audit_logs to service_role;

alter table public.qurban_commitments enable row level security;
alter table public.qurban_shares enable row level security;
alter table public.payment_plans enable row level security;
alter table public.contract_consents enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.participant_publication_consents enable row level security;
alter table public.audit_logs enable row level security;

create policy "own commitments" on public.qurban_commitments for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "own shares" on public.qurban_shares for select to authenticated using (exists (select 1 from public.qurban_commitments c where c.id = commitment_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "own plans" on public.payment_plans for select to authenticated using (exists (select 1 from public.qurban_commitments c where c.id = commitment_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "own consents" on public.contract_consents for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "own notif read" on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy "own notif insert" on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
create policy "own notif update" on public.notification_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own pub read" on public.participant_publication_consents for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "own pub insert" on public.participant_publication_consents for insert to authenticated with check (
  auth.uid() = user_id and (commitment_id is null or exists (select 1 from public.qurban_commitments c where c.id = commitment_id and c.user_id = auth.uid())));
create policy "admin audit read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ========== SIGNUP HANDLER ==========
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_birth date := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
begin
  if v_birth is null or v_birth > (current_date - interval '17 years')::date then
    raise exception 'Usia minimal peserta adalah 17 tahun';
  end if;
  insert into public.profiles (id, full_name, email, whatsapp, birth_date, address, whatsapp_consent, terms_accepted_at)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'whatsapp', v_birth,
          new.raw_user_meta_data->>'address', coalesce((new.raw_user_meta_data->>'whatsapp_consent')::boolean, false),
          case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() end);
  insert into public.user_roles (user_id, role) values (new.id, 'participant');
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (new.id, 'register', 'profile', new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ========== PRICING HELPERS ==========
create or replace function public.current_price(_category_id uuid) returns public.animal_prices
language sql stable security definer set search_path = public as $$
  select * from public.animal_prices where category_id = _category_id and effective_from <= now()
  order by effective_from desc limit 1
$$;

-- per share = ceil(full / max_shares) rounded UP to nearest Rp 1.000
create or replace function public.price_per_share(_full bigint, _max_shares int) returns bigint
language sql immutable set search_path = public as $$
  select (ceil((_full::numeric / _max_shares) / 1000) * 1000)::bigint
$$;

create or replace function public.count_periods(_freq public.payment_frequency, _from timestamptz, _to timestamptz) returns int
language plpgsql immutable set search_path = public as $$
declare d int := greatest(0, ceil(extract(epoch from (_to - _from)) / 86400)::int);
begin
  if d = 0 then return 0; end if;
  return case _freq when 'harian' then d when 'mingguan' then greatest(1, ceil(d / 7.0)::int)
    when 'bulanan' then greatest(1, ceil(d / 30.0)::int) else greatest(1, ceil(d / 30.0)::int) end;
end $$;

-- ========== CREATE COMMITMENT (atomic, server-authoritative) ==========
create or replace function public.create_commitment(
  p_category_id uuid, p_shares int, p_shahibul text[], p_frequency public.payment_frequency,
  p_consents jsonb, p_publication public.publication_preference, p_user_agent text default null
) returns table (id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cat public.animal_categories;
  v_prog public.programs;
  v_price public.animal_prices;
  v_full bigint; v_pps bigint; v_total bigint; v_animal bigint; v_ops bigint; v_round bigint;
  v_id uuid; v_code text; v_periods int; v_names text[]; v_name text; i int;
  v_cv public.contract_versions; v_dec text;
begin
  if v_uid is null then raise exception 'Kamu harus masuk terlebih dahulu'; end if;
  select * into v_cat from public.animal_categories c where c.id = p_category_id and c.is_active;
  if not found then raise exception 'Kategori hewan tidak ditemukan'; end if;
  select * into v_prog from public.programs p where p.id = v_cat.program_id;
  if v_prog.status <> 'open' then raise exception 'Program sedang tidak menerima komitmen baru'; end if;
  if now() >= v_prog.payment_deadline then raise exception 'Batas pelunasan program telah lewat'; end if;
  v_price := public.current_price(v_cat.id);
  if v_price.id is null or not v_price.is_final then raise exception 'Harga final kategori ini belum ditetapkan'; end if;
  if p_shares is null or p_shares < 1 or p_shares > v_cat.max_shares then raise exception 'Jumlah bagian tidak valid untuk kategori ini'; end if;

  -- shahibul names
  select array_agg(btrim(n)) into v_names from unnest(coalesce(p_shahibul, '{}')) n where btrim(n) <> '';
  if coalesce(array_length(v_names, 1), 0) <> p_shares then raise exception 'Jumlah nama shahibul harus sama dengan jumlah bagian'; end if;
  foreach v_name in array v_names loop
    if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Nama shahibul harus 2–120 karakter'; end if;
  end loop;

  -- mandatory akad 1 must be accepted on an active version
  select * into v_cv from public.contract_versions cv where cv.program_id = v_prog.id and cv.contract_code = 'akad_1' and cv.is_active order by created_at desc limit 1;
  if not found then raise exception 'Akad 1 belum tersedia'; end if;
  if coalesce(p_consents->>v_cv.id::text, '') <> 'accepted' then raise exception 'Akad 1 wajib disetujui'; end if;

  v_full := v_price.animal_cost + v_price.operational_cost;
  v_pps := public.price_per_share(v_full, v_cat.max_shares);
  v_total := v_pps * p_shares;
  v_animal := round(v_price.animal_cost::numeric * p_shares / v_cat.max_shares)::bigint;
  v_ops := round(v_price.operational_cost::numeric * p_shares / v_cat.max_shares)::bigint;
  v_round := v_total - v_animal - v_ops;

  loop
    v_code := 'QBN-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from public.qurban_commitments q where q.code = v_code);
  end loop;

  insert into public.qurban_commitments (code, user_id, program_id, category_id, price_id, category_name_snapshot, animal_kind_snapshot,
    shares, price_per_share_snapshot, animal_cost_snapshot, operational_cost_snapshot, rounding_adjustment, total_amount)
  values (v_code, v_uid, v_prog.id, v_cat.id, v_price.id, v_cat.name, v_cat.kind, p_shares, v_pps, v_animal, v_ops, v_round, v_total)
  returning qurban_commitments.id into v_id;

  for i in 1..p_shares loop
    insert into public.qurban_shares (commitment_id, position, shahibul_name) values (v_id, i, v_names[i]);
  end loop;

  v_periods := public.count_periods(p_frequency, now(), v_prog.payment_deadline);
  insert into public.payment_plans (commitment_id, frequency, periods, suggested_amount, deadline)
  values (v_id, p_frequency, v_periods, case when v_periods > 0 then (ceil(v_total::numeric / v_periods / 1000) * 1000)::bigint else v_total end, v_prog.payment_deadline);

  -- consent evidence for every active contract of the program
  for v_cv in select * from public.contract_versions cv where cv.program_id = v_prog.id and cv.is_active loop
    v_dec := coalesce(p_consents->>v_cv.id::text, '');
    if v_dec not in ('accepted', 'declined') then raise exception 'Keputusan untuk % wajib diisi', v_cv.title; end if;
    if v_cv.is_mandatory and v_dec <> 'accepted' then raise exception '% wajib disetujui', v_cv.title; end if;
    insert into public.contract_consents (user_id, commitment_id, contract_version_id, contract_code, contract_version, contract_status_at_consent, decision, user_agent)
    values (v_uid, v_id, v_cv.id, v_cv.contract_code, v_cv.version, v_cv.status, v_dec::public.consent_decision, left(p_user_agent, 300));
  end loop;

  insert into public.participant_publication_consents (user_id, commitment_id, preference) values (v_uid, v_id, p_publication);
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'commitment.create', 'qurban_commitment', v_id, jsonb_build_object('code', v_code, 'total', v_total, 'price_id', v_price.id, 'shares', p_shares));

  return query select v_id, v_code;
end $$;
revoke all on function public.create_commitment from public, anon;
grant execute on function public.create_commitment to authenticated;

-- ========== SEED (sample data, clearly marked) ==========
with p as (
  insert into public.programs (code, name, hijri_year, status, iduladha_date, payment_deadline)
  values ('QRB-1448', 'Program Kurban 1448 H', 1448, 'open', '2027-05-16', '2027-04-16 23:59:59+07') returning id
), c as (
  insert into public.animal_categories (program_id, code, name, kind, max_shares, weight_range, description, sort_order)
  select p.id, x.code, x.name, x.kind::public.animal_kind, x.ms, x.w, x.d, x.o from p, (values
    ('sapi-reguler', 'Sapi Reguler', 'sapi', 7, '± 250–300 kg', 'Pilihan hemat untuk patungan bersama keluarga atau komunitas.', 1),
    ('sapi-super', 'Sapi Super', 'sapi', 7, '± 350–400 kg', 'Sapi berbobot lebih besar dengan manfaat daging lebih luas.', 2),
    ('sapi-super-duper', 'Sapi Super Duper', 'sapi', 7, '± 500 kg ke atas', 'Kategori premium. Harga final belum ditetapkan.', 3),
    ('kambing', 'Kambing', 'kambing', 1, '± 25–30 kg', 'Satu ekor untuk satu shahibul kurban.', 4)
  ) as x(code, name, kind, ms, w, d, o) returning id, code
)
insert into public.animal_prices (category_id, animal_cost, operational_cost, is_final, effective_from, note)
select c.id, v.a, v.o, true, '2026-10-01', 'Harga contoh (sample) — menunggu harga resmi PRD'
from c join (values ('sapi-reguler', 19600000::bigint, 1400000::bigint), ('sapi-super', 25900000, 2100000), ('kambing', 3150000, 350000)) v(code, a, o) on v.code = c.code;

insert into public.contract_versions (program_id, contract_code, version, title, summary, body, status, is_mandatory)
select p.id, x.code, 'draft-0.1', x.title, x.summary, x.body, 'draft', x.mand from public.programs p, (values
  ('akad_1', 'Akad 1 — Komitmen Pembelian Hewan Kurban', 'Kesepakatan pembelian hewan kurban dengan harga yang dikunci saat akad dan pembayaran bertahap hingga batas pelunasan.',
   E'[DRAF — BELUM DISETUJUI DEWAN SYARIAH DAN TIM HUKUM]\n\n1. Peserta berkomitmen membeli hewan kurban atau bagian hewan kurban sesuai kategori yang dipilih.\n2. Harga dikunci pada saat akad ini dibuat dan tidak berubah untuk komitmen ini.\n3. Peserta melunasi pembayaran secara bertahap sebelum batas pelunasan program.\n4. Progres pembayaran hanya dihitung dari pembayaran yang telah diverifikasi.\n5. Lunas pembayaran tidak berarti kurban telah dilaksanakan; pelaksanaan mengikuti jadwal Iduladha.\n\n[Lafaz akad, jenis akad syariah, serta ketentuan pembatalan dan pengembalian dana menunggu teks resmi.]', true),
  ('akad_2a', 'Akad 2A — Pengelolaan Kelebihan Dana', 'Keputusan opsional tentang pengelolaan kelebihan dana (jika ada).',
   E'[DRAF — BELUM DISETUJUI]\n\nKetentuan tentang pengelolaan kelebihan dana akan dicantumkan setelah teks resmi disetujui. Persetujuan atau penolakan bersifat opsional.', false),
  ('akad_2b', 'Akad 2B — Perwakilan Penyembelihan & Distribusi', 'Keputusan opsional tentang pemberian kuasa penyembelihan dan distribusi.',
   E'[DRAF — BELUM DISETUJUI]\n\nKetentuan tentang perwakilan (wakalah) penyembelihan dan distribusi akan dicantumkan setelah teks resmi disetujui. Persetujuan atau penolakan bersifat opsional.', false)
) as x(code, title, summary, body, mand) where p.code = 'QRB-1448';
