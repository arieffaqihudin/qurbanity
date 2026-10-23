import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  applyGatewayStatus,
  reportException,
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
import { corsHeaders } from "../_shared/midtrans.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Metode tidak didukung" }, 405);

  try {
    const { serverKey, clientKey } = getGatewayConfig();
    const { client, user } = await createUserClient(req);
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Permintaan tidak valid" }, 400);
    }
    const adminCheck = body.admin_check === true;
    if (adminCheck) await requireFinancePermission(client);

    const service = createServiceClient();
    let query = service
      .from("payment_transactions")
      .select("id, order_id, user_id, amount, service_fee, status")
      .limit(1);
    if (typeof body.payment_id === "string") query = query.eq("id", body.payment_id);
    else if (typeof body.order_id === "string") query = query.eq("order_id", body.order_id);
    else return jsonResponse({ error: "Transaksi tidak ditemukan" }, 400);
    const { data: payment, error } = await query.maybeSingle();
    if (error || !payment || (!adminCheck && payment.user_id !== user.id)) {
      return jsonResponse({ error: "Transaksi tidak ditemukan" }, 404);
    }

    let status;
    try {
      status = await getGatewayStatus(payment.order_id, serverKey);
    } catch (error) {
      // Midtrans has no record until the participant picks a payment method in Snap.
      if (error instanceof GatewayHttpError && error.status === 404) {
        return jsonResponse({
          status: { status: payment.status },
          gateway_status: "not_found",
          client_key: adminCheck ? undefined : clientKey,
        });
      }
      throw error;
    }
    if (toRupiahInteger(status.gross_amount) !== payment.amount + payment.service_fee) {
      console.error("Midtrans status amount differs from payment order", payment.order_id);
      await reportException(service, payment.order_id, "amount_mismatch", "Nominal Midtrans tidak sama dengan pesanan");
      return jsonResponse({ error: "Nominal gateway tidak cocok; transaksi perlu ditinjau" }, 409);
    }
    const applied = await applyGatewayStatus(service, status, adminCheck ? "reconciliation" : "status_check");
    return jsonResponse({
      status: applied,
      gateway_status: status.transaction_status,
      client_key: adminCheck ? undefined : clientKey,
    });
  } catch (error) {
    console.error("Midtrans status check failed", errorMessage(error));
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
