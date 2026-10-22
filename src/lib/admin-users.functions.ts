import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function origin() {
  return getRequestHeader("origin") ?? getRequestHeader("host")?.replace(/^(.*)$/, "https://$1") ?? "";
}

async function assertUsersManage(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: allowed } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _perm: "users.manage" });
  if (!allowed) throw new Error("Akses ditolak: kamu tidak memiliki izin untuk tindakan ini");
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Mengirim email pengaturan akun. Mengembalikan true bila terkirim, false bila gagal. */
async function sendSetupEmail(admin: AdminClient, userId: string, email: string, fullName: string): Promise<boolean> {
  const redirectTo = `${origin()}/aktivasi-akun`;
  const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !authUser.user) return false;
  const confirmed = Boolean(authUser.user.email_confirmed_at);
  if (!confirmed) {
    // Akun belum terkonfirmasi: tautan undangan sekaligus memverifikasi kepemilikan email.
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, invite_kind: "admin" },
      redirectTo,
    });
    if (!error) return true;
    console.error("[sendSetupEmail] inviteUserByEmail gagal:", error.message);
    // Cadangan: beberapa server menolak undangan ulang — pakai tautan pemulihan.
    const { error: recErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (recErr) console.error("[sendSetupEmail] resetPasswordForEmail gagal:", recErr.message);
    return !recErr;
  }
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) console.error("[sendSetupEmail] resetPasswordForEmail gagal:", error.message);
  return !error;
}

/**
 * Menyimpan pengguna admin baru. Identitas Auth dibuat (atau ditautkan bila email
 * sudah punya akun) TANPA mengirim email dan TANPA kata sandi; akun tersimpan
 * nonaktif dengan status "Belum Diundang". Aktivasi dilakukan terpisah lewat
 * toggle di daftar pengguna.
 */
export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; email: string; groupId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    await assertUsersManage(context);

    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    if (name.length < 3) throw new Error("Nama lengkap minimal 3 karakter");
    if (!EMAIL_RE.test(email)) throw new Error("Email tidak valid");
    if (!data.groupId) throw new Error("Pilih grup pengguna");
    if ((data.reason ?? "").trim().length < 5) throw new Error("Alasan minimal 5 karakter");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cek identitas: email sudah terdaftar sebagai admin?
    const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (existingProfile?.id) {
      const { data: existingMember } = await supabaseAdmin.from("admin_members").select("user_id").eq("user_id", existingProfile.id).maybeSingle();
      if (existingMember) throw new Error("Email ini sudah terdaftar sebagai pengguna admin");
    }

    let userId = existingProfile?.id as string | undefined;
    let linked = false;

    if (userId) {
      // Tautkan identitas yang sudah ada (mis. akun peserta) — tidak membuat duplikat.
      linked = true;
    } else {
      // Buat identitas Auth baru tanpa email dan tanpa kata sandi.
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: name, invite_kind: "admin" },
      });
      if (error) {
        console.error("[createAdminUser] auth.admin.createUser gagal:", error.message);
        if (/already|registered|exists/i.test(error.message)) throw new Error("Email ini sudah memiliki akun. Gunakan pencarian untuk menemukannya.");
        throw new Error("Gagal membuat akun. Coba beberapa saat lagi.");
      }
      if (!created.user?.id) throw new Error("Pembuatan akun tidak menghasilkan identitas. Coba lagi.");
      userId = created.user.id;
    }

    const { error: rpcErr } = await context.supabase.rpc("admin_create_user", {
      p_user_id: userId, p_group_id: data.groupId, p_reason: data.reason.trim(),
    });
    if (rpcErr) {
      // Identitas Auth yang baru dibuat tidak boleh menggantung tanpa catatan admin.
      if (!linked) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new Error(rpcErr.message);
    }

    return { userId, linked };
  });

/**
 * Aktivasi (toggle OFF → ON): mengaktifkan catatan admin dan mengirim email
 * berisi tautan pengaturan akun yang aman. Idempoten — bila setup sudah pernah
 * selesai, akses dipulihkan tanpa mengirim email ulang.
 */
