# Roadmap — Phase 3.3

- [x] Notifikasi admin: lonceng kanan atas, tandai dibaca, izin per peran
- [x] Modul Hak Akses (CRUD grup + matriks izin)
- [x] Modul Pengguna admin (daftar, undang, edit, nonaktifkan, detail)
- [x] Modul Log Aktivitas (filter, detail, ekspor) + redirect rute lama
- [x] Izin grup jadi sumber tunggal (migrasi 0006)
- [x] Alur aktivasi pengguna admin: Simpan nonaktif → toggle kirim email → /aktivasi-akun → login sesuai grup → nonaktifkan mencabut akses
- [x] Uji end-to-end dengan tautan email asli (tipe invite & recovery) + jalur gagal email (example.com) + kirim ulang
- [x] Uji peran non-SUPERADMIN (Auditor: sidebar & /admin/pengguna ditolak)
- [ ] Uji penghapusan grup via UI & penandaan dibaca saat ada notifikasi
- [ ] Verifikasi penerimaan email aktivasi sungguhan di kotak masuk penerima
