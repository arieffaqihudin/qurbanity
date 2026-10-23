import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  createUserClient,
  errorMessage,
  getGatewayConfig,
  jsonResponse,
} from "../_shared/midtrans.ts";

type Order = {
  id: string;
  order_id: string;
  amount: number;
  gross_amount: number;
  service_fee: number;
  status: string;
  expires_at: string;
  snap_token: string | null;
  snap_redirect_url: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders, "Content-Length": "0" } });
  if (req.method !== "POST") return jsonResponse({ error: "Metode tidak didukung" }, 405);

  try {
    const { serverKey, clientKey } = getGatewayConfig();
    const { client: userClient, user } = await createUserClient(req);
    const body = await req.json();
    if (
      !body ||
      typeof body !== "object" ||
      typeof body.commitment_id !== "string" ||
      typeof body.amount !== "number" ||
      !Number.isSafeInteger(body.amount) ||
      typeof body.idempotency_key !== "string"
    ) {
      return jsonResponse({ error: "Data pembayaran tidak valid" }, 400);
    }

    const { data, error } = await userClient.rpc("create_midtrans_payment_order", {
      p_commitment_id: body.commitment_id,
      p_amount: body.amount,
      p_idempotency_key: body.idempotency_key,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return jsonResponse({ error: error?.message ?? "Pesanan pembayaran tidak dapat dibuat" }, 400);
    }
    const order = data as Order;
    if (!order.id || !order.order_id || order.status !== "pending") {
      return jsonResponse({ error: "Pesanan tidak lagi dapat dibayar" }, 409);
    }

    const service = createServiceClient();
    if (order.snap_token && order.snap_redirect_url) {
      return jsonResponse({
        payment_id: order.id,
        order_id: order.order_id,
        amount: order.amount,
        gross_amount: order.gross_amount,
        service_fee: order.service_fee,
        expires_at: order.expires_at,
        snap_token: order.snap_token,
        snap_redirect_url: order.snap_redirect_url,
        client_key: clientKey,
      });
    }

    const [{ data: profile, error: profileError }, { data: commitment, error: commitmentError }] =
      await Promise.all([
        service.from("profiles").select("full_name, email, whatsapp").eq("id", user.id).single(),
        service.from("qurban_commitments").select("code").eq("id", body.commitment_id).single(),
      ]);
    if (profileError || commitmentError || !profile || !commitment) {
      return jsonResponse({ error: "Data peserta atau komitmen tidak ditemukan" }, 404);
    }

    const expiryMinutes = Math.max(
      1,
      Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 60000),
    );
    const itemDetails = [
      {
        id: commitment.code,
        price: order.amount,
        quantity: 1,
        name: `Setoran kurban ${commitment.code}`.slice(0, 50),
      },
    ];
    if (order.service_fee > 0) {
      itemDetails.push({
        id: "BIAYA-LAYANAN",
        price: order.service_fee,
        quantity: 1,
        name: "Biaya layanan",
      });
    }

    const gatewayResponse = await fetch(
      "https://app.sandbox.midtrans.com/snap/v1/transactions",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${serverKey}:`)}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          transaction_details: { order_id: order.order_id, gross_amount: order.gross_amount },
          item_details: itemDetails,
          customer_details: {
            first_name: profile.full_name,
            email: profile.email || user.email,
            phone: profile.whatsapp,
          },
          expiry: { unit: "minute", duration: expiryMinutes },
          callbacks: {
            finish: `${Deno.env.get("APP_BASE_URL") ?? "http://localhost:8080"}/pembayaran/status/${encodeURIComponent(order.order_id)}`,
          },
        }),
      },
    );
    const gatewayResult = await gatewayResponse.json().catch(() => null);
    if (
      !gatewayResponse.ok ||
      !gatewayResult ||
      typeof gatewayResult.token !== "string" ||
      typeof gatewayResult.redirect_url !== "string" ||
      !gatewayResult.redirect_url.startsWith("https://app.sandbox.midtrans.com/")
    ) {
      await service.rpc("midtrans_fail_checkout", {
        p_order_id: order.order_id,
        p_reason: `gateway_http_${gatewayResponse.status}`,
      });
      console.error("Midtrans Snap token creation failed", gatewayResponse.status);
      return jsonResponse({ error: "Pembayaran belum dapat dibuka. Silakan coba kembali." }, 502);
    }

    const { error: attachError } = await service.rpc("attach_midtrans_snap", {
      p_payment_id: order.id,
      p_snap_token: gatewayResult.token,
      p_redirect_url: gatewayResult.redirect_url,
    });
    if (attachError) {
      console.error("Midtrans Snap token could not be attached", attachError.code ?? "database_error");
      return jsonResponse({ error: "Transaksi dibuat, tetapi checkout belum siap. Periksa status sebelum mencoba lagi." }, 503);
    }

    await service.from("participant_notifications").upsert(
      {
        user_id: user.id,
        kind: "payment.created",
        title: "Transaksi pembayaran dibuat",
        body: `Pesanan ${order.order_id} menunggu pembayaran.`,
        link: `/pembayaran/status/${order.order_id}`,
        dedupe_key: `payment-created:${order.id}`,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );

    return jsonResponse({
      payment_id: order.id,
      order_id: order.order_id,
      amount: order.amount,
      gross_amount: order.gross_amount,
      service_fee: order.service_fee,
      expires_at: order.expires_at,
      snap_token: gatewayResult.token,
      snap_redirect_url: gatewayResult.redirect_url,
      client_key: clientKey,
    });
  } catch (error) {
    console.error("Midtrans checkout request failed", errorMessage(error));
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});

import { corsHeaders } from "../_shared/midtrans.ts";