export const activateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    await assertUsersManage(context);
    if ((data.reason ?? "").trim().length < 5) throw new Error("Alasan minimal 5 karakter");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("admin_members")
      .select("user_id, is_active, setup_status, setup_completed_at, invited_at, group_id, access_groups(is_active), profiles(email, full_name)")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!member) throw new Error("Pengguna admin tidak ditemukan");
    const group = member.access_groups as unknown as { is_active: boolean } | null;
    if (!group || !group.is_active) throw new Error("Tetapkan grup hak akses yang aktif sebelum mengaktifkan pengguna");
    const profile = member.profiles as unknown as { email: string; full_name: string } | null;
    if (!profile?.email) throw new Error("Email pengguna tidak ditemukan");

    // Reaktivasi setelah setup selesai: pulihkan akses tanpa email ulang (idempoten).
    if (member.setup_completed_at) {
      const { error } = await context.supabase.rpc("admin_update_user", {
        p_user_id: data.userId, p_full_name: "", p_group_id: member.group_id ?? "", p_active: true, p_reason: data.reason.trim(),
      });
      if (error) throw new Error(error.message);
      await context.supabase.rpc("admin_record_activation_event", {
        p_user_id: data.userId, p_action: "USER_ACTIVATED", p_reason: data.reason.trim(),
        p_meta: { note: "Reaktivasi tanpa email — setup akun sudah selesai sebelumnya" },
      });
      return { emailed: false };
    }

    // Aktifkan catatan admin (akses tetap tertahan sampai setup akun selesai).
    const { error: updErr } = await context.supabase.rpc("admin_update_user", {
      p_user_id: data.userId, p_full_name: "", p_group_id: member.group_id ?? "", p_active: true, p_reason: data.reason.trim(),
    });
    if (updErr) throw new Error(updErr.message);
    await context.supabase.rpc("admin_record_activation_event", {
      p_user_id: data.userId, p_action: "USER_ACTIVATION_REQUESTED", p_reason: data.reason.trim(),
    });

    const sent = await sendSetupEmail(supabaseAdmin, data.userId, profile.email, profile.full_name);
    if (!sent) {
      await context.supabase.rpc("admin_record_activation_event", {
        p_user_id: data.userId, p_action: "USER_INVITATION_FAILED", p_reason: data.reason.trim(),
      });
      // Jangan tampilkan status ON yang menyesatkan: kembalikan ke nonaktif.
      await context.supabase.rpc("admin_update_user", {
        p_user_id: data.userId, p_full_name: "", p_group_id: member.group_id ?? "", p_active: false,
        p_reason: "Pengembalian otomatis: email aktivasi gagal terkirim",
      });
      throw new Error("Gagal Mengirim Email. Akun tetap nonaktif — coba aktifkan kembali beberapa saat lagi.");
    }

    await context.supabase.rpc("admin_record_activation_event", {
      p_user_id: data.userId,
      p_action: member.invited_at ? "USER_ACTIVATION_EMAIL_RESENT" : "USER_INVITATION_SENT",
      p_reason: data.reason.trim(),
    });
    return { emailed: true };
  });

/** Mengirim ulang email aktivasi untuk akun yang aktif dan masih menunggu setup. */
export const resendAdminActivationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    await assertUsersManage(context);
    if ((data.reason ?? "").trim().length < 5) throw new Error("Alasan minimal 5 karakter");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("admin_members")
      .select("user_id, is_active, setup_status, profiles(email, full_name)")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!member) throw new Error("Pengguna admin tidak ditemukan");
    if (!member.is_active || member.setup_status !== "menunggu_aktivasi") {
      throw new Error("Email hanya dapat dikirim ulang untuk akun yang sedang menunggu aktivasi");
    }
    const profile = member.profiles as unknown as { email: string; full_name: string } | null;
    if (!profile?.email) throw new Error("Email pengguna tidak ditemukan");

    const sent = await sendSetupEmail(supabaseAdmin, data.userId, profile.email, profile.full_name);
    await context.supabase.rpc("admin_record_activation_event", {
      p_user_id: data.userId,
      p_action: sent ? "USER_ACTIVATION_EMAIL_RESENT" : "USER_INVITATION_FAILED",
      p_reason: data.reason.trim(),
    });
    if (!sent) throw new Error("Gagal Mengirim Email. Coba kirim ulang beberapa saat lagi.");
    return { sent: true };
  });

/**
 * Deaktivasi (toggle ON → OFF): mencabut akses admin seketika dan mengakhiri
 * sesi aktif pengguna. Catatan dan riwayat audit tetap tersimpan; akun Auth
 * dan akses peserta (bila ada) tidak dihapus.
 */
export const deactivateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    await assertUsersManage(context);
    if ((data.reason ?? "").trim().length < 5) throw new Error("Alasan minimal 5 karakter");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("admin_members")
      .select("user_id, is_active, group_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!member) throw new Error("Pengguna admin tidak ditemukan");

    // Validasi di database: perlindungan akun sendiri & Superadmin aktif terakhir.
    const { error } = await context.supabase.rpc("admin_update_user", {
      p_user_id: data.userId, p_full_name: "", p_group_id: member.group_id ?? "", p_active: false, p_reason: data.reason.trim(),
    });
    if (error) throw new Error(error.message);

    // Cabut sesi aktif agar token lama tidak bisa dipakai lagi untuk operasi admin.
    let sessionsRevoked = true;
    try {
      const { error: signOutErr } = await supabaseAdmin.auth.admin.signOut(data.userId, "global");
      if (signOutErr) sessionsRevoked = false;
    } catch {
      sessionsRevoked = false;
    }

    await context.supabase.rpc("admin_record_activation_event", {
      p_user_id: data.userId, p_action: "USER_DEACTIVATED", p_reason: data.reason.trim(),
      p_meta: { sessions_revoked: sessionsRevoked },
    });
    return { deactivated: true, sessionsRevoked };
  });
