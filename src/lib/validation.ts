import { z } from "zod";

export const MIN_AGE = 17;

/** Normalise Indonesian phone numbers to +62XXXXXXXXX. Returns null when invalid. */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^8\d{7,12}$/.test(d)) return null;
  return `+62${d}`;
}

/** Age in full years on `today` (Asia/Jakarta calendar date strings). */
export function ageOn(birth: string, today: Date = new Date()): number {
  const [y, m, d] = birth.split("-").map(Number) as [number, number, number];
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(today).split("-").map(Number) as [number, number, number];
  let age = t[0] - y;
  if (t[1] < m || (t[1] === m && t[2] < d)) age--;
  return age;
}

export const passwordSchema = z
  .string()
  .min(10, "Kata sandi minimal 10 karakter")
  .regex(/[A-Za-z]/, "Kata sandi harus mengandung huruf")
  .regex(/\d/, "Kata sandi harus mengandung angka");

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(3, "Nama lengkap minimal 3 karakter").max(120, "Nama terlalu panjang"),
    email: z.string().trim().toLowerCase().email("Format email tidak valid").max(255),
    whatsapp: z.string().trim().refine((v) => normalizeWhatsapp(v) !== null, "Nomor WhatsApp tidak valid (contoh: 0812 3456 7890)"),
    birth_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi")
      .refine((v) => ageOn(v) >= MIN_AGE, `Usia minimal peserta adalah ${MIN_AGE} tahun`)
      .refine((v) => ageOn(v) <= 120, "Tanggal lahir tidak valid"),
    address: z.string().trim().min(10, "Alamat minimal 10 karakter").max(500, "Alamat terlalu panjang"),
    password: passwordSchema,
    confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: "Kamu harus menyetujui Syarat & Ketentuan dan Kebijakan Privasi" }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi kata sandi tidak sama" });

export const profileSchema = z.object({
  full_name: registerSchema.innerType().shape.full_name,
  whatsapp: registerSchema.innerType().shape.whatsapp,
  address: registerSchema.innerType().shape.address,
});

export const shahibulSchema = z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama terlalu panjang");

/** Server error messages → friendly Indonesian. */
export function authErrorMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum diverifikasi. Cek kotak masuk email kamu.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Email sudah terdaftar. Silakan masuk.";
  if (m.includes("usia minimal")) return "Usia minimal peserta adalah 17 tahun.";
  if (m.includes("email address is not allowed") || m.includes("invalid format")) return "Alamat email tidak dapat digunakan. Periksa kembali penulisannya.";
  if (m.includes("database error")) return "Pendaftaran gagal diproses. Periksa kembali data kamu.";
  if (m.includes("rate limit")) return "Terlalu banyak percobaan. Coba lagi beberapa saat.";
  if (m.includes("pwned") || m.includes("weak")) return "Kata sandi terlalu lemah atau pernah bocor. Gunakan kata sandi lain.";
  return msg;
}
