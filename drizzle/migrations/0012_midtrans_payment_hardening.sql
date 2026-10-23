alter table public.payment_transactions
  add column receipt_issuer_snapshot jsonb;

alter table public.payment_status_events
  add column event_key text;

create unique index payment_status_events_event_key_idx
  on public.payment_status_events (event_key)
  where event_key is not null;

create trigger payment_status_events_immutable
  before update or delete on public.payment_status_events
  for each row execute function public.prevent_mutation();

drop function if exists public.post_ledger(
  public.ledger_account, public.ledger_account, bigint, uuid, text, text, text, text, uuid
);

create function public.post_ledger(
  _src public.ledger_account,
  _dst public.ledger_account,
  _amount bigint,
  _commitment uuid,
  _reference text,
  _basis text,
  _key text,
  _system text,
  _reverses uuid,
  _is_fixture boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_balance bigint;
  v_program uuid;
begin
  select id into v_id from public.ledger_entries where idempotency_key = _key;
  if found then
    return v_id;
  end if;
  if _reverses is not null then
    select is_fixture into _is_fixture from public.ledger_entries where id = _reverses;
  end if;
  if _amount is null or _amount <= 0 then
    raise exception 'Nominal posting harus lebih dari 0';
  end if;
  if coalesce(btrim(_basis), '') = '' or coalesce(btrim(_reference), '') = '' then
    raise exception 'Referensi dan dasar posting wajib diisi';
  end if;

  perform pg_advisory_xact_lock(hashtext('ledger:' || _src::text || ':' || coalesce(_commitment::text, '-')));
  if _src <> 'EXTERNAL' then
    select coalesce(
      sum(case when dest_account = _src then amount else 0 end)
        - sum(case when source_account = _src then amount else 0 end),
      0
    )
    into v_balance
    from public.ledger_entries
    where (source_account = _src or dest_account = _src)
      and commitment_id is not distinct from _commitment;
    if v_balance < _amount then
      raise exception 'Saldo akun % tidak mencukupi (saldo %, dibutuhkan %)', _src, v_balance, _amount;
    end if;
  end if;

  if _commitment is not null then
    select program_id into v_program from public.qurban_commitments where id = _commitment;
  end if;

  insert into public.ledger_entries (
    source_account, dest_account, amount, commitment_id, program_id, reference, basis,
    idempotency_key, actor_id, system_source, reverses_id, is_fixture
  )
  values (
    _src, _dst, _amount, _commitment, v_program, _reference, _basis, _key, auth.uid(),
    coalesce(_system, case when auth.uid() is null then 'system' end), _reverses, _is_fixture
  )
  returning id into v_id;

  perform public.write_audit(
    'ledger.post',
    'ledger_entries',
    v_id,
    null,
    jsonb_build_object(
      'source', _src,
      'dest', _dst,
      'amount', _amount,
      'commitment_id', _commitment,
      'reference', _reference,
      'is_fixture', _is_fixture
    ),
    _basis
  );
  return v_id;
end;
$$;

revoke execute on function public.post_ledger(
  public.ledger_account, public.ledger_account, bigint, uuid, text, text, text, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.post_ledger(
  public.ledger_account, public.ledger_account, bigint, uuid, text, text, text, text, uuid, boolean
) to service_role;

create or replace function public.get_payment_config_public()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk untuk melihat opsi pembayaran';
  end if;
  select value into v_config from public.app_settings where key = 'payment_config';
  return jsonb_build_object(
    'minimum_payment', greatest(10000, coalesce((v_config->>'minimum_payment')::bigint, 10000)),
    'maximum_payment', greatest(10000, coalesce((v_config->>'maximum_payment')::bigint, 50000000)),
    'service_fee', greatest(0, coalesce((v_config->>'service_fee')::bigint, 0)),
    'presets', coalesce(v_config->>'presets', '25000,50000,100000,250000,500000,1000000'),
    'methods', coalesce(v_config->>'methods', 'transfer_bank,qris,virtual_account'),
    'environment', 'sandbox'
  );
end;
$$;
revoke execute on function public.get_payment_config_public() from public, anon;
grant execute on function public.get_payment_config_public() to authenticated;

create or replace function public.create_midtrans_payment_order(
  p_commitment_id uuid,
  p_amount bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
  v_commitment public.qurban_commitments%rowtype;
  v_program public.programs%rowtype;
  v_existing public.payment_transactions%rowtype;
  v_config jsonb;
  v_pending bigint;
  v_available bigint;
  v_minimum bigint;
  v_maximum bigint;
  v_fee bigint;
  v_expires timestamptz;
  v_id uuid;
  v_order_id text;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk untuk melanjutkan pembayaran';
  end if;
  if p_commitment_id is null
    or coalesce(length(btrim(p_idempotency_key)), 0) < 16
    or length(p_idempotency_key) > 120 then
    raise exception 'Permintaan pembayaran tidak valid';
  end if;

  select * into v_existing
  from public.payment_transactions
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> v_user_id
      or v_existing.commitment_id <> p_commitment_id
      or v_existing.amount <> p_amount then
      raise exception 'Kunci permintaan pembayaran sudah digunakan';
    end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'order_id', v_existing.order_id,
      'amount', v_existing.amount,
      'gross_amount', v_existing.amount + v_existing.service_fee,
      'service_fee', v_existing.service_fee,
      'status', v_existing.status,
      'expires_at', v_existing.expires_at,
      'snap_token', v_existing.snap_token,
      'snap_redirect_url', v_existing.snap_redirect_url
    );
  end if;

  select * into v_user from auth.users where id = v_user_id;
  if not found or v_user.email_confirmed_at is null then
    raise exception 'Verifikasi email sebelum melakukan pembayaran';
  end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.terms_accepted_at is null
    or v_profile.whatsapp = '+620000000000'
    or v_profile.address = 'Belum dilengkapi'
    or v_profile.birth_date = date '1970-01-01' then
    raise exception 'Lengkapi profil peserta sebelum melakukan pembayaran';
  end if;

  select * into v_commitment
  from public.qurban_commitments
  where id = p_commitment_id
  for update;
  if not found or v_commitment.user_id <> v_user_id then
    raise exception 'Komitmen tidak ditemukan';
  end if;
  if v_commitment.execution_status = 'dibatalkan' then
    raise exception 'Komitmen yang dibatalkan tidak dapat dibayar';
  end if;
  select * into v_program from public.programs where id = v_commitment.program_id;
  if not found or v_program.status not in ('open', 'closed') or now() >= v_program.payment_deadline then
    raise exception 'Masa pembayaran komitmen telah berakhir';
  end if;

  if (
    select count(*) from public.payment_transactions
    where user_id = v_user_id and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'Terlalu banyak permintaan pembayaran. Coba lagi sebentar lagi';
  end if;

  select coalesce(sum(amount), 0) into v_pending
  from public.payment_transactions
  where commitment_id = p_commitment_id
    and status = 'pending'
    and expires_at > now();
  v_available := greatest(v_commitment.total_amount - v_commitment.verified_paid_amount - v_pending, 0);
  if v_available <= 0 then
    raise exception 'Tidak ada sisa pembayaran yang dapat dibuat';
  end if;

  select value into v_config from public.app_settings where key = 'payment_config';
  v_minimum := greatest(v_program.minimum_payment, coalesce((v_config->>'minimum_payment')::bigint, 10000), 10000);
  v_maximum := greatest(v_minimum, coalesce((v_config->>'maximum_payment')::bigint, 50000000));
  v_fee := greatest(0, coalesce((v_config->>'service_fee')::bigint, 0));
  v_minimum := least(v_minimum, v_available);

  if p_amount is null or p_amount < v_minimum or p_amount > v_available or p_amount > v_maximum then
    raise exception 'Nominal pembayaran di luar batas yang diizinkan';
  end if;

  v_expires := least(now() + interval '24 hours', v_program.payment_deadline);
  if v_expires <= now() then
    raise exception 'Masa pembayaran komitmen telah berakhir';
  end if;
  v_id := gen_random_uuid();
  v_order_id := 'QRB-' || upper(substr(replace(v_id::text, '-', ''), 1, 28));

  insert into public.payment_transactions (
    id, user_id, commitment_id, order_id, idempotency_key, amount, service_fee, expires_at
  )
  values (v_id, v_user_id, p_commitment_id, v_order_id, p_idempotency_key, p_amount, v_fee, v_expires);

  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
  values (
    v_user_id,
    'payment.order_created',
    'payment_transactions',
    v_id,
    'participant',
    jsonb_build_object(
      'order_id', v_order_id,
      'commitment_id', p_commitment_id,
      'amount', p_amount,
      'service_fee', v_fee,
      'environment', 'sandbox'
    )
  );
  insert into public.payment_status_events (payment_id, previous_status, new_status, source, details)
  values (v_id, null, 'pending', 'checkout', jsonb_build_object('order_id', v_order_id));

  return jsonb_build_object(
    'id', v_id,
    'order_id', v_order_id,
    'amount', p_amount,
    'gross_amount', p_amount + v_fee,
    'service_fee', v_fee,
    'status', 'pending',
    'expires_at', v_expires,
    'snap_token', null,
    'snap_redirect_url', null
  );
end;
$$;

create or replace function public.attach_midtrans_snap(
  p_payment_id uuid,
  p_snap_token text,
  p_redirect_url text
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
  if coalesce(length(p_snap_token), 0) < 20
    or p_redirect_url not like 'https://app.sandbox.midtrans.com/%' then
    raise exception 'Respons pembayaran tidak valid';
  end if;
  update public.payment_transactions
  set snap_token = p_snap_token, snap_redirect_url = p_redirect_url
  where id = p_payment_id and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'Pembayaran tidak lagi menunggu checkout';
  end if;
end;
$$;

create or replace function public.midtrans_fail_checkout(p_order_id text, p_reason text)
returns void
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
  select * into v_payment
  from public.payment_transactions
  where order_id = p_order_id
  for update;
  if not found or v_payment.status <> 'pending' then
    return;
  end if;

  update public.payment_transactions
  set status = 'failed', gateway_status = 'checkout_error',
      gateway_metadata = jsonb_build_object('checkout_error', left(coalesce(p_reason, 'unknown'), 120))
  where id = v_payment.id;
  insert into public.payment_status_events (
    payment_id, previous_status, new_status, gateway_status, source, details
  )
  values (
    v_payment.id, 'pending', 'failed', 'checkout_error', 'checkout',
    jsonb_build_object('reason', left(coalesce(p_reason, 'unknown'), 120))
  );
  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
  values (
    null, 'payment.checkout_failed', 'payment_transactions', v_payment.id, 'system',
    jsonb_build_object('order_id', p_order_id, 'environment', 'sandbox')
  );
  insert into public.participant_notifications (user_id, kind, title, body, link, dedupe_key)
  values (
    v_payment.user_id, 'payment.failed', 'Pembayaran belum dapat dibuka',
    'Silakan coba buat transaksi pembayaran baru.',
    '/pembayaran/status/' || p_order_id,
    'payment-checkout-failed:' || v_payment.id::text
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.midtrans_apply_payment_status(
  p_order_id text,
  p_transaction_id text,
  p_transaction_status text,
  p_status_code text,
  p_gross_amount bigint,
  p_payment_method text,
  p_verified_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_commitment public.qurban_commitments%rowtype;
  v_status text;
  v_event_key text := nullif(p_metadata->>'event_key', '');
  v_event_source text := coalesce(p_metadata->>'event_source', 'webhook');
  v_ledger_key text;
  v_ledger_id uuid;
  v_receipt text;
  v_verification text;
  v_issuer jsonb;
  v_was_posted boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Akses ditolak';
  end if;
  if p_transaction_status not in ('settlement', 'capture', 'pending', 'deny', 'cancel', 'expire', 'failure', 'refund', 'partial_refund', 'chargeback') then
    raise exception 'Status gateway tidak didukung';
  end if;
  if v_event_source not in ('webhook', 'status_check', 'reconciliation') then
    v_event_source := 'webhook';
  end if;

  select * into v_payment
  from public.payment_transactions
  where order_id = p_order_id
  for update;
  if not found then
    raise exception 'Pembayaran tidak ditemukan';
  end if;
  if p_gross_amount <> v_payment.amount + v_payment.service_fee then
    raise exception 'Nominal gateway tidak cocok';
  end if;
  if p_status_code is null or p_status_code = '' then
    raise exception 'Kode status gateway tidak valid';
  end if;
  if v_event_key is not null and exists (
    select 1 from public.payment_status_events where event_key = v_event_key
  ) then
    return jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'idempotent', true);
  end if;

  select * into v_commitment
  from public.qurban_commitments
  where id = v_payment.commitment_id
  for update;
  if not found then
    raise exception 'Komitmen tidak ditemukan';
  end if;

  if v_payment.status in ('success', 'refund_required', 'refunded') then
    if p_transaction_status in ('refund', 'partial_refund', 'chargeback') then
      insert into public.payment_status_events (
        payment_id, previous_status, new_status, gateway_status, status_code, source, details, event_key
      )
      values (
        v_payment.id, v_payment.status, v_payment.status, p_transaction_status, p_status_code,
        v_event_source, jsonb_build_object('refund_review_required', true, 'transaction_id', p_transaction_id),
        v_event_key
      )
      on conflict (event_key) where event_key is not null do nothing;
      insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
      values (
        null, 'payment.refund_review', 'payment_transactions', v_payment.id, 'system',
        jsonb_build_object('order_id', p_order_id, 'gateway_status', p_transaction_status, 'environment', 'sandbox')
      );
      perform public.notify_admins(
        'finance.view', 'payment.refund_review', 'Pembayaran perlu ditinjau',
        'Midtrans mengirim notifikasi pengembalian untuk transaksi ' || p_order_id || '.',
        '/admin/pembayaran'
      );
    end if;
    return jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'idempotent', true);
  end if;

  v_status := case p_transaction_status
    when 'settlement' then 'success'
    when 'capture' then case when coalesce(p_metadata->>'fraud_status', '') = 'accept' then 'success' else 'pending' end
    when 'pending' then 'pending'
    when 'deny' then 'failed'
    when 'failure' then 'failed'
    when 'cancel' then 'cancelled'
    when 'expire' then 'expired'
    when 'refund' then 'refund_required'
    when 'partial_refund' then 'refund_required'
    when 'chargeback' then 'refund_required'
  end;

  if v_payment.status in ('failed', 'expired', 'cancelled') and v_status = 'pending' then
    insert into public.payment_status_events (
      payment_id, previous_status, new_status, gateway_status, status_code, source, details, event_key
    )
    values (
      v_payment.id, v_payment.status, v_payment.status, p_transaction_status, p_status_code,
      v_event_source, jsonb_build_object('stale_gateway_state_ignored', true), v_event_key
    )
    on conflict (event_key) where event_key is not null do nothing;
    return jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'idempotent', true);
  end if;

  if v_status = 'success' then
    if p_status_code <> '200' then
      raise exception 'Kode status gateway tidak menandakan pembayaran berhasil';
    end if;
    if v_commitment.verified_paid_amount + v_payment.amount > v_commitment.total_amount then
      v_status := 'refund_required';
    else
      v_ledger_key := 'midtrans:' || v_payment.id::text;
      select exists (
        select 1 from public.ledger_entries where idempotency_key = v_ledger_key
      ) into v_was_posted;
      v_ledger_id := public.post_ledger(
        'EXTERNAL',
        'COMMITMENT',
        v_payment.amount,
        v_payment.commitment_id,
        p_order_id,
        'Pembayaran Midtrans Sandbox terverifikasi',
        v_ledger_key,
        'midtrans_sandbox',
        null,
        true
      );
      if not v_was_posted then
        update public.qurban_commitments
        set verified_paid_amount = verified_paid_amount + v_payment.amount
        where id = v_commitment.id;
      end if;
      v_receipt := 'QRB-R-' || upper(substr(replace(v_payment.id::text, '-', ''), 1, 20));
      v_verification := upper(replace(gen_random_uuid()::text, '-', ''));
      v_verification := 'QBN-' || substr(v_verification, 1, 4) || '-' || substr(v_verification, 5, 4);
      select value into v_issuer from public.app_settings where key = 'organization';
    end if;
  end if;

  update public.payment_transactions
  set status = v_status,
      gateway_status = p_transaction_status,
      gateway_status_code = p_status_code,
      transaction_id = coalesce(p_transaction_id, transaction_id),
      payment_method = coalesce(p_payment_method, payment_method),
      verified_at = case when v_status = 'success' then coalesce(p_verified_at, now()) else verified_at end,
      receipt_number = coalesce(v_receipt, receipt_number),
      verification_code = coalesce(v_verification, verification_code),
      receipt_issuer_snapshot = case when v_status = 'success' then coalesce(v_issuer, '{}'::jsonb) else receipt_issuer_snapshot end,
      gateway_metadata = coalesce(p_metadata, '{}'::jsonb)
  where id = v_payment.id;

  insert into public.payment_status_events (
    payment_id, previous_status, new_status, gateway_status, status_code, source, details, event_key
  )
  values (
    v_payment.id, v_payment.status, v_status, p_transaction_status, p_status_code, v_event_source,
    jsonb_build_object('transaction_id', p_transaction_id, 'gross_amount', p_gross_amount),
    v_event_key
  )
  on conflict (event_key) where event_key is not null do nothing;

  insert into public.audit_logs (actor_id, action, entity, entity_id, source, metadata)
  values (
    null, 'payment.gateway_status', 'payment_transactions', v_payment.id, 'system',
    jsonb_build_object(
      'order_id', p_order_id, 'status', v_status, 'gateway_status', p_transaction_status,
      'transaction_id', p_transaction_id, 'amount', v_payment.amount,
      'service_fee', v_payment.service_fee, 'environment', 'sandbox'
    )
  );

  if v_status = 'success' then
    insert into public.participant_notifications (user_id, kind, title, body, link, dedupe_key)
    values (
      v_payment.user_id, 'payment.success', 'Pembayaran berhasil',
      'Pembayaran ' || p_order_id || ' telah terverifikasi.',
      '/portal/kurban-saya/' || v_commitment.id::text,
      'payment-success:' || v_payment.id::text
    )
    on conflict (dedupe_key) do nothing;
    perform public.notify_admins(
      'finance.view', 'payment.success', 'Pembayaran terverifikasi',
      'Pembayaran sandbox ' || p_order_id || ' telah terverifikasi.',
      '/admin/pembayaran'
    );
    if v_commitment.verified_paid_amount + v_payment.amount >= v_commitment.total_amount then
      insert into public.participant_notifications (user_id, kind, title, body, link, dedupe_key)
      values (
        v_payment.user_id, 'payment.paid_off', 'Komitmen kurban lunas',
        'Seluruh pembayaran komitmen ' || v_commitment.code || ' telah terverifikasi.',
        '/portal/kurban-saya/' || v_commitment.id::text,
        'commitment-paid-off:' || v_commitment.id::text
      )
      on conflict (dedupe_key) do nothing;
    end if;
  elsif v_status in ('failed', 'expired', 'cancelled', 'refund_required') and v_payment.status is distinct from v_status then
    insert into public.participant_notifications (user_id, kind, title, body, link, dedupe_key)
    values (
      v_payment.user_id, 'payment.' || v_status,
      case v_status
        when 'failed' then 'Pembayaran gagal'
        when 'expired' then 'Pembayaran kedaluwarsa'
        when 'cancelled' then 'Pembayaran dibatalkan'
        else 'Pembayaran sedang ditinjau'
      end,
      case v_status
        when 'refund_required' then 'Pembayaran ' || p_order_id || ' melebihi sisa komitmen dan sedang ditinjau tim keuangan.'
        else 'Pembayaran ' || p_order_id || ' tidak berhasil. Progres komitmen tidak berubah; kamu dapat membuat pembayaran baru.'
      end,
      '/pembayaran/status/' || p_order_id,
      'payment-status:' || v_payment.id::text || ':' || v_status
    )
    on conflict (dedupe_key) do nothing;
    if v_status = 'refund_required' then
      perform public.notify_admins(
        'finance.view', 'payment.exception', 'Perlu ditinjau: pembayaran',
        'Pembayaran ' || p_order_id || ' memerlukan pemeriksaan.',
        '/admin/pembayaran'
      );
    end if;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'status', v_status,
    'applied_amount', case when v_status = 'success' then v_payment.amount else 0 end,
    'receipt_number', v_receipt,
    'verification_code', v_verification,
    'ledger_entry_id', v_ledger_id,
    'idempotent', false
  );
end;
$$;

create or replace function public.admin_payment_summary(p_program_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_perm('finance.view');
  return (
    select jsonb_build_object(
      'successful_count', count(*) filter (where p.status = 'success'),
      'verified_amount', coalesce(sum(p.amount) filter (where p.status = 'success'), 0),
      'pending_count', count(*) filter (where p.status = 'pending' and p.expires_at > now()),
      'failed_count', count(*) filter (where p.status in ('failed', 'cancelled')),
      'expired_count', count(*) filter (where p.status = 'expired' or (p.status = 'pending' and p.expires_at <= now())),
      'refund_review_count', count(*) filter (where p.status = 'refund_required'),
      'unreconciled_count', count(*) filter (
        where p.status = 'success'
          and not exists (select 1 from public.ledger_entries e where e.idempotency_key = 'midtrans:' || p.id::text)
      ),
      'last_updated_at', max(p.updated_at),
      'environment', 'sandbox'
    )
    from public.payment_transactions p
    join public.qurban_commitments c on c.id = p.commitment_id
    where p_program_id is null or c.program_id = p_program_id
  );
end;
$$;

create or replace function public.admin_payment_page(
  p_search text default null,
  p_status text default null,
  p_method text default null,
  p_program_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_export boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), case when p_export then 10000 else 100 end);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  perform public.require_perm('finance.view');
  if p_export then
    perform public.require_perm('reports.export');
    perform public.write_audit('report.export', 'report', null, null, null, null,
      jsonb_build_object('kind', 'pembayaran', 'program_id', p_program_id, 'environment', 'sandbox'));
  end if;
  if p_status is not null and p_status not in ('pending', 'success', 'failed', 'expired', 'cancelled', 'refund_required', 'refunded') then
    raise exception 'Filter status pembayaran tidak valid';
  end if;

  with filtered as (
    select
      p.id, p.order_id, p.user_id, p.commitment_id, p.amount, p.service_fee, p.payment_method, p.status,
      p.gateway_status, p.created_at, p.updated_at, p.expires_at, p.verified_at, p.environment,
      pr.full_name, pr.email, c.code as commitment_code, c.category_name_snapshot, prog.name as program_name,
      prog.id as program_id, p.receipt_number
    from public.payment_transactions p
    join public.profiles pr on pr.id = p.user_id
    join public.qurban_commitments c on c.id = p.commitment_id
    join public.programs prog on prog.id = c.program_id
    where (p_search is null or btrim(p_search) = '' or
      p.order_id ilike '%' || btrim(p_search) || '%' or
      pr.full_name ilike '%' || btrim(p_search) || '%' or
      pr.email ilike '%' || btrim(p_search) || '%' or
      c.code ilike '%' || btrim(p_search) || '%')
      and (p_status is null or p.status = p_status)
      and (p_method is null or p_method = '' or p.payment_method = p_method)
      and (p_program_id is null or c.program_id = p_program_id)
      and (p_from is null or p.created_at >= p_from)
      and (p_to is null or p.created_at < p_to)
  ),
  paged as (
    select * from filtered order by created_at desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total_count', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(paged) order by created_at desc) from paged
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_payment_detail(p_payment_id uuid)
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
    'payment', to_jsonb(p),
    'participant', jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'whatsapp', pr.whatsapp),
    'commitment', jsonb_build_object(
      'id', c.id, 'code', c.code, 'category', c.category_name_snapshot,
      'total_amount', c.total_amount, 'verified_paid_amount', c.verified_paid_amount,
      'execution_status', c.execution_status
    ),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from public.payment_status_events e where e.payment_id = p.id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.ledger_entries l where l.idempotency_key = 'midtrans:' || p.id::text
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from public.audit_logs a
      where a.entity = 'payment_transactions' and a.entity_id = p.id
    ), '[]'::jsonb)
  ) into v_result
  from public.payment_transactions p
  join public.profiles pr on pr.id = p.user_id
  join public.qurban_commitments c on c.id = p.commitment_id
  where p.id = p_payment_id;
  if v_result is null then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  return v_result;
