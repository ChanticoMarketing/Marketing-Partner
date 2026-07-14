import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthLayout } from "@/components/auth/auth-layout";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    async function checkSession() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const type = params.get("type");
      const accessToken = params.get("access_token");

      if (type === "recovery" && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: params.get("refresh_token") || "",
        });
        if (!error) {
          setHasRecoveryToken(true);
        }
      }
      setIsVerifying(false);
    }
    checkSession();
  }, []);

  const onSubmit = async (data: z.infer<typeof resetPasswordSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Éxito",
        description: "Tu contraseña ha sido restablecida con éxito",
      });

      setTimeout(() => {
        setLocation("/auth");
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al restablecer tu contraseña",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <h2 className="text-xl font-heading font-bold text-foreground">Verificando...</h2>
            <p className="text-sm text-muted-foreground font-sans">
              Estamos verificando la validez de tu solicitud
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col space-y-6">
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-heading font-bold text-foreground">Restablecer Contraseña</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Crea una nueva contraseña para tu cuenta
          </p>
        </div>

        {!hasRecoveryToken ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-heading font-semibold">Token inválido o expirado</AlertTitle>
            <AlertDescription className="font-sans mt-2">
              El enlace que has seguido ha expirado o no es válido. Por favor, solicita un nuevo enlace para restablecer tu contraseña.
            </AlertDescription>
          </Alert>
        ) : isSubmitted ? (
          <Alert className="bg-primary/10 border-primary/20 rounded-xl">
            <Check className="h-4 w-4 text-primary" />
            <AlertTitle className="font-heading font-semibold text-foreground">Contraseña restablecida</AlertTitle>
            <AlertDescription className="font-sans text-foreground/80 mt-2">
              Tu contraseña ha sido restablecida con éxito. Serás redirigido a la página de inicio de sesión en unos segundos.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-sans text-foreground/80">Nueva contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="bg-transparent border-black/10 dark:border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-sans text-foreground/80">Confirmar contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="bg-transparent border-black/10 dark:border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-sans rounded-xl h-11 transition-all" disabled={isSubmitting}>
                {isSubmitting ? "Restableciendo..." : "Restablecer contraseña"}
              </Button>
            </form>
          </Form>
        )}

        <div className="flex justify-center pt-4">
          <Link href="/auth" className="flex items-center text-sm font-sans text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a inicio de sesión
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
