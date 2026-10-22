// SEMENTARA — hanya untuk QA alur aktivasi di sandbox. Hapus sebelum publish.
// Menghasilkan tautan aktivasi (generateLink) untuk akun uji +qa* agar alur
// "klik tautan dari email" dapat diuji tanpa akses kotak masuk.
import { createFileRoute } from "@tanstack/react-router";

const QA_KEY = "qa-7f3c9a21e84b4d6f8a0c2e5b7193d4f6";
const QA_EMAIL_RE = /^arief\.faqihudin\+qa\d+@gmail\.com$/;

export const Route = createFileRoute("/api/public/qa-activation-link")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("key") !== QA_KEY) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        const email = (url.searchParams.get("email") ?? "").toLowerCase();
        if (!QA_EMAIL_RE.test(email)) {
          return Response.json({ error: "hanya untuk akun uji" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const origin = url.searchParams.get("origin") ?? url.origin;
        let { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email,
          options: { redirectTo: `${origin}/aktivasi-akun` },
        });
        if (error && /already been registered/i.test(error.message)) {
          ({ data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo: `${origin}/aktivasi-akun` },
          }));
        }
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const link = data.properties?.action_link;
        if (!link) return Response.json({ error: "no link" }, { status: 500 });
        return Response.json({ link });
      },
    },
  },
});
