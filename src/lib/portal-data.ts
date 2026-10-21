import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Commitment = Database["public"]["Tables"]["qurban_commitments"]["Row"];
export type ExecutionStatus = Database["public"]["Enums"]["execution_status"];
export type Frequency = Database["public"]["Enums"]["payment_frequency"];
export type PublicationPref = Database["public"]["Enums"]["publication_preference"];

function unwrap<D>(r: { data: D; error: { message: string } | null }): D {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
function rows<D>(r: { data: D[] | null; error: { message: string } | null }): D[] {
  return unwrap(r) ?? [];
}

export const programQuery = queryOptions({
  queryKey: ["program", "active"],
  queryFn: async () =>
    unwrap(await supabase.from("programs").select("*").in("status", ["open", "closed"]).order("created_at", { ascending: false }).limit(1).maybeSingle()),
});

export const categoriesQuery = (programId: string) =>
  queryOptions({
    queryKey: ["categories", programId],
    queryFn: async () => {
      const cats = rows(await supabase.from("animal_categories").select("*").eq("program_id", programId).order("sort_order"));
      const prices = rows(
        await supabase.from("animal_prices").select("*").in("category_id", cats.map((c) => c.id)).eq("is_final", true).lte("effective_from", new Date().toISOString()).order("effective_from", { ascending: false }),
      );
      return cats.map((c) => ({ ...c, price: prices.find((p) => p.category_id === c.id) ?? null }));
    },
  });

export const contractsQuery = (programId: string) =>
  queryOptions({
    queryKey: ["contracts", programId],
    queryFn: async () => rows(await supabase.from("contract_versions").select("*").eq("program_id", programId).eq("is_active", true).order("contract_code")),
  });

export const commitmentsQuery = queryOptions({
  queryKey: ["commitments"],
  queryFn: async () => rows(await supabase.from("qurban_commitments").select("*, qurban_shares(position, shahibul_name), payment_plans(*)").order("created_at", { ascending: false })),
});

export const commitmentQuery = (id: string) =>
  queryOptions({
    queryKey: ["commitment", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("qurban_commitments")
          .select("*, qurban_shares(position, shahibul_name), payment_plans(*), contract_consents(*), participant_publication_consents(preference, created_at), programs(name, iduladha_date, payment_deadline)")
          .eq("id", id)
          .maybeSingle(),
      ),
  });

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Tidak masuk");
    return unwrap(await supabase.from("profiles").select("*").eq("id", u.user.id).single());
  },
});

export const notifQuery = queryOptions({
  queryKey: ["notif"],
  queryFn: async () => unwrap(await supabase.from("notification_preferences").select("*").maybeSingle()),
});

export const consentsQuery = queryOptions({
  queryKey: ["consents"],
  queryFn: async () => rows(await supabase.from("contract_consents").select("*, qurban_commitments(code), contract_versions(title)").order("consented_at", { ascending: false })),
});

export const latestPublicationQuery = queryOptions({
  queryKey: ["publication"],
  queryFn: async () => unwrap(await supabase.from("participant_publication_consents").select("*").is("commitment_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle()),
});

// ---- presentation helpers ----
export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  belum_lunas: { label: "Belum Lunas", cls: "bg-muted text-muted-foreground" },
  dalam_cicilan: { label: "Dalam Cicilan", cls: "bg-beige/70 text-burgundy-dark" },
  lunas: { label: "Lunas", cls: "bg-success/15 text-success" },
};
export const EXECUTION_STEPS: { key: ExecutionStatus; label: string }[] = [
  { key: "menunggu", label: "Menunggu pelaksanaan" },
  { key: "dialokasikan", label: "Dialokasikan ke hewan" },
  { key: "disembelih", label: "Disembelih" },
  { key: "didistribusikan", label: "Didistribusikan" },
  { key: "selesai", label: "Laporan selesai" },
];
export const EXECUTION_LABEL: Record<ExecutionStatus, string> = {
  menunggu: "Menunggu pelaksanaan", dialokasikan: "Dialokasikan", disembelih: "Disembelih", didistribusikan: "Didistribusikan", selesai: "Selesai", dibatalkan: "Dibatalkan",
};
export const FREQ_LABEL: Record<Frequency, string> = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan", fleksibel: "Fleksibel" };
export const FREQ_UNIT: Record<Frequency, string> = { harian: "hari", mingguan: "minggu", bulanan: "bulan", fleksibel: "bulan" };

export function progressPct(c: Pick<Commitment, "verified_paid_amount" | "total_amount">) {
  return c.total_amount > 0 ? Math.min(100, Math.floor((c.verified_paid_amount / c.total_amount) * 100)) : 0;
}
