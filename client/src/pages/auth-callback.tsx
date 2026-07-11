import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          setLocation("/");
        } else {
          setLocation("/auth");
        }
      } catch (err: any) {
        setError(err.message || "Error during authentication callback");
        setTimeout(() => setLocation("/auth"), 3000);
      }
    }

    handleCallback();
  }, [setLocation]);

  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        {error ? (
          <div className="text-center space-y-2">
            <h2 className="text-xl font-heading font-bold text-destructive">Error de Autenticación</h2>
            <p className="text-sm text-destructive/80 font-sans">{error}</p>
            <p className="text-xs text-muted-foreground font-sans mt-4">Redirigiendo a inicio de sesión...</p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-heading font-bold text-foreground">Preparando tu espacio...</h2>
            <p className="text-sm text-muted-foreground font-sans">
              Estamos configurando todo para ti.
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
