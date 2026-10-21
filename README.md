# Qurbanity

# QURBANITY — Phase 1: Product Foundation & Public Website

Build a modern, production-oriented web application called **QURBANITY by Manfaat Mengalir**, a digital platform for managing gradual Qurban commitments.

The application must follow the supplied QURBANITY PRD v1.0 as the primary functional and business reference.

## 1. Product Context

QURBANITY enables Muslim participants to commit to purchasing a Qurban animal, lock the agreed price during akad, pay gradually using flexible installment amounts, and follow the implementation and distribution process.

Supported Qurban categories:
- Sapi Reguler (1–7 shares)
- Sapi Super (1–7 shares)
- Sapi Super Duper (unavailable until a final price is set)
- Kambing (one animal, one shahibul)

The system supports multiple commitments per participant.

This is not a conventional banking or savings product.

## 2. Technology

Use:
- React, TypeScript, Tailwind CSS
- shadcn/ui components
- Supabase for PostgreSQL, authentication, storage, and Row Level Security
- Modular architecture and reusable components
- Indonesian localization
- Asia/Jakarta timezone
- Indonesian Rupiah currency formatting

Prepare separate application layouts for:
1. Public Website
2. Participant Portal
3. Admin Dashboard

Do not implement real financial transactions in Phase 1.

## 3. Design System

Brand identity:
- Primary Burgundy: #750314
- Dark Burgundy: #4D0612
- Soft Burgundy: #8A0A1E
- Ivory: #F8F5EE
- Cream: #F0E6D2
- Gold: #E3AE4D
- Charcoal: #2A2224

Typography: Plus Jakarta Sans.

Design principles:
- Modern, elegant, warm, trustworthy.
- Clear and accessible for non-technical participants.
- Avoid generic SaaS templates.
- Avoid excessive whitespace, tiny typography, or oversized decorative sections.
- Use strong visual hierarchy and comfortable typography.
- Prioritize mobile-first responsive layouts.
- Use subtle animations and meaningful micro-interactions.
- Respect reduced-motion accessibility preferences.
- Consistent branding across all pages.

## 4. Public Website Pages

Create:

### Beranda (/)
- Hero section with compelling emotional headline
- Primary CTA: "Mulai Kurban"
- Secondary CTA: "Simulasikan Kurban"
- Animal category preview
- Flexible installment explanation
- Interactive payment simulator
- How Qurbanity Works
- Trust and transparency section
- Preview of Qurban journey
- Countdown to Iduladha
- FAQ preview
- Final CTA

### Pilihan Hewan (/pilihan-sapi)
- Animal categories
- Estimated weights
- Animal and operational costs
- Total price per share or full animal
- Category comparison
- Clear indication for categories without final prices

### Simulasi (/simulasi)
- Choose animal category
- Choose number of shares
- Select daily, weekly, or monthly payment frequency
- Calculate estimated payments
- Show remaining time until the payment deadline
- Clear CTA to start a commitment

### Cara Kerja (/cara-kerja)
Explain the complete participant journey in clear, simple steps.

### Akad Program (/akad-program)
Introduce the contractual structure and financial transparency principles. Use clearly marked placeholders for any legal or religious contract text not yet approved.

### Tentang Kami (/tentang)
Introduce Manfaat Mengalir and the Qurbanity initiative.

### Dampak (/dampak)
Create a public impact reporting interface using clearly labeled sample data.

### Verifikasi Dokumen (/verifikasi)
Build a verification interface ready for future database integration.

### FAQ (/faq)
### Kontak (/kontak)
### Kebijakan Privasi (/kebijakan-privasi)
### Syarat & Ketentuan (/syarat-ketentuan)

Do not invent final legal policies or claim that draft policies have been approved.

## 5. Application Shells

Prepare:

Participant Portal:
- Dashboard
- Kurban Saya
- Bayar
- Aktivitas & Riwayat
- Dokumentasi
- Laporan
- Akun & Profil

Admin Dashboard:
- Ringkasan
- Peserta
- Pembayaran
- Verifikasi
- Pembatalan
- Pemulihan Akun
- Kategori Hewan
- Harga & Riwayat
- Alokasi
- Pengumuman H-7
- Perjalanan & Dokumentasi
- Keuangan
- Laporan
- Audit Log
- Pengaturan
- Manajemen Admin

For Phase 1, focus on building the navigation architecture and consistent layout. Do not create fake operational functionality.

## 6. Critical Business Constraints

Preserve these requirements across future implementation:
- Animal prices are locked when commitments are created.
- Payment progress is based only on verified successful payments.
- A completed payment commitment does not imply Qurban execution has occurred.
- Financial records must be auditable and ledger-based.
- User privacy and publishing consent must be respected.
- Admin permissions must be enforced in the backend, not only through UI visibility.
- Simulated payments must be clearly labeled and isolated from production.
- Supabase RLS must prevent unauthorized access to participant and financial data.

## 7. Phase 1 Deliverables

1. Functional and responsive public website.
2. Centralized design system.
3. Reusable UI component architecture.
4. Clear participant and admin navigation shells.
5. Functional Qurban price and installment simulator using PRD example prices, clearly labeled as sample pricing.
6. Supabase-ready architecture with secure boundaries.
7. Clear separation between implemented, demo, and pending features.

Before marking Phase 1 complete, audit every page for:
- Typography consistency
- Spacing consistency
- Responsive behavior
- Navigation accuracy
- Form usability
- Broken interactions
- Accessibility
- Branding consistency

**Important:** Build Phase 1 completely and consistently before expanding into complex financial functionality.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://qurbanity.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/77d58af1-dedc-4028-a592-57b1db974e85).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
