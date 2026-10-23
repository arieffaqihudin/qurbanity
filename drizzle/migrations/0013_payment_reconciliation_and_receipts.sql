-- Phase 4: reconciliation history, gateway connectivity checks, receipts and sandbox ledger views.
-- Additive only. Sandbox ledger entries are tagged system_source = 'midtrans_sandbox' and is_fixture = true,
-- so they never enter real collected-funds reports.

create table public.payment_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('manual', 'scheduled')),
  actor_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  checked_count integer not null default 0 check (checked_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  expired_count integer not null default 0 check (expired_count >= 0),
  mismatch_count integer not null default 0 check (mismatch_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  findings jsonb not null default '[]'::jsonb,
  environment text not null default 'sandbox' check (environment = 'sandbox')
);
create index payment_reconciliation_runs_started_idx on public.payment_reconciliation_runs (started_at desc);
create trigger payment_reconciliation_runs_immutable
  before update or delete on public.payment_reconciliation_runs
  for each row execute function public.prevent_mutation();
alter table public.payment_reconciliation_runs enable row level security;
grant select on public.payment_reconciliation_runs to authenticated;
grant all on public.payment_reconciliation_runs to service_role;
create policy "finance reads reconciliation runs" on public.payment_reconciliation_runs
  for select to authenticated using (public.has_permission(auth.uid(), 'finance.view'));

create table public.payment_gateway_checks (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  ok boolean not null,
  keys_configured boolean not null,
  http_status integer,
  detail text,
  environment text not null default 'sandbox' check (environment = 'sandbox')
);
create index payment_gateway_checks_checked_idx on public.payment_gateway_checks (checked_at desc);
create trigger payment_gateway_checks_immutable
  before update or delete on public.payment_gateway_checks
  for each row execute function public.prevent_mutation();
alter table public.payment_gateway_checks enable row level security;
grant select on public.payment_gateway_checks to authenticated;
grant all on public.payment_gateway_checks to service_role;
create policy "finance reads gateway checks" on public.payment_gateway_checks
  for select to authenticated using (public.has_permission(auth.uid(), 'finance.view'));

-- Service-role helpers used by Edge Functions ---------------------------------

create or replace function public.record_reconciliation_run(
  p_trigger text,
  p_actor uuid,
  p_started_at timestamptz,
  p_checked integer,
  p_updated integer,
  p_expired integer,
  p_mismatch integer,
  p_errors integer,
  p_findings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Akses ditolak';
  end if;
  insert into public.payment_reconciliation_runs (
    trigger_source, actor_id, started_at, checked_count, updated_count, expired_count,
    mismatch_count, error_count, findings
  )
  values (
    p_trigger, p_actor, coalesce(p_started_at, now()), p_checked, p_updated, p_expired,
    p_mismatch, p_errors, coalesce(p_findings, '[]'::jsonb)
  )
  returning id into v_id;
  perform public.write_audit(
    'payment.reconciliation_run', 'payment_reconciliation_runs', v_id, null,
    jsonb_build_object('trigger', p_trigger, 'checked', p_checked, 'updated', p_updated,
      'mismatch', p_mismatch, 'errors', p_errors, 'environment', 'sandbox'),
    null
  );
  if p_mismatch > 0 or p_errors > 0 then
    perform public.notify_admins(
      'finance.view', 'payment.reconciliation_mismatch', 'Rekonsiliasi menemukan selisih',
      p_mismatch || ' ketidakcocokan dan ' || p_errors || ' kendala ditemukan pada pencocokan terakhir.',
      '/admin/keuangan'
    );
  end if;
  return v_id;
end;
$$;

create or replace function public.record_gateway_check(
  p_actor uuid,
  p_ok boolean,
  p_keys_configured boolean,
  p_http_status integer,
  p_detail text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Akses ditolak';
  end if;
  insert into public.payment_gateway_checks (actor_id, ok, keys_configured, http_status, detail)
  values (p_actor, p_ok, p_keys_configured, p_http_status, left(p_detail, 200));
end;
$$;

create or replace function public.midtrans_report_exception(
  p_order_id text,
  p_kind text,
  p_detail text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Akses ditolak';
  end if;
  select id into v_payment_id from public.payment_transactions where order_id = p_order_id;
  perform public.write_audit(
    'payment.exception', 'payment_transactions', v_payment_id, null,
    jsonb_build_object('order_id', p_order_id, 'kind', left(p_kind, 40), 'environment', 'sandbox'),
    left(p_detail, 200)
  );
  perform public.notify_admins(
    'finance.view', 'payment.exception', 'Perlu ditinjau: pembayaran',
    'Transaksi ' || coalesce(p_order_id, '-') || ': ' || left(p_detail, 160),
    '/admin/pembayaran'
  );
end;
$$;

-- Marks a pending order expired only when its Snap session is certainly over and the gateway has no record of it.
create or replace function public.midtrans_expire_unopened(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_transactions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Akses ditolak';
  end if;
  select * into v_payment from public.payment_transactions where order_id = p_order_id for update;
  if not found or v_payment.status <> 'pending' or v_payment.expires_at > now() - interval '5 minutes' then
    return false;
  end if;
  update public.payment_transactions
  set status = 'expired', gateway_status = 'expire', gateway_metadata = jsonb_build_object('reason', 'never_opened')
  where id = v_payment.id;
  insert into public.payment_status_events (payment_id, previous_status, new_status, gateway_status, source, details)
  values (v_payment.id, 'pending', 'expired', 'expire', 'reconciliation', jsonb_build_object('reason', 'never_opened'));
  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
  values (null, 'payment.gateway_status', 'payment_transactions', v_payment.id, 'system',
    jsonb_build_object('order_id', p_order_id, 'status', 'expired', 'reason', 'never_opened', 'environment', 'sandbox'));
  insert into public.participant_notifications (user_id, kind, title, body, link, dedupe_key)
  values (
    v_payment.user_id, 'payment.expired', 'Pembayaran kedaluwarsa',
    'Pembayaran ' || p_order_id || ' tidak diselesaikan. Progres komitmen tidak berubah; kamu dapat membuat pembayaran baru.',
    '/pembayaran/status/' || p_order_id,
    'payment-status:' || v_payment.id::text || ':expired'
  )
  on conflict (dedupe_key) do nothing;
  return true;
end;
$$;

-- Admin reads ---------------------------------------------------------------

create or replace function public.admin_reconciliation_summary(p_program_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.require_perm('finance.view');
  select jsonb_build_object(
    'verified_amount', coalesce(sum(p.amount) filter (where p.status = 'success'), 0),
    'verified_count', count(*) filter (where p.status = 'success'),
    'pending_amount', coalesce(sum(p.amount) filter (where p.status = 'pending' and p.expires_at > now()), 0),
    'pending_count', count(*) filter (where p.status = 'pending' and p.expires_at > now()),
    'stale_pending_count', count(*) filter (where p.status = 'pending' and p.expires_at <= now()),
    'missing_ledger_count', count(*) filter (
      where p.status = 'success'
        and not exists (select 1 from public.ledger_entries e where e.idempotency_key = 'midtrans:' || p.id::text)
    ),
    'sandbox_ledger_amount', coalesce((
      select sum(e.amount) from public.ledger_entries e
      where e.system_source = 'midtrans_sandbox' and e.source_account = 'EXTERNAL' and e.dest_account = 'COMMITMENT'
        and (p_program_id is null or e.program_id = p_program_id)
    ), 0),
    'commitment_mismatch_count', (
      select count(*) from public.qurban_commitments c
      where (p_program_id is null or c.program_id = p_program_id)
        and exists (select 1 from public.payment_transactions x where x.commitment_id = c.id)
        and c.verified_paid_amount <> coalesce((
          select sum(x.amount) from public.payment_transactions x
          where x.commitment_id = c.id and x.status = 'success'
        ), 0)
    ),
    'last_run', (
      select to_jsonb(r) - 'findings' from public.payment_reconciliation_runs r order by r.started_at desc limit 1
    ),
    'last_check', (
      select to_jsonb(g) from public.payment_gateway_checks g order by g.checked_at desc limit 1
    ),
    'environment', 'sandbox'
  ) into v_result
  from public.payment_transactions p
  join public.qurban_commitments pc on pc.id = p.commitment_id
  where p_program_id is null or pc.program_id = p_program_id;
  return v_result;
end;
$$;

create or replace function public.admin_reconciliation_issues(p_program_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_perm('finance.view');
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select p.id as payment_id, p.order_id, c.code as commitment_code, p.amount, p.created_at,
        'success_without_ledger' as kind,
        'Pembayaran berhasil tetapi belum ada posting ledger' as detail
      from public.payment_transactions p
      join public.qurban_commitments c on c.id = p.commitment_id
      where p.status = 'success'
        and (p_program_id is null or c.program_id = p_program_id)
        and not exists (select 1 from public.ledger_entries e where e.idempotency_key = 'midtrans:' || p.id::text)
      union all
      select p.id, p.order_id, c.code, p.amount, p.created_at,
        'ledger_without_success',
        'Ada posting ledger tetapi pembayaran belum berstatus berhasil'
      from public.ledger_entries e
      join public.payment_transactions p on e.idempotency_key = 'midtrans:' || p.id::text
      join public.qurban_commitments c on c.id = p.commitment_id
      where p.status <> 'success' and (p_program_id is null or c.program_id = p_program_id)
      union all
      select p.id, p.order_id, c.code, p.amount, p.created_at,
        'stale_pending',
        'Masih menunggu setelah batas waktu; perlu diperiksa ke Midtrans'
      from public.payment_transactions p
      join public.qurban_commitments c on c.id = p.commitment_id
      where p.status = 'pending' and p.expires_at <= now() and (p_program_id is null or c.program_id = p_program_id)
      union all
      select null::uuid, null, c.code, c.verified_paid_amount, c.created_at,
        'commitment_total_mismatch',
        'Dana terverifikasi komitmen tidak sama dengan total pembayaran berhasil'
      from public.qurban_commitments c
      where (p_program_id is null or c.program_id = p_program_id)
        and exists (select 1 from public.payment_transactions x where x.commitment_id = c.id)
        and c.verified_paid_amount <> coalesce((
          select sum(x.amount) from public.payment_transactions x
          where x.commitment_id = c.id and x.status = 'success'
        ), 0)
      union all
      select p.id, p.order_id, c.code, p.amount, p.updated_at,
        'refund_review',
        'Kelebihan bayar atau pengembalian dari Midtrans perlu ditinjau'
      from public.payment_transactions p
      join public.qurban_commitments c on c.id = p.commitment_id
      where p.status = 'refund_required' and (p_program_id is null or c.program_id = p_program_id)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_reconciliation_runs(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_perm('finance.view');
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.started_at desc) from (
      select r.id, r.trigger_source, r.started_at, r.finished_at, r.checked_count, r.updated_count,
        r.expired_count, r.mismatch_count, r.error_count, r.findings, pr.full_name as actor_name
      from public.payment_reconciliation_runs r
      left join public.profiles pr on pr.id = r.actor_id
      order by r.started_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_sandbox_ledger_balances(p_program_id uuid default null)
returns table(account public.ledger_account, balance bigint, entries bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_perm('finance.view');
  return query
  select a.acc,
    (coalesce((select sum(amount) from public.ledger_entries where dest_account = a.acc and system_source = 'midtrans_sandbox' and (p_program_id is null or program_id = p_program_id)), 0)
      - coalesce((select sum(amount) from public.ledger_entries where source_account = a.acc and system_source = 'midtrans_sandbox' and (p_program_id is null or program_id = p_program_id)), 0))::bigint,
    (select count(*) from public.ledger_entries where (dest_account = a.acc or source_account = a.acc) and system_source = 'midtrans_sandbox' and (p_program_id is null or program_id = p_program_id))
  from unnest(enum_range(null::public.ledger_account)) as a(acc);
end;
$$;

create or replace function public.admin_payment_gateway_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_perm('finance.view');
  return jsonb_build_object(
    'gateway', 'Midtrans',
    'environment', 'sandbox',
    'last_check', (select to_jsonb(g) from public.payment_gateway_checks g order by g.checked_at desc limit 1),
    'last_success_check', (select g.checked_at from public.payment_gateway_checks g where g.ok order by g.checked_at desc limit 1)
  );
end;
$$;

-- Participant/admin receipt (only for verified payments) --------------------

create or replace function public.get_payment_receipt(p_order_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'Silakan masuk untuk melihat kuitansi';
  end if;
  select jsonb_build_object(
    'order_id', p.order_id,
    'receipt_number', p.receipt_number,
    'verification_code', p.verification_code,
    'amount', p.amount,
    'payment_method', p.payment_method,
    'paid_at', p.verified_at,
    'environment', p.environment,
    'issuer', coalesce(p.receipt_issuer_snapshot, '{}'::jsonb),
    'participant_name', pr.full_name,
    'commitment_code', c.code,
    'category', c.category_name_snapshot,
    'commitment_total', c.total_amount,
    'verified_total', coalesce((
      select sum(x.amount) from public.payment_transactions x
      where x.commitment_id = c.id and x.status = 'success'
        and (x.verified_at, x.created_at, x.id) <= (p.verified_at, p.created_at, p.id)
    ), 0)
  ) into v_result
  from public.payment_transactions p
  join public.profiles pr on pr.id = p.user_id
  join public.qurban_commitments c on c.id = p.commitment_id
  where p.order_id = p_order_id
    and p.status = 'success'
    and p.receipt_number is not null
    and (p.user_id = v_user or public.has_permission(v_user, 'finance.view'));
  if v_result is null then
    raise exception 'Kuitansi tidak ditemukan atau pembayaran belum terverifikasi';
  end if;
  return v_result;
end;
$$;

revoke execute on function public.record_reconciliation_run(text, uuid, timestamptz, integer, integer, integer, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.record_reconciliation_run(text, uuid, timestamptz, integer, integer, integer, integer, integer, jsonb) to service_role;
revoke execute on function public.record_gateway_check(uuid, boolean, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.record_gateway_check(uuid, boolean, boolean, integer, text) to service_role;
revoke execute on function public.midtrans_report_exception(text, text, text) from public, anon, authenticated;
grant execute on function public.midtrans_report_exception(text, text, text) to service_role;
revoke execute on function public.midtrans_expire_unopened(text) from public, anon, authenticated;
grant execute on function public.midtrans_expire_unopened(text) to service_role;
revoke execute on function public.admin_reconciliation_summary(uuid) from public, anon;
grant execute on function public.admin_reconciliation_summary(uuid) to authenticated;
revoke execute on function public.admin_reconciliation_issues(uuid) from public, anon;
grant execute on function public.admin_reconciliation_issues(uuid) to authenticated;
revoke execute on function public.admin_reconciliation_runs(integer) from public, anon;
grant execute on function public.admin_reconciliation_runs(integer) to authenticated;
revoke execute on function public.admin_sandbox_ledger_balances(uuid) from public, anon;
grant execute on function public.admin_sandbox_ledger_balances(uuid) to authenticated;
revoke execute on function public.admin_payment_gateway_status() from public, anon;
grant execute on function public.admin_payment_gateway_status() to authenticated;
revoke execute on function public.get_payment_receipt(text) from public, anon;
grant execute on function public.get_payment_receipt(text) to authenticated;

-- Payment records with a gateway outcome are financial evidence and must not be deleted.
create or replace function public.protect_payment_transactions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'pending' or exists (select 1 from public.payment_status_events e where e.payment_id = old.id) then
    raise exception 'Catatan pembayaran tidak dapat dihapus';
  end if;
  return old;
end;
$$;

drop trigger if exists payment_transactions_no_delete on public.payment_transactions;
create trigger payment_transactions_no_delete
  before delete on public.payment_transactions
  for each row execute function public.protect_payment_transactions();
