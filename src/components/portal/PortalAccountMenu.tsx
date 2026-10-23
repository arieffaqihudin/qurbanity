import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || ""
  );
}

export function PortalAccountMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identity = useQuery({
    queryKey: ["portal", "identity"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!auth.user) throw new Error("Sesi tidak ditemukan");
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { name: data?.full_name ?? "", email: auth.user.email ?? "" };
    },
  });

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Gagal keluar. Coba lagi.");
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await navigate({ to: "/masuk", replace: true });
  };

  const name = identity.data?.name ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menu akun"
          className="size-10 rounded-full p-0 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-9 border border-burgundy/20 bg-burgundy/5 text-burgundy">
            <AvatarFallback className="bg-transparent text-xs font-bold">
              {initials(name) || <UserRound className="size-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(18rem,calc(100vw-1rem))] border-border shadow-lg"
      >
        <DropdownMenuLabel className="max-w-full px-3 py-2 font-normal">
          <span className="block truncate text-sm font-bold text-burgundy-dark">
            {identity.isPending ? "Memuat akun…" : name || "Nama belum diisi"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {identity.data?.email ?? ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/portal/akun" className="min-h-10 cursor-pointer">
            <UserRound className="size-4" /> Profil Saya
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="min-h-10 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
