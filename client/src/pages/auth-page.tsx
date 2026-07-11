import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Contraseña es requerida"),
});

const registerSchema = z.object({
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirma tu contraseña"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading, error: authError, loginMutation, registerMutation } = useAuth();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", username: "", email: "", password: "", confirmPassword: "" },
  });

  const onLoginSubmit = async (data: LoginForm) => {
    await loginMutation.mutateAsync({ email: data.email, password: data.password });
  };

  const onRegisterSubmit = async (data: RegisterForm) => {
    await registerMutation.mutateAsync({
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: data.password,
    });
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  useEffect(() => {
    if (!isAuthLoading && user) {
      setLocation("/");
    }
  }, [isAuthLoading, setLocation, user]);

  if (!isAuthLoading && user) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-sans">Redirigiendo a tu espacio...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col space-y-6">
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-heading font-bold text-foreground">Bienvenido</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Accede a tu cuenta para continuar
          </p>
        </div>

        {authError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive font-sans">
            {authError.message}
          </div>
        )}

        <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <TabsTrigger value="login" className="rounded-lg font-sans">Iniciar sesión</TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg font-sans">Registrarse</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                <FormField
                  control={loginForm.control}
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
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="font-sans text-foreground/80">Contraseña</FormLabel>
                        <Button variant="link" className="p-0 h-auto text-xs font-sans text-muted-foreground hover:text-primary" onClick={(e) => { e.preventDefault(); setLocation("/forgot-password"); }}>¿Olvidaste tu contraseña?</Button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showLoginPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="bg-transparent border-black/10 dark:border-white/10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-sans rounded-xl h-11 transition-all" disabled={isLoading}>
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    "Iniciar sesión"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-foreground/80">Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu nombre" className="bg-transparent border-black/10 dark:border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-foreground/80">Nombre de Usuario</FormLabel>
                      <FormControl>
                        <Input placeholder="tu_usuario" className="bg-transparent border-black/10 dark:border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
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
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-foreground/80">Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showRegisterPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="bg-transparent border-black/10 dark:border-white/10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            aria-label={showRegisterPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-sans text-foreground/80">Confirmar Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="bg-transparent border-black/10 dark:border-white/10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-sans rounded-xl h-11 transition-all mt-6" disabled={isLoading}>
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    "Crear cuenta"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-black/10 dark:border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#F7F2E9] dark:bg-[#151312] px-4 text-muted-foreground font-sans tracking-wider">
              O continúa con
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full bg-transparent border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 font-sans h-11 rounded-xl transition-all"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <svg
            className="mr-2 h-4 w-4"
            aria-hidden="true"
            focusable="false"
            data-prefix="fab"
            data-icon="google"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 488 512"
          >
            <path
              fill="currentColor"
              d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h240z"
            />
          </svg>
          Continuar con Google
        </Button>

        <p className="text-center text-xs text-muted-foreground font-sans pt-4">
          Al continuar, aceptas los Términos de Servicio y la Política de Privacidad de Chantia.
        </p>
      </div>
    </AuthLayout>
  );
}
