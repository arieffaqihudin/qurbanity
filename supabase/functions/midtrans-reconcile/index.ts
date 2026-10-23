import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  applyGatewayStatus,
  constantTimeEqual,
  corsHeaders,
  createServiceClient,
  createUserClient,
  errorMessage,
  GatewayHttpError,
  getGatewayConfig,
  getGatewayStatus,
  jsonResponse,
  requireFinancePermission,
  toRupiahInteger,
} from "../_shared/midtrans.ts";

const BATCH_LIMIT = 200;
const MANUAL_COOLDOWN_MS = 30_000;

type Finding = { order_id: string; kind: string; detail: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Metode tidak didukung" }, 405);

  const startedAt = new Date().toISOString();
  try {
    const { serverKey } = getGatewayConfig();
    const service = createServiceClient();

    // Scheduled jobs authenticate with a shared secret; everyone else needs a finance.manage session.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret") ?? "";
    let trigger: "manual" | "scheduled";
    let actorId: string | null = null;
    if (provided) {
      if (!cronSecret || !constantTimeEqual(provided, cronSecret)) {
        return jsonResponse({ error: "Akses ditolak" }, 401);
      }
      trigger = "scheduled";
    } else {
      const { client, user } = await createUserClient(req);
      await requireFinancePermission(client, "finance.manage");
      trigger = "manual";
      actorId = user.id;
      const { data: last } = await service
        .from("payment_reconciliation_runs")
        .select("started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && Date.now() - new Date(last.started_at).getTime() < MANUAL_COOLDOWN_MS) {
        return jsonResponse({ error: "Rekonsiliasi baru saja dijalankan. Coba lagi sebentar lagi." }, 429);
      }
    }

    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const [pending, recentSuccess] = await Promise.all([
      service
        .from("payment_transactions")
        .select("id, order_id, amount, service_fee, status, expires_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(BATCH_LIMIT),
      service
        .from("payment_transactions")
        .select("id, order_id, amount, service_fee, status, expires_at")
        .eq("status", "success")
        .gte("verified_at", since)
        .order("verified_at", { ascending: false })
        .limit(BATCH_LIMIT),
    ]);
    if (pending.error || recentSuccess.error) throw new Error("Data transaksi tidak dapat dibaca");
    const payments = [...(pending.data ?? []), ...(recentSuccess.data ?? [])];

    let checked = 0;
    let updated = 0;
    let expired = 0;
    let mismatch = 0;
    let errors = 0;
    const findings: Finding[] = [];

    for (const payment of payments) {
      checked += 1;
      try {
        const status = await getGatewayStatus(payment.order_id, serverKey);
        if (toRupiahInteger(status.gross_amount) !== payment.amount + payment.service_fee) {
          mismatch += 1;
          findings.push({
            order_id: payment.order_id,
            kind: "amount_mismatch",
            detail: "Nominal Midtrans tidak sama dengan pesanan",
          });
          continue;
        }
        const applied = (await applyGatewayStatus(service, status, "reconciliation")) as {
          idempotent?: boolean;
        } | null;
        if (applied && applied.idempotent === false) updated += 1;
        if (
          payment.status === "success" &&
          status.transaction_status !== "settlement" &&
          status.transaction_status !== "capture"
        ) {
          mismatch += 1;
          findings.push({
            order_id: payment.order_id,
            kind: "gateway_status_differs",
            detail: `Tercatat berhasil, status Midtrans: ${status.transaction_status}`,
          });
        }
      } catch (error) {
        if (error instanceof GatewayHttpError && error.status === 404 && payment.status === "pending") {
          const { data: didExpire } = await service.rpc("midtrans_expire_unopened", {
            p_order_id: payment.order_id,
          });
          if (didExpire === true) {
            expired += 1;
            updated += 1;
          }
          continue;
        }
        errors += 1;
        findings.push({
          order_id: payment.order_id,
          kind: "check_failed",
          detail: "Status Midtrans tidak dapat diperiksa",
        });
        console.error("Reconciliation check failed", payment.order_id, errorMessage(error));
      }
    }

    const { data: runId } = await service.rpc("record_reconciliation_run", {
      p_trigger: trigger,
      p_actor: actorId,
      p_started_at: startedAt,
      p_checked: checked,
      p_updated: updated,
      p_expired: expired,
      p_mismatch: mismatch,
      p_errors: errors,
      p_findings: findings.slice(0, 100),
    });
    return jsonResponse({ run_id: runId, checked, updated, expired, mismatch, errors });
  } catch (error) {
    console.error("Reconciliation failed", errorMessage(error));
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
