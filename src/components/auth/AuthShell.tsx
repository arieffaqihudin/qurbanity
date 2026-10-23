import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/site/Logo";
import pasture from "@/assets/hero-pasture.jpg";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-background md:grid md:grid-cols-[40fr_60fr] lg:grid-cols-[48fr_52fr]">
      <aside
        className="relative flex min-h-36 items-end overflow-hidden bg-burgundy-dark bg-cover bg-center px-5 py-3 text-primary-foreground sm:min-h-40 sm:px-8 md:sticky md:top-0 md:h-dvh md:min-h-dvh md:items-center md:px-7 md:py-10 lg:px-12 lg:py-12"
        style={{
          backgroundImage: `linear-gradient(180deg, rgb(38 5 12 / 0.24), rgb(38 5 12 / 0.84)), url("${pasture}")`,
        }}
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(110deg,rgb(64_5_18_/_0.78)_0%,rgb(64_5_18_/_0.38)_52%,rgb(64_5_18_/_0.08)_100%)]"
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-xl">
          <Logo light className="mb-5 hidden md:inline-flex" />
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-cream/90 md:hidden">
            Qurbanity by Manfaat Mengalir
          </p>
          <h2 className="max-w-lg text-2xl font-extrabold leading-tight sm:text-3xl lg:text-5xl">
            Kebaikan dimulai dari langkah kecil.
          </h2>
          <p className="mt-3 hidden max-w-md text-base leading-relaxed text-cream/90 md:block">
            Rencanakan kurban secara bertahap, pantau progresnya, dan ikuti perjalanan kebaikanmu.
          </p>
          <p className="mt-2 hidden text-sm font-semibold text-cream/85 md:block">
            Qurbanity by Manfaat Mengalir
          </p>
        </div>
      </aside>

      <section className="flex min-h-[calc(100dvh-9rem)] flex-col px-5 py-8 sm:px-8 sm:py-10 md:min-h-dvh md:px-6 md:py-8 lg:px-10 lg:py-12">
        <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col justify-center">
          <div className="mb-7 md:hidden">
            <Logo />
          </div>
          <header className="mb-6">
            <h1 className="text-2xl font-extrabold text-burgundy-dark sm:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
            )}
          </header>
          {children}
          <Link
            to="/"
            className="mt-7 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-burgundy-dark transition-colors hover:text-primary focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-4" /> Kembali ke Beranda
          </Link>
        </div>
      </section>
    </main>
  );
}

export function LegalNotice() {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground">
      Dengan masuk atau mendaftar, Anda menyetujui{" "}
      <Link
        to="/syarat-ketentuan"
        className="font-semibold text-primary underline underline-offset-2"
      >
        Syarat dan Ketentuan
      </Link>{" "}
      serta{" "}
      <Link
        to="/kebijakan-privasi"
        className="font-semibold text-primary underline underline-offset-2"
      >
        Kebijakan Privasi
      </Link>{" "}
      kami.
    </p>
  );
}

export function FieldError({ id, msg }: { id: string; msg?: string | undefined }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-destructive">
      {msg}
    </p>
  );
}

export function FormAlert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive"
          : "rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-medium text-success"
      }
    >
      {children}
    </div>
  );
}
