import { createServerFn, getRequestHeader } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function origin() {
  return getRequestHeader("origin") ?? getRequestHeader("host")?.replace(/^(.*)$/, "https://$1") ?? "";
}

/**
 * Mengundang pengguna admin baru. Akun dibuat lewat Auth admin (email undangan,
 * tanpa kata sandi awal), lalu grup ditetapkan lewat RPC admin_update_user
 * sehingga validasi & audit tetap di database atas nama pengundang.
 */
export const inviteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; email: string; groupId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _perm: "users.manage" });
    if (!allowed) throw new Error("Akses ditolak: kamu tidak memiliki izin untuk tindakan ini");

    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    if (name.length < 3) throw new Error("Nama lengkap minimal 3 karakter");
    if (!EMAIL_RE.test(email)) throw new Error("Email tidak valid");
    if (!data.groupId) throw new Error("Pilih grup pengguna");
    if ((data.reason ?? "").trim().length < 5) throw new Error("Alasan minimal 5 karakter");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Jika email sudah punya akun (mis. peserta), tautkan identitas yang ada — jangan buat duplikat.
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
    let userId = existing?.id as string | undefined;
    let invited = false;

    if (!userId) {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, invite_kind: "admin" },
        redirectTo: `${origin()}/auth`,
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) throw new Error("Email ini sudah memiliki akun. Gunakan aksi Edit pada daftar pengguna.");
        throw new Error("Gagal mengirim undangan email. Coba beberapa saat lagi.");
      }
      if (!inv.user?.id) throw new Error("Undangan tidak menghasilkan akun. Coba lagi.");
      userId = inv.user.id;
      invited = true;
    }

    const { error: assignErr } = await context.supabase.rpc("admin_update_user", {
      p_user_id: userId, p_full_name: name, p_group_id: data.groupId, p_active: true, p_reason: data.reason.trim(),
    });
    if (assignErr) throw new Error(assignErr.message);

    return { userId, invited, linked: !invited };
  });

/** Mengirim ulang email pengaturan akun (tautan atur kata sandi) untuk admin yang sudah ada. */
export const resendAdminSetupEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _perm: "users.manage" });
    if (!allowed) throw new Error("Akses ditolak: kamu tidak memiliki izin untuk tindakan ini");
    const email = data.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error("Email tidak valid");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth` });
    if (error) throw new Error("Gagal mengirim email pengaturan akun. Coba beberapa saat lagi.");
    return { sent: true };
  });
