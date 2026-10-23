# Midtrans Sandbox — Integrasi Pembayaran

Hanya **Sandbox**. URL Midtrans di-hardcode ke `app.sandbox.midtrans.com`, `MIDTRANS_IS_PRODUCTION` harus `false`
(fungsi menolak nilai lain), dan kolom `payment_transactions.environment` dibatasi `sandbox`.

## Arsitektur
- Frontend (`/bayar/$id`, `/pembayaran/status/$orderId`, `/pembayaran/kuitansi/$orderId`) hanya memanggil Edge Function; tidak pernah memegang Server Key.
- Edge Functions (`supabase/functions`):
  - `midtrans-create` — validasi di RPC `create_midtrans_payment_order`, minta Snap token, simpan PENDING.
  - `midtrans-notification` — webhook publik (`verify_jwt=false`): verifikasi SHA-512 signature, ambil status otoritatif dari Midtrans Status API, cek nominal, terapkan lewat `midtrans_apply_payment_status` (idempoten via `payment_status_events.event_key`).
  - `midtrans-status` — peserta/admin meminta backend memeriksa Midtrans (callback browser tidak pernah dipercaya).
  - `midtrans-reconcile` — rekonsiliasi manual (JWT `finance.manage`) atau terjadwal (header `x-cron-secret`).
  - `midtrans-health` — cek koneksi & konfigurasi kunci.
- Ledger: pembayaran terverifikasi memposting `EXTERNAL → COMMITMENT` (`system_source='midtrans_sandbox'`, `is_fixture=true`, kunci idempotensi `midtrans:<payment_id>`), sehingga tidak masuk laporan dana nyata maupun total dana terverifikasi pada laporan peserta. Saldo sandbox ditampilkan terpisah di halaman rekonsiliasi.
- Migrasi (aditif, terapkan berurutan): `0011` → `0012` → `0013`.

## Variabel lingkungan (Supabase Edge Function secrets — bukan `.env`)
`MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=false`, `APP_BASE_URL`, `CRON_SECRET`.

## Langkah deploy
1. Terapkan migrasi 0011–0013 ke database Supabase.
2. `supabase secrets set ...` untuk variabel di atas.
3. `supabase functions deploy midtrans-create midtrans-notification midtrans-status midtrans-reconcile midtrans-health`.
4. Dasbor Midtrans (Sandbox) → Settings → Configuration:
   - Payment Notification URL: `https://<project>.supabase.co/functions/v1/midtrans-notification`
   - Redirect URL dikirim per transaksi oleh `midtrans-create` (`<APP_BASE_URL>/pembayaran/status/<order_id>`); isi juga default-nya dengan `<APP_BASE_URL>/portal/aktivitas`.
   - Aktifkan metode pembayaran yang diinginkan.
5. Jadwalkan rekonsiliasi (pg_cron + pg_net, mis. tiap jam) memanggil `midtrans-reconcile` dengan header `x-cron-secret: <CRON_SECRET>`.
6. Buka Admin → Pengaturan Pembayaran → "Periksa koneksi".

## Batasan yang diketahui
- Posting alokasi (`lock_allocation`: COMMITMENT→ANIMAL/OPERATIONAL) belum ditandai fixture, sehingga mengalokasikan komitmen yang didanai sandbox akan bercampur ke ledger nyata. Jangan alokasikan komitmen uji coba sebelum ini ditangani.
- Pengiriman email belum terintegrasi; notifikasi hanya tersimpan di aplikasi.
- Batas waktu pembayaran tetap 24 jam (dibatasi batas akhir program).
