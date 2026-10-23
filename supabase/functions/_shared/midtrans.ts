import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type GatewayConfig = {
  serverKey: string;
  clientKey: string;
};

export type GatewayStatus = {
  order_id: string;
  transaction_id?: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  payment_type?: string;
  fraud_status?: string;
  transaction_time?: string;
  settlement_time?: string;
  currency?: string;
};

export class GatewayHttpError extends Error {
  constructor(public status: number) {
    super(`Midtrans status request returned ${status}`);
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function getGatewayConfig(): GatewayConfig {
  const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
  const clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY");
  const production = Deno.env.get("MIDTRANS_IS_PRODUCTION");
  if (!serverKey || !clientKey || production !== "false") {
    throw new Error("Konfigurasi Midtrans Sandbox belum lengkap");
  }
  return { serverKey, clientKey };
}

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Konfigurasi server Supabase belum lengkap");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function createUserClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) {
    throw new Error("Sesi tidak valid");
  }
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sesi tidak valid");
  return { client, user: data.user };
}

export async function requireFinancePermission(
  client: ReturnType<typeof createClient>,
  permission = "finance.manage",
) {
  const { data, error } = await client.rpc("my_admin_access");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Akses admin tidak ditemukan");
  }
  const permissions = (data as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions) || !(permissions.includes("*") || permissions.includes(permission))) {
    throw new Error("Anda tidak memiliki izin untuk tindakan ini");
  }
}

export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function reportException(
  service: ReturnType<typeof createClient>,
  orderId: string | null,
  kind: string,
  detail: string,
) {
  const { error } = await service.rpc("midtrans_report_exception", {
    p_order_id: orderId,
    p_kind: kind,
    p_detail: detail,
  });
  if (error) console.error("Could not record payment exception", error.code ?? "database_error");
}

export function toRupiahInteger(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value !== "string" || !/^\d+(?:\.00)?$/.test(value)) {
    throw new Error("Nominal gateway tidak valid");
  }
  const amount = Number(value.replace(/\.00$/, ""));
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Nominal gateway tidak valid");
  return amount;
}

export async function getGatewayStatus(orderId: string, serverKey: string): Promise<GatewayStatus> {
  const response = await fetch(
    `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`,
    {
      headers: { Authorization: `Basic ${btoa(`${serverKey}:`)}`, Accept: "application/json" },
    },
  );
  if (!response.ok) {
    throw new GatewayHttpError(response.status);
  }
  const result = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    result.order_id !== orderId ||
    typeof result.transaction_status !== "string" ||
    typeof result.status_code !== "string" ||
    typeof result.gross_amount !== "string"
  ) {
    throw new Error("Respons status Midtrans tidak valid");
  }
  return result as GatewayStatus;
}

export async function createEventKey(status: GatewayStatus): Promise<string> {
  const source = [
    status.order_id,
    status.transaction_id ?? "",
    status.transaction_status,
    status.status_code,
    status.gross_amount,
  ].join(":");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function applyGatewayStatus(
  service: ReturnType<typeof createClient>,
  status: GatewayStatus,
  source: "webhook" | "status_check" | "reconciliation",
) {
  const verifiedAt =
    status.transaction_status === "settlement" || status.transaction_status === "capture"
      ? status.settlement_time ?? status.transaction_time ?? new Date().toISOString()
      : null;
  const { data, error } = await service.rpc("midtrans_apply_payment_status", {
    p_order_id: status.order_id,
    p_transaction_id: status.transaction_id ?? null,
    p_transaction_status: status.transaction_status,
    p_status_code: status.status_code,
    p_gross_amount: toRupiahInteger(status.gross_amount),
    p_payment_method: status.payment_type ?? null,
    p_verified_at: verifiedAt,
    p_metadata: {
      event_source: source,
      event_key: await createEventKey(status),
      fraud_status: status.fraud_status ?? null,
      transaction_time: status.transaction_time ?? null,
      settlement_time: status.settlement_time ?? null,
      currency: status.currency ?? null,
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kendala saat memproses pembayaran";
}