end;
$$;

create or replace function public.verify_payment_receipt(p_verification_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if coalesce(length(btrim(p_verification_code)), 0) < 8 then
    return null;
  end if;
  select jsonb_build_object(
    'receipt_number', p.receipt_number,
    'verification_code', p.verification_code,
    'amount', p.amount,
    'paid_at', p.verified_at,
    'commitment_code', c.code,
    'category', c.category_name_snapshot,
    'environment', p.environment,
    'issuer', p.receipt_issuer_snapshot
  ) into v_result
  from public.payment_transactions p
  join public.qurban_commitments c on c.id = p.commitment_id
  where p.verification_code = upper(btrim(p_verification_code))
    and p.status = 'success'
    and p.verified_at is not null;
  return v_result;
end;
$$;

revoke execute on function public.create_midtrans_payment_order(uuid, bigint, text) from public, anon;
grant execute on function public.create_midtrans_payment_order(uuid, bigint, text) to authenticated;
revoke execute on function public.attach_midtrans_snap(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_midtrans_snap(uuid, text, text) to service_role;
revoke execute on function public.midtrans_fail_checkout(text, text) from public, anon, authenticated;
grant execute on function public.midtrans_fail_checkout(text, text) to service_role;
revoke execute on function public.midtrans_apply_payment_status(text, text, text, text, bigint, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.midtrans_apply_payment_status(text, text, text, text, bigint, text, timestamptz, jsonb) to service_role;
revoke execute on function public.admin_payment_summary(uuid) from public, anon;
grant execute on function public.admin_payment_summary(uuid) to authenticated;
revoke execute on function public.admin_payment_page(text, text, text, uuid, timestamptz, timestamptz, integer, integer, boolean) from public, anon;
grant execute on function public.admin_payment_page(text, text, text, uuid, timestamptz, timestamptz, integer, integer, boolean) to authenticated;
revoke execute on function public.admin_payment_detail(uuid) from public, anon;
grant execute on function public.admin_payment_detail(uuid) to authenticated;
revoke execute on function public.verify_payment_receipt(text) from public, anon, authenticated;
grant execute on function public.verify_payment_receipt(text) to anon, authenticated;

create or replace function public.admin_participant_report(
  p_program_id uuid default null,
  p_export boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.require_perm('participants.view');
  if p_export then
    perform public.require_perm('reports.export');
  end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.joined_at), '[]'::jsonb)
  into v_result
  from (
    select
      p.full_name,
      p.email,
      p.whatsapp,
      p.created_at as joined_at,
      count(c.id) as commitments,
      coalesce(sum(c.total_amount), 0) as committed_amount,
      coalesce((
        select sum(e.amount)
        from public.ledger_entries e
        join public.qurban_commitments paid_c on paid_c.id = e.commitment_id
        where paid_c.user_id = p.id
          and (p_program_id is null or paid_c.program_id = p_program_id)
          and e.source_account = 'EXTERNAL'
          and e.dest_account = 'COMMITMENT'
          and not e.is_fixture
      ), 0) as verified_amount
    from public.profiles p
    left join public.qurban_commitments c
      on c.user_id = p.id and (p_program_id is null or c.program_id = p_program_id)
    where not exists (select 1 from public.admin_members m where m.user_id = p.id)
      and (
        p_program_id is null
        or exists (
          select 1 from public.qurban_commitments scoped_c
          where scoped_c.user_id = p.id and scoped_c.program_id = p_program_id
        )
      )
    group by p.id
  ) r;

  if p_export then
    perform public.write_audit(
      'report.export',
      'report',
      null,
      null,
      null,
      null,
      jsonb_build_object('kind', 'peserta', 'program_id', p_program_id)
    );
  end if;
  return v_result;
end;
$$;

revoke execute on function public.admin_participant_report(uuid, boolean) from public, anon;
grant execute on function public.admin_participant_report(uuid, boolean) to authenticated;
