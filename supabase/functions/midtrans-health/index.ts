import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  createServiceClient,
  createUserClient,
  errorMessage,
  jsonResponse,
  requireFinancePermission,
} from "../_shared/midtrans.ts";

// Checks that the Sandbox credentials are configured and accepted by Midtrans without exposing them.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Metode tidak didukung" }, 405);

  try {
    const { client, user } = await createUserClient(req);
    await requireFinancePermission(client, "finance.view");
    const service = createServiceClient();

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY");
    const production = Deno.env.get("MIDTRANS_IS_PRODUCTION");
    const keysConfigured = Boolean(serverKey && clientKey) && production === "false";

    let ok = false;
    let httpStatus: number | null = null;
    let detail = "Kunci Midtrans Sandbox belum dikonfigurasi";
    if (production !== undefined && production !== "false") {
      detail = "Mode produksi ditolak. Hanya Sandbox yang diizinkan";
    } else if (keysConfigured) {
      try {
        // An unknown order returns 404 when the key is valid and 401 when it is not.
        const response = await fetch("https://api.sandbox.midtrans.com/v2/QRB-CONNECTIVITY-CHECK/status", {
          headers: { Authorization: `Basic ${btoa(`${serverKey}:`)}`, Accept: "application/json" },
        });
        httpStatus = response.status;
        ok = response.status === 404 || response.status === 200;
        detail = ok ? "Terhubung ke Midtrans Sandbox" : "Midtrans menolak kunci Sandbox";
      } catch {
        detail = "Midtrans Sandbox tidak dapat dijangkau";
      }
    }

    await service.rpc("record_gateway_check", {
      p_actor: user.id,
      p_ok: ok,
      p_keys_configured: keysConfigured,
      p_http_status: httpStatus,
      p_detail: detail,
    });
    return jsonResponse({ ok, keys_configured: keysConfigured, detail, environment: "sandbox" });
  } catch (error) {
    console.error("Gateway health check failed", errorMessage(error));
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
