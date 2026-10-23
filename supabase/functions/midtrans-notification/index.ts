import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  applyGatewayStatus,
  constantTimeEqual,
  reportException,
  createServiceClient,
  errorMessage,
  getGatewayConfig,
  getGatewayStatus,
  jsonResponse,
  toRupiahInteger,
  type GatewayStatus,
} from "../_shared/midtrans.ts";
import { corsHeaders } from "../_shared/midtrans.ts";

type Notification = {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
};

async function signatureFor(orderId: string, statusCode: string, grossAmount: string, key: string) {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(`${orderId}${statusCode}${grossAmount}${key}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Metode tidak didukung" }, 405);
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 32_000) return jsonResponse({ error: "Notifikasi terlalu besar" }, 413);

  try {
    const { serverKey } = getGatewayConfig();
    const notification = (await req.json()) as Notification;
    if (
      typeof notification.order_id !== "string" ||
      typeof notification.status_code !== "string" ||
      typeof notification.gross_amount !== "string" ||
      typeof notification.signature_key !== "string"
    ) {
      return jsonResponse({ error: "Notifikasi tidak lengkap" }, 400);
    }
    toRupiahInteger(notification.gross_amount);
    const expected = await signatureFor(
      notification.order_id,
      notification.status_code,
      notification.gross_amount,
      serverKey,
    );
    if (!constantTimeEqual(expected, notification.signature_key.toLowerCase())) {
      console.warn("Rejected Midtrans notification with invalid signature");
      return jsonResponse({ error: "Tanda tangan notifikasi tidak valid" }, 401);
    }

    const status = await getGatewayStatus(notification.order_id, serverKey);
    if (
      toRupiahInteger(status.gross_amount) !== toRupiahInteger(notification.gross_amount)
    ) {
      console.error("Midtrans notification and status amount differ", notification.order_id);
      return jsonResponse({ error: "Nominal notifikasi tidak cocok" }, 409);
    }

    const service = createServiceClient();
    const { data: payment, error } = await service
      .from("payment_transactions")
      .select("order_id, amount, service_fee")
      .eq("order_id", notification.order_id)
      .maybeSingle();
    if (error || !payment) return jsonResponse({ error: "Pesanan tidak dikenal" }, 404);
    if (toRupiahInteger(status.gross_amount) !== payment.amount + payment.service_fee) {
      console.error("Midtrans status amount differs from payment order", notification.order_id);
      await reportException(service, notification.order_id, "amount_mismatch", "Nominal Midtrans tidak sama dengan pesanan");
      return jsonResponse({ error: "Nominal gateway tidak cocok" }, 409);
    }
    await applyGatewayStatus(service, status as GatewayStatus, "webhook");
    return jsonResponse({ received: true });
  } catch (error) {
    console.error("Midtrans notification processing failed", errorMessage(error));
    return jsonResponse({ error: "Notifikasi pembayaran belum dapat diproses" }, 500);
  }
});
