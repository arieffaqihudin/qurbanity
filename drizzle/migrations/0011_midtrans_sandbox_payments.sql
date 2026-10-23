create or replace function public.admin_ledger_balances(p_program_id uuid default null)
returns table(account public.ledger_account, balance bigint, entries bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_perm('finance.view');
  return query
  select a.acc,
    coalesce((select sum(amount) from public.ledger_entries where dest_account = a.acc and not is_fixture and (p_program_id is null or program_id = p_program_id)), 0)::bigint
      - coalesce((select sum(amount) from public.ledger_entries where source_account = a.acc and not is_fixture and (p_program_id is null or program_id = p_program_id)), 0)::bigint,
    (select count(*) from public.ledger_entries where (dest_account = a.acc or source_account = a.acc) and not is_fixture and (p_program_id is null or program_id = p_program_id))
  from unnest(enum_range(null::public.ledger_account)) as a(acc);
end;
$$;

create or replace function public.admin_dashboard(p_program_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_prog uuid := p_program_id;
begin
  perform public.require_perm('dashboard.view');
  with c as (select * from public.qurban_commitments where (v_prog is null or program_id = v_prog) and execution_status <> 'dibatalkan'),
  pay as (select * from public.ledger_entries where source_account = 'EXTERNAL' and dest_account = 'COMMITMENT' and not is_fixture and (v_prog is null or program_id = v_prog))
  select jsonb_build_object(
    'participants', (select count(distinct user_id) from c),
    'commitments', (select count(*) from c),
    'committed_total', (select coalesce(sum(total_amount), 0) from c),
    'verified_total', (select coalesce(sum(amount), 0) from pay),
    'paid_off', (select count(*) from c x where coalesce((select sum(amount) from pay where commitment_id = x.id), 0) >= x.total_amount),
    'not_paid_off', (select count(*) from c x where coalesce((select sum(amount) from pay where commitment_id = x.id), 0) < x.total_amount),
    'allocated_units', (select count(*) from public.animal_units u where (v_prog is null or u.program_id = v_prog) and u.status = 'locked'),
    'units', (select jsonb_build_object('draft', count(*) filter (where status = 'draft'), 'final', count(*) filter (where status = 'final'), 'locked', count(*) filter (where status = 'locked')) from public.animal_units u where v_prog is null or u.program_id = v_prog),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w), '[]'::jsonb) from (select to_char(date_trunc('week', created_at at time zone 'Asia/Jakarta'), 'YYYY-MM-DD') w, count(*) n from c group by 1) x),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'amount', a) order by d), '[]'::jsonb) from (select to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') d, sum(amount) a from pay where created_at > now() - interval '30 days' group by 1) x),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'amount', a) order by m), '[]'::jsonb) from (select to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM') m, sum(amount) a from pay group by 1) x),
    'progress', (select jsonb_build_object(
      '0-24', count(*) filter (where coalesce(paid, 0) * 100 < total_amount * 25),
      '25-49', count(*) filter (where coalesce(paid, 0) * 100 >= total_amount * 25 and coalesce(paid, 0) * 100 < total_amount * 50),
      '50-74', count(*) filter (where coalesce(paid, 0) * 100 >= total_amount * 50 and coalesce(paid, 0) * 100 < total_amount * 75),
      '75-99', count(*) filter (where coalesce(paid, 0) * 100 >= total_amount * 75 and coalesce(paid, 0) < total_amount),
      'lunas', count(*) filter (where coalesce(paid, 0) >= total_amount)) from (select c.id, c.total_amount, (select sum(amount) from pay where commitment_id = c.id) paid from c) x),
    'composition', (select coalesce(jsonb_agg(jsonb_build_object('name', category_name_snapshot, 'commitments', n, 'shares', s)), '[]'::jsonb) from (select category_name_snapshot, count(*) n, sum(shares) s from c group by 1) x),
    'execution', (select coalesce(jsonb_object_agg(execution_status, n), '{}'::jsonb) from (select execution_status, count(*) n from c group by 1) x),
    'attention', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select c.id, c.code, c.category_name_snapshot, c.total_amount, coalesce((select sum(amount) from pay where commitment_id = c.id),0) verified_paid_amount, c.created_at, p.full_name from c join public.programs pr on pr.id = c.program_id left join public.profiles p on p.id = c.user_id where coalesce((select sum(amount) from pay where commitment_id = c.id),0) < c.total_amount and coalesce((select sum(amount) from pay where commitment_id = c.id),0) * 100 < c.total_amount * 50 and pr.payment_deadline < now() + interval '60 days' order by coalesce((select sum(amount) from pay where commitment_id = c.id),0)::numeric / c.total_amount, c.created_at limit 8) x),
    'recent', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select a.action, a.entity, a.created_at, a.source, p.full_name actor from public.audit_logs a left join public.profiles p on p.id = a.actor_id order by a.created_at desc limit 8) x),
    'announcement', (select to_jsonb(x) from (select version, status, published_at, scheduled_at from public.announcements where v_prog is null or program_id = v_prog order by version desc limit 1) x),
    'journey', (select coalesce(jsonb_agg(jsonb_build_object('stage', stage, 'status', status, 'date', stage_date) order by stage), '[]'::jsonb) from public.journey_stages where v_prog is null or program_id = v_prog)
  ) into r;
  return r;
