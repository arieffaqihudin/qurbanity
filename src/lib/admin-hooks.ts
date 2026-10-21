import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { programsQuery } from "@/lib/admin";

export type CatalogCategory = { id: string; program_id: string; code: string; name: string; kind: "sapi" | "kambing"; max_shares: number; weight_range: string | null; description: string | null; is_available: boolean; sort_order: number };
type Price = { id: string; category_id: string; animal_cost: number; operational_cost: number; is_final: boolean; effective_from: string; created_at: string };

export function useCatalog(program: string) {
  return useQuery({
    queryKey: ["admin", "catalog", program], enabled: !!program,
    queryFn: async () => {
      const c = await supabase.from("animal_categories").select("*").eq("program_id", program).order("sort_order");
      if (c.error) throw new Error(c.error.message);
      const p = await supabase.from("animal_prices").select("*").in("category_id", (c.data ?? []).map((x) => x.id)).order("effective_from", { ascending: false }).order("created_at", { ascending: false });
      if (p.error) throw new Error(p.error.message);
      const now = Date.now();
      return (c.data as CatalogCategory[]).map((cat) => {
        const prices = (p.data as Price[]).filter((x) => x.category_id === cat.id);
        const final = prices.find((x) => x.is_final && new Date(x.effective_from).getTime() <= now) ?? null;
        const latest = prices[0] ?? null;
        return { ...cat, prices, final, latest };
      });
    },
  });
}

export function useDefaultProgram() {
  const programs = useQuery(programsQuery);
  const [program, setProgram] = useState("");
  const value = program || programs.data?.find((p) => p.status === "open")?.id || programs.data?.[0]?.id || "";
  return [value, setProgram] as const;
}

