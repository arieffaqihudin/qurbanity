import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span>atau lanjutkan dengan</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function GoogleAuthButton({
  label,
  onError,
}: {
  label: string;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const start = async () => {
    onError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth?oauth=1`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setLoading(false);
      onError(
        /provider is not enabled|unsupported provider/i.test(error.message)
          ? "Masuk dengan Google belum diaktifkan. Gunakan email dan kata sandi atau hubungi pengelola."
          : "Google tidak dapat dibuka saat ini. Silakan coba lagi.",
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full gap-3 border-border bg-card"
      onClick={() => void start()}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
      {label}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z"
      />
      <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18Z" />
      <path
        fill="#EA4335"
        d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.9 15l6.9 5.2C14.4 15.5 18.8 12 24 12Z"
      />
    </svg>
  );
}