end;
$$;

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
    when 'transaksi' then (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (select e.created_at, e.reference, e.source_account, e.dest_account, e.amount, c.code komitmen, e.basis, e.is_fixture from public.ledger_entries e left join public.qurban_commitments c on c.id = e.commitment_id where not e.is_fixture and (p_program_id is null or e.program_id = p_program_id)) x)
    when 'keuangan' then (select coalesce(jsonb_agg(x), '[]') from (select * from public.admin_ledger_balances(p_program_id)) x)
    when 'peserta' then (select coalesce(jsonb_agg(x), '[]') from (select p.full_name, p.email, p.whatsapp, p.created_at bergabung, count(c.id) komitmen, coalesce(sum(c.total_amount), 0) nilai, coalesce(sum(c.verified_paid_amount), 0) terverifikasi from public.profiles p left join public.qurban_commitments c on c.user_id = p.id and (p_program_id is null or c.program_id = p_program_id) where not exists (select 1 from public.admin_members m where m.user_id = p.id) group by p.id order by p.created_at) x)
    when 'kategori' then (select coalesce(jsonb_agg(x), '[]') from (select cat.name kategori, count(c.id) komitmen, coalesce(sum(c.shares), 0) bagian, coalesce(sum(c.total_amount), 0) nilai from public.animal_categories cat left join public.qurban_commitments c on c.category_id = cat.id where p_program_id is null or cat.program_id = p_program_id group by cat.id order by cat.sort_order) x)
    when 'akad' then (select coalesce(jsonb_agg(x), '[]') from (select cc.contract_code akad, cc.contract_version versi, cc.contract_status_at_consent status_saat_akad, cc.decision keputusan, count(*) jumlah from public.contract_consents cc join public.qurban_commitments c on c.id = cc.commitment_id where p_program_id is null or c.program_id = p_program_id group by 1, 2, 3, 4 order by 1, 2) x)
    when 'alokasi' then (select coalesce(jsonb_agg(x), '[]') from (select u.code unit, cat.name kategori, u.status, coalesce(sum(a.shares) filter (where a.is_active), 0) terisi, cat.max_shares kapasitas from public.animal_units u join public.animal_categories cat on cat.id = u.category_id left join public.allocations a on a.unit_id = u.id where p_program_id is null or u.program_id = p_program_id group by u.id, cat.id order by u.code) x)
    when 'sedekah' then (select coalesce(jsonb_agg(x), '[]') from (select created_at, reference, amount, basis from public.ledger_entries where not is_fixture and dest_account = 'SEDEKAH' and (p_program_id is null or program_id = p_program_id)) x)
    when 'pengembalian' then (select coalesce(jsonb_agg(x), '[]') from (select created_at, reference, source_account, dest_account, amount, basis from public.ledger_entries where not is_fixture and 'REFUND' in (source_account, dest_account) and (p_program_id is null or program_id = p_program_id)) x)
    when 'penggunaan' then (select coalesce(jsonb_agg(x), '[]') from (select created_at, reference, source_account, amount, basis from public.ledger_entries where not is_fixture and dest_account = 'USED' and (p_program_id is null or program_id = p_program_id)) x)
    when 'penyaluran' then (select coalesce(jsonb_agg(x), '[]') from (select stage tahap, status, stage_date tanggal, location lokasi, verified_at diverifikasi from public.journey_stages where p_program_id is null or program_id = p_program_id order by stage) x)
    when 'penerima' then (select coalesce(jsonb_agg(x), '[]') from (select title judul, category kategori, visibility, created_at from public.documents where category in ('beneficiaries', 'distribution', 'impact_report') and (p_program_id is null or program_id = p_program_id)) x)
    when 'audit' then (select coalesce(jsonb_agg(x), '[]') from (select a.created_at, p.full_name aktor, a.action, a.entity, a.entity_id, a.reason, a.source from public.audit_logs a left join public.profiles p on p.id = a.actor_id order by a.created_at desc limit 2000) x)
    when 'eksekutif' then jsonb_build_array(public.admin_dashboard(p_program_id) - 'recent' - 'attention')
    else null end;
  if r is null then raise exception 'Jenis laporan tidak dikenal'; end if;
  if p_export then perform public.write_audit('report.export', 'report', null, null, null, null, jsonb_build_object('kind', p_kind, 'program_id', p_program_id)); end if;
  return r;
end;
$$;
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  commitment_id uuid not null references public.qurban_commitments(id) on delete restrict,
  order_id text not null unique,
  idempotency_key text not null unique,
  transaction_id text unique,
  amount bigint not null check (amount > 0),
  service_fee bigint not null default 0 check (service_fee >= 0),
  payment_method text,
  status text not null default 'pending' check (status in ('pending','success','failed','expired','cancelled','refund_required','refunded')),
  gateway_status text,
  gateway_status_code text,
  snap_token text,
  snap_redirect_url text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  receipt_number text unique,
  verification_code text unique,
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  gateway_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_transactions_user_created_idx on public.payment_transactions (user_id, created_at desc);
create index payment_transactions_commitment_created_idx on public.payment_transactions (commitment_id, created_at desc);
create index payment_transactions_status_expiry_idx on public.payment_transactions (status, expires_at);
create trigger payment_transactions_touch before update on public.payment_transactions for each row execute function public.touch_updated_at();
alter table public.payment_transactions enable row level security;
grant select on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;
create policy "participants read own payment transactions" on public.payment_transactions for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'finance.view'));

create table public.participant_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index participant_notifications_user_created_idx on public.participant_notifications (user_id, created_at desc);
alter table public.participant_notifications enable row level security;
grant select, update on public.participant_notifications to authenticated;
grant all on public.participant_notifications to service_role;
create policy "participants read own notifications" on public.participant_notifications for select to authenticated
  using (user_id = auth.uid());
