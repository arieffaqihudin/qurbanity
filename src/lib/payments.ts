import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PaymentRow = Database["public"]["Tables"]["payment_transactions"]["Row"];
export type PaymentStatus =
  "pending" | "success" | "failed" | "expired" | "cancelled" | "refund_required" | "refunded";

export const SNAP_SCRIPT_URL = "https://app.sandbox.midtrans.com/snap/snap.js";
export const SANDBOX_NOTICE = "Mode Uji Coba — Tidak menggunakan uang sungguhan.";
export const SANDBOX_RECEIPT_MARK = "TRANSAKSI UJI COBA — BUKAN BUKTI PEMBAYARAN NYATA";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Menunggu Pembayaran",
  success: "Berhasil",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  refund_required: "Perlu Ditinjau",
  refunded: "Dikembalikan",
};

export const PAYMENT_STATUS_TONE: Record<
  PaymentStatus,
  "success" | "warning" | "danger" | "muted"
> = {
  pending: "warning",
  success: "success",
  failed: "danger",
  expired: "muted",
  cancelled: "muted",
  refund_required: "warning",
  refunded: "muted",
};

export const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Transfer Bank / Virtual Account",
  echannel: "Mandiri Bill Payment",
  qris: "QRIS",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  credit_card: "Kartu Kredit/Debit",
  cstore: "Gerai Retail",
  akulaku: "Akulaku",
  other_qris: "QRIS",
};

export const METHOD_FILTER: [string, string][] = [
  ["bank_transfer", "Transfer Bank / VA"],
  ["echannel", "Mandiri Bill"],
  ["qris", "QRIS"],
  ["gopay", "GoPay"],
  ["shopeepay", "ShopeePay"],
  ["credit_card", "Kartu"],
  ["cstore", "Gerai Retail"],
];

export const methodLabel = (m: string | null | undefined) =>
  m ? (METHOD_LABEL[m] ?? m.replace(/_/g, " ")) : "Belum dipilih";

/** A pending order past its deadline can no longer be paid, so it is presented as expired. */
export function displayStatus(p: Pick<PaymentRow, "status" | "expires_at">): PaymentStatus {
  const s = p.status as PaymentStatus;
  if (s === "pending" && new Date(p.expires_at).getTime() <= Date.now()) return "expired";
  return s;
}

export interface PaymentConfig {
  minimum_payment: number;
  maximum_payment: number;
  service_fee: number;
  presets: string;
  methods: string;
  environment: "sandbox";
}

export const parsePresets = (raw: string) =>
  raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isSafeInteger(n) && n > 0);

export const paymentConfigQuery = queryOptions({
  queryKey: ["payment-config"],
  queryFn: async () => {
    const r = await supabase.rpc("get_payment_config_public" as never);
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as PaymentConfig;
  },
});

export const commitmentPaymentsQuery = (commitmentId: string) =>
  queryOptions({
    queryKey: ["payments", "commitment", commitmentId],
    queryFn: async () => {
      const r = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("commitment_id", commitmentId)
        .order("created_at", { ascending: false });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });

export const myPaymentsQuery = queryOptions({
  queryKey: ["payments", "mine"],
  queryFn: async () => {
    const r = await supabase
      .from("payment_transactions")
      .select("*, qurban_commitments(code, category_name_snapshot)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
});

export const paymentByOrderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["payments", "order", orderId],
    queryFn: async () => {
      const r = await supabase
        .from("payment_transactions")
        .select(
          "*, qurban_commitments(id, code, category_name_snapshot, animal_kind_snapshot, total_amount, verified_paid_amount)",
        )
        .eq("order_id", orderId)
        .maybeSingle();
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });

export const paymentEventsQuery = (paymentId: string) =>
  queryOptions({
    queryKey: ["payments", "events", paymentId],
    queryFn: async () => {
      const r = await supabase
        .from("payment_status_events")
        .select("id, new_status, gateway_status, source, created_at")
        .eq("payment_id", paymentId)
        .order("created_at", { ascending: false });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });

export const myNotificationsQuery = queryOptions({
  queryKey: ["participant-notifications"],
  queryFn: async () => {
    const r = await supabase
      .from("participant_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
});

export interface PaymentReceipt {
  order_id: string;
  receipt_number: string;
  verification_code: string;
  amount: number;
  payment_method: string | null;
  paid_at: string;
  environment: "sandbox";
  issuer: { name?: string; legal_entity?: string; address?: string };
  participant_name: string;
  commitment_code: string;
  category: string;
  commitment_total: number;
  verified_total: number;
}

export const receiptQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["payments", "receipt", orderId],
    queryFn: async () => {
      const r = await supabase.rpc(
        "get_payment_receipt" as never,
        { p_order_id: orderId } as never,
      );
      if (r.error) throw new Error(r.error.message);
      return r.data as unknown as PaymentReceipt;
    },
  });

/** Pending reserved amount on a commitment (unexpired pending orders). */
export const reservedAmount = (rows: Pick<PaymentRow, "status" | "expires_at" | "amount">[]) =>
  rows.filter((p) => displayStatus(p) === "pending").reduce((sum, p) => sum + p.amount, 0);

export interface CheckoutResult {
  payment_id: string;
  order_id: string;
  amount: number;
  gross_amount: number;
  service_fee: number;
  expires_at: string;
  snap_token: string;
  snap_redirect_url: string;
  client_key: string;
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = "Layanan pembayaran belum dapat dihubungi. Silakan coba lagi.";
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const parsed = await ctx.json().catch(() => null);
      if (parsed && typeof parsed.error === "string") message = parsed.error;
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }
  return data as T;
}

export const createCheckout = (input: {
  commitmentId: string;
  amount: number;
  idempotencyKey: string;
}) =>
  invoke<CheckoutResult>("midtrans-create", {
    commitment_id: input.commitmentId,
    amount: input.amount,
    idempotency_key: input.idempotencyKey,
  });

/** Asks the backend to verify the order against Midtrans; the browser never decides the result. */
export const verifyPaymentStatus = (orderId: string) =>
  invoke<{ status: { status?: string }; gateway_status: string; client_key?: string }>(
    "midtrans-status",
    {
      order_id: orderId,
    },
  );

export const adminVerifyPayment = (paymentId: string) =>
  invoke<{ status: { status?: string }; gateway_status: string }>("midtrans-status", {
    payment_id: paymentId,
    admin_check: true,
  });

interface SnapCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}
declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: SnapCallbacks) => void };
  }
}

let snapLoading: Promise<void> | null = null;
export function loadSnap(clientKey: string): Promise<void> {
  if (window.snap) return Promise.resolve();
  snapLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SNAP_SCRIPT_URL;
    script.async = true;
    script.setAttribute("data-client-key", clientKey);
    script.onload = () => resolve();
    script.onerror = () => {
      snapLoading = null;
      script.remove();
      reject(new Error("Jendela pembayaran Midtrans tidak dapat dimuat"));
    };
    document.head.appendChild(script);
  });
  return snapLoading;
}

export async function openSnap(token: string, clientKey: string, callbacks: SnapCallbacks) {
  await loadSnap(clientKey);
  if (!window.snap) throw new Error("Jendela pembayaran Midtrans tidak tersedia");
  window.snap.pay(token, callbacks);
}

export const runReconciliation = () =>
  invoke<{
    run_id: string;
    checked: number;
    updated: number;
    expired: number;
    mismatch: number;
    errors: number;
  }>("midtrans-reconcile", {});

export const checkGatewayHealth = () =>
  invoke<{ ok: boolean; keys_configured: boolean; detail: string; environment: string }>(
    "midtrans-health",
    {},
  );
