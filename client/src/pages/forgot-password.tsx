import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthLayout } from "@/components/auth/auth-layout";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: z.infer<typeof forgotPasswordSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setIsSubmitted(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al procesar tu solicitud",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col space-y-6">
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-heading font-bold text-foreground">Recuperar Contraseña</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Ingresa tu email y te enviaremos instrucciones para restablecer tu contraseña
          </p>
        </div>

        {isSubmitted ? (
          <Alert className="bg-primary/10 border-primary/20 rounded-xl">
            <Check className="h-4 w-4 text-primary" />
            <AlertTitle className="font-heading font-semibold text-foreground">Solicitud enviada</AlertTitle>
            <AlertDescription className="font-sans text-foreground/80 mt-2">
              Si el email existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.
              Por favor, revisa tu correo electrónico.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-sans text-foreground/80">Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@email.com" className="bg-transparent border-black/10 dark:border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-sans rounded-xl h-11 transition-all" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar instrucciones"}
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