create policy "participants mark own notifications read" on public.participant_notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.payment_status_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payment_transactions(id) on delete restrict,
  previous_status text,
  new_status text not null,
  gateway_status text,
  status_code text,
  source text not null check (source in ('checkout','webhook','status_check','reconciliation')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payment_status_events_payment_created_idx on public.payment_status_events (payment_id, created_at desc);
alter table public.payment_status_events enable row level security;
grant select on public.payment_status_events to authenticated;
grant all on public.payment_status_events to service_role;
create policy "participants read own payment status events" on public.payment_status_events for select to authenticated
  using (exists (select 1 from public.payment_transactions p where p.id = payment_id and (p.user_id = auth.uid() or public.has_permission(auth.uid(), 'finance.view'))));

create or replace function public.create_midtrans_payment_order(p_commitment_id uuid, p_amount bigint, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_commitment public.qurban_commitments%rowtype;
  v_program public.programs%rowtype;
  v_profile public.profiles%rowtype;
  v_existing public.payment_transactions%rowtype;
  v_reserved bigint;
  v_remaining bigint;
  v_minimum bigint;
  v_fee bigint := 0;
  v_expires timestamptz;
  v_id uuid;
  v_order text;
begin
  if v_uid is null then raise exception 'Silakan masuk untuk melanjutkan pembayaran'; end if;
  if coalesce(length(btrim(p_idempotency_key)), 0) < 16 or length(p_idempotency_key) > 120 then raise exception 'Permintaan pembayaran tidak valid'; end if;
  select * into v_existing from public.payment_transactions where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> v_uid then raise exception 'Permintaan pembayaran tidak valid'; end if;
    return jsonb_build_object('id', v_existing.id, 'order_id', v_existing.order_id, 'amount', v_existing.amount,
      'gross_amount', v_existing.amount + v_existing.service_fee, 'service_fee', v_existing.service_fee,
      'status', v_existing.status, 'expires_at', v_existing.expires_at, 'snap_token', v_existing.snap_token,
      'snap_redirect_url', v_existing.snap_redirect_url);
  end if;
  select * into v_user from auth.users where id = v_uid;
  if not found or v_user.email_confirmed_at is null then raise exception 'Verifikasi email sebelum melakukan pembayaran'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.terms_accepted_at is null or v_profile.whatsapp = '+620000000000'
    or v_profile.address = 'Belum dilengkapi' or v_profile.birth_date = date '1970-01-01' then
    raise exception 'Lengkapi profil peserta sebelum melakukan pembayaran';
  end if;
  select * into v_commitment from public.qurban_commitments where id = p_commitment_id for update;
  if not found or v_commitment.user_id <> v_uid then raise exception 'Komitmen tidak ditemukan'; end if;
  if v_commitment.execution_status = 'dibatalkan' then raise exception 'Komitmen yang dibatalkan tidak dapat dibayar'; end if;
  select * into v_program from public.programs where id = v_commitment.program_id;
  if not found or v_program.status not in ('open','closed') or now() >= v_program.payment_deadline then raise exception 'Masa pembayaran komitmen telah berakhir'; end if;
  select coalesce(sum(amount), 0) into v_reserved from public.payment_transactions
    where commitment_id = p_commitment_id and status = 'pending' and expires_at > now();
  v_remaining := greatest(v_commitment.total_amount - v_commitment.verified_paid_amount - v_reserved, 0);
  if v_remaining <= 0 then raise exception 'Tidak ada sisa pembayaran yang dapat dibuat'; end if;
  v_minimum := greatest(v_program.minimum_payment, 10000);
  select greatest(0, coalesce((value->>'service_fee')::bigint, 0)) into v_fee from public.app_settings where key = 'payment_config';
  v_fee := coalesce(v_fee, 0);
  if p_amount is null or p_amount < v_minimum or p_amount > v_remaining then raise exception 'Nominal pembayaran tidak sesuai batas'; end if;
  v_expires := least(now() + interval '24 hours', v_program.payment_deadline);
  v_id := gen_random_uuid();
  v_order := 'QRB-' || upper(substr(replace(v_id::text, '-', ''), 1, 28));
  insert into public.payment_transactions (id, user_id, commitment_id, order_id, idempotency_key, amount, service_fee, expires_at)
    values (v_id, v_uid, p_commitment_id, v_order, p_idempotency_key, p_amount, v_fee, v_expires);
  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
    values (v_uid, 'payment.order_created', 'payment_transactions', v_id, 'participant',
      jsonb_build_object('order_id', v_order, 'commitment_id', p_commitment_id, 'amount', p_amount, 'service_fee', v_fee, 'environment', 'sandbox'));
  insert into public.payment_status_events (payment_id, previous_status, new_status, source, details)
    values (v_id, null, 'pending', 'checkout', jsonb_build_object('order_id', v_order));
  return jsonb_build_object('id', v_id, 'order_id', v_order, 'amount', p_amount, 'gross_amount', p_amount + v_fee,
    'service_fee', v_fee, 'status', 'pending', 'expires_at', v_expires, 'snap_token', null, 'snap_redirect_url', null);
end;
$$;

create or replace function public.attach_midtrans_snap(p_payment_id uuid, p_snap_token text, p_redirect_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.payment_transactions where id = p_payment_id and user_id = auth.uid()) then raise exception 'Pembayaran tidak ditemukan'; end if;
  if coalesce(length(p_snap_token), 0) < 20 or p_redirect_url not like 'https://app.sandbox.midtrans.com/%' then raise exception 'Respons pembayaran tidak valid'; end if;
  update public.payment_transactions set snap_token = p_snap_token, snap_redirect_url = p_redirect_url
    where id = p_payment_id and status = 'pending' and expires_at > now();
  if not found then raise exception 'Pembayaran tidak lagi menunggu checkout'; end if;
end;
$$;

create or replace function public.midtrans_apply_payment_status(
  p_order_id text, p_transaction_id text, p_transaction_status text, p_status_code text,
  p_gross_amount bigint, p_payment_method text, p_verified_at timestamptz, p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_commitment public.qurban_commitments%rowtype;
  v_status text;
  v_receipt text;
  v_verify text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Akses ditolak'; end if;
  select * into v_payment from public.payment_transactions where order_id = p_order_id for update;
  if not found then raise exception 'Pembayaran tidak ditemukan'; end if;
  if p_gross_amount <> v_payment.amount + v_payment.service_fee then raise exception 'Nominal gateway tidak cocok'; end if;
  select * into v_commitment from public.qurban_commitments where id = v_payment.commitment_id for update;
  if not found then raise exception 'Komitmen tidak ditemukan'; end if;
  if v_payment.status in ('success','refund_required','refunded') then
    return jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'idempotent', true);
  end if;
  v_status := case p_transaction_status
    when 'settlement' then 'success' when 'capture' then 'success' when 'pending' then 'pending'
    when 'deny' then 'failed' when 'cancel' then 'cancelled' when 'expire' then 'expired'
    when 'failure' then 'failed' when 'refund' then 'refund_required' when 'partial_refund' then 'refund_required'
    else 'failed' end;
  if v_status = 'success' and p_transaction_status = 'capture' and coalesce(p_metadata->>'fraud_status', '') <> 'accept' then v_status := 'pending'; end if;
  if v_status = 'success' then
    if v_commitment.verified_paid_amount + v_payment.amount > v_commitment.total_amount then
      v_status := 'refund_required';
    else
      insert into public.ledger_entries (source_account, dest_account, amount, commitment_id, program_id, reference, basis, idempotency_key, system_source, is_fixture)
        values ('EXTERNAL','COMMITMENT',v_payment.amount,v_payment.commitment_id,v_commitment.program_id,p_order_id,
          'Pembayaran Midtrans Sandbox terverifikasi','midtrans:' || v_payment.id::text,'midtrans_sandbox',true)
        on conflict (idempotency_key) do nothing;
      update public.qurban_commitments set verified_paid_amount = verified_paid_amount + v_payment.amount where id = v_commitment.id;
      v_receipt := 'QRB-R-' || upper(substr(replace(v_payment.id::text, '-', ''), 1, 20));
      v_verify := upper(substr(md5(v_payment.id::text || p_order_id), 1, 16));
    end if;
  end if;
  update public.payment_transactions set status = v_status, gateway_status = p_transaction_status, gateway_status_code = p_status_code,
    transaction_id = coalesce(p_transaction_id, transaction_id), payment_method = coalesce(p_payment_method, payment_method),
    verified_at = case when v_status = 'success' then coalesce(p_verified_at, now()) else verified_at end,
    receipt_number = coalesce(v_receipt, receipt_number), verification_code = coalesce(v_verify, verification_code),
    gateway_metadata = coalesce(p_metadata, '{}'::jsonb)
    where id = v_payment.id;
  insert into public.payment_status_events (payment_id, previous_status, new_status, gateway_status, status_code, source, details)
    values (v_payment.id, v_payment.status, v_status, p_transaction_status, p_status_code,
      coalesce(p_metadata->>'event_source', 'webhook'), jsonb_build_object('transaction_id', p_transaction_id, 'gross_amount', p_gross_amount));
  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
    values (null,'payment.gateway_status','payment_transactions',v_payment.id,'system',
      jsonb_build_object('order_id',p_order_id,'status',v_status,'gateway_status',p_transaction_status,'transaction_id',p_transaction_id,'amount',v_payment.amount,'service_fee',v_payment.service_fee,'environment','sandbox'));
  if v_status = 'success' then
    insert into public.participant_notifications (user_id,kind,title,body,link,dedupe_key)
      values (v_payment.user_id,'payment.success','Pembayaran berhasil','Pembayaran ' || p_order_id || ' telah terverifikasi.',
        '/portal/kurban-saya/' || v_commitment.id::text,'payment-success:' || v_payment.id::text) on conflict (dedupe_key) do nothing;
    perform public.notify_admins('finance.view','payment.success','Pembayaran terverifikasi','Pembayaran sandbox ' || p_order_id || ' telah terverifikasi.','/admin/pembayaran');
  elsif v_status in ('failed','expired','cancelled','refund_required') then
    insert into public.participant_notifications (user_id,kind,title,body,link,dedupe_key)
      values (v_payment.user_id,'payment.' || v_status,'Status pembayaran diperbarui','Status pembayaran ' || p_order_id || ' diperbarui.',
        '/pembayaran/status/' || p_order_id,'payment-status:' || v_payment.id::text || ':' || v_status) on conflict (dedupe_key) do nothing;
    perform public.notify_admins('finance.view','payment.exception','Perlu ditinjau: pembayaran','Pembayaran ' || p_order_id || ' memerlukan pemeriksaan.','/admin/pembayaran');
  end if;
  return jsonb_build_object('payment_id',v_payment.id,'status',v_status,'applied_amount',case when v_status = 'success' then v_payment.amount else 0 end,
    'receipt_number',v_receipt,'verification_code',v_verify,'idempotent',false);
end;
$$;

revoke execute on function public.create_midtrans_payment_order(uuid,bigint,text) from public, anon;
grant execute on function public.create_midtrans_payment_order(uuid,bigint,text) to authenticated;
revoke execute on function public.attach_midtrans_snap(uuid,text,text) from public, anon;
grant execute on function public.attach_midtrans_snap(uuid,text,text) to authenticated;
revoke execute on function public.midtrans_apply_payment_status(text,text,text,text,bigint,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.midtrans_apply_payment_status(text,text,text,text,bigint,text,timestamptz,jsonb) to service_role;