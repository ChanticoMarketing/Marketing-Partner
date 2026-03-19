import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { Shield, User, Lock, Key } from "lucide-react";

// Esquema de validación
const createUserSchema = z.object({
  fullName: z.string().min(3, { message: "El nombre completo debe tener al menos 3 caracteres" }),
  username: z.string().min(3, { message: "El nombre de usuario debe tener al menos 3 caracteres" }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
  secretKey: z.string().min(1, { message: "La clave secreta es requerida" })
});

type FormData = z.infer<typeof createUserSchema>;

export default function CreatePrimaryUser() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      secretKey: ""
    }
  });
  
  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest("POST", "/api/create-primary-account", data);
      
      if (response.ok) {
        const userData = await response.json();
        setIsSuccess(true);
        toast({
          title: "Usuario creado con éxito",
          description: "El usuario primario ha sido creado correctamente. Ahora puedes iniciar sesión.",
          variant: "default",
        });
        
        // Resetear el formulario
        form.reset();
      } else {
        // Intentar obtener el mensaje de error del servidor
        let errorMessage = "No se pudo crear el usuario primario";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // Si no se puede parsear el JSON, usar el status text
          errorMessage = response.statusText || errorMessage;
        }
        
        console.error("Server error:", response.status, errorMessage);
        toast({
          title: "Error al crear usuario",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating primary user:", error);
      
      // Determinar el tipo de error más específico
      let errorMessage = "Error de conexión desconocido";
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = "No se pudo conectar con el servidor. Verifica que el servidor esté ejecutándose.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error de conexión",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-[#0f172a]">
      <Card className="w-full max-w-md shadow-lg dark:bg-[#1a1d2d] dark:border-[#2a3349]">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-2 dark:bg-primary/20">
              <Shield className="h-6 w-6 text-primary dark:text-[#65cef5]" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold dark:text-foreground">Crear Usuario Primario</CardTitle>
          <CardDescription className="dark:text-slate-400">
            Crea una cuenta de administrador con permisos completos
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-300">Nombre Completo</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="Juan Pérez"
                          className="pl-9 dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:text-foreground focus:dark:border-[#65cef5]"
                          {...field}
                        />
                      </FormControl>
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-300">Nombre de Usuario</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="admin"
                          className="pl-9 dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:text-foreground focus:dark:border-[#65cef5]"
                          {...field}
                        />
                      </FormControl>
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-300">Contraseña</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-9 dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:text-foreground focus:dark:border-[#65cef5]"
                          {...field}
                        />
                      </FormControl>
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" />
                    </div>
                    <FormDescription className="text-xs dark:text-slate-500">
                      Al menos 6 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="secretKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-slate-300">Clave Secreta</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Clave secreta"
                          className="pl-9 dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:text-foreground focus:dark:border-[#65cef5]"
                          {...field}
                        />
                      </FormControl>
                      <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" />
                    </div>
                    <FormDescription className="text-xs dark:text-slate-500">
                      Clave predeterminada: <span className="font-medium">cohete-workflow-secret</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 dark:bg-[#65cef5] dark:hover:bg-[#58b7dc] dark:text-[#0f172a]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creando usuario..." : "Crear Usuario Primario"}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="text-center text-xs text-muted-foreground dark:text-slate-400">
          <p className="w-full">Esta página está protegida y solo debe ser utilizada por administradores autorizados.</p>
        </CardFooter>
        
        {isSuccess && (
          <div className="px-6 pb-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800/40 dark:text-green-300">
              <p className="text-center">
                ¡Usuario primario creado con éxito! Ahora puedes iniciar sesión con tus nuevas credenciales.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}