import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Loader2, Plus, Search, Trash2, UserCog, UserPlus, ShieldCheck, ShieldAlert, Key } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// Components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form schema for creating new users
const createUserSchema = z.object({
  fullName: z.string()
    .min(3, "El nombre completo debe tener al menos 3 caracteres"),
  username: z.string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(20, "El nombre de usuario debe tener máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "El nombre de usuario solo puede contener letras, números y guiones bajos"),
  password: z.string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  isPrimary: z.boolean().default(false),
  role: z.enum(['admin', 'manager', 'designer', 'content_creator', 'analyst']).default('content_creator'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

// Form schema for changing user password
const changePasswordSchema = z.object({
  newPassword: z.string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// Types for users
type User = {
  id: number;
  fullName: string;
  username: string;
  isPrimary: boolean;
  role?: string;
  createdAt: string;
};

const UserManagementPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [changePasswordUser, setChangePasswordUser] = useState<User | null>(null);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);

  // Check if user is primary, redirect if not
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!user.isPrimary) {
    return <Redirect to="/" />;
  }

  // Get the current user's ID
  const currentUserId = user?.id;

  // Query for fetching users
  const { data: users, isLoading, isError, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 30000, // 30 seconds
  });

  // Form for creating users
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      isPrimary: false,
      role: "content_creator",
    },
  });

  // Form for editing users
  const editForm = useForm<Partial<CreateUserFormValues>>({
    resolver: zodResolver(createUserSchema.partial()),
    defaultValues: {
      fullName: "",
      username: "",
      isPrimary: false,
      role: "content_creator",
    },
  });

  // Form for changing password
  const changePasswordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Mutation for creating users
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormValues) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al crear usuario");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating users
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number, data: Partial<CreateUserFormValues> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al actualizar usuario");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Usuario actualizado",
        description: "Los permisos del usuario han sido actualizados exitosamente",
      });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting users
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al eliminar usuario");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente",
      });
      setIsDeleteDialogOpen(false);
      setDeleteUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar usuario",
        description: error.message,
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
    },
  });

  // Mutation for changing user password
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number, newPassword: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/change-password`, { newPassword });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al cambiar contraseña");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Contraseña cambiada",
        description: `La contraseña de ${data.targetUser} ha sido actualizada exitosamente`,
      });
      setIsChangePasswordDialogOpen(false);
      setChangePasswordUser(null);
      changePasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cambiar contraseña",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: CreateUserFormValues) => {
    createUserMutation.mutate(data);
  };

  // Handle edit user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      fullName: user.fullName,
      username: user.username,
      isPrimary: user.isPrimary,
      role: user.role || "content_creator",
    });
    setIsEditDialogOpen(true);
  };

  // Handle edit form submission
  const onEditSubmit = (data: Partial<CreateUserFormValues>) => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        data: {
          ...data,
          password: undefined // No enviar password al actualizar
        }
      });
    }
  };

  // Handle delete confirmation
  const confirmDelete = () => {
    if (deleteUserId) {
      deleteUserMutation.mutate(deleteUserId);
    }
  };

  // Handle change password
  const handleChangePassword = (user: User) => {
    setChangePasswordUser(user);
    changePasswordForm.reset({
      newPassword: "",
      confirmPassword: "",
    });
    setIsChangePasswordDialogOpen(true);
  };

  // Handle change password form submission
  const onChangePasswordSubmit = (data: ChangePasswordFormValues) => {
    if (changePasswordUser) {
      changePasswordMutation.mutate({
        userId: changePasswordUser.id,
        newPassword: data.newPassword
      });
    }
  };

  // Filter users based on search term
  const filteredUsers = users?.filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-primary">/</span> GESTIÓN DE USUARIOS
          </h1>
          <p className="text-muted-foreground tracking-wide mt-1">
            Administración de personal y credenciales de acceso
          </p>
        </div>

        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider uppercase shadow-md transition-all duration-300 hover:scale-105">
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Stats & Search Section */}
      <div className="bg-card border-border p-6 rounded-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Administradores</p>
              <p className="text-2xl font-bold text-foreground">{users?.filter(user => user.isPrimary).length || 0}</p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Estándar</p>
              <p className="text-2xl font-bold text-foreground">{users?.filter(user => !user.isPrimary).length || 0}</p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Usuarios</p>
              <p className="text-2xl font-bold text-foreground">{users?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4" />
          <Input
            placeholder="Buscar por nombre o credencial..."
            className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
      ) : isError ? (
        <div className="bg-card border-red-500/20 bg-red-500/5 p-8 rounded-xl text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Error de Sistema</h3>
          <p className="text-red-400">
            {error instanceof Error ? error.message : "Fallo en la recuperación de datos de usuarios"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers && filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div key={user.id} className="bg-card border-border group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <UserCog className="w-24 h-24 text-primary" />
                </div>

                <div className="p-6 relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                        {user.fullName}
                        {user.isPrimary && (
                          <span className="flex h-2 w-2 rounded-full bg-primary shadow-md"></span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">@{user.username}</p>
                    </div>
                    {user.isPrimary ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] tracking-wider">
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 uppercase text-[10px] tracking-wider">
                        Estándar
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Rol</span>
                      <span className="text-foreground uppercase text-xs font-bold tracking-wide">{user.role || "N/A"}</span>
                    </div>
                    <div className="flex justify-between text-sm border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Alta</span>
                      <span className="text-foreground font-mono text-xs">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() => handleEditUser(user)}
                      title="Editar permisos"
                    >
                      <UserCog className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() => handleChangePassword(user)}
                      title="Cambiar contraseña"
                    >
                      <Key className="h-4 w-4" />
                    </Button>

                    {user.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          setDeleteUserId(user.id);
                          setIsDeleteDialogOpen(true);
                        }}
                        title="Eliminar usuario"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-card rounded-xl p-12 text-center border border-border/50">
              <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                No se encontraron usuarios
              </h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Ajusta los parámetros de búsqueda." : "No hay personal registrado en el sistema."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Dialog para crear usuario */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
            <DialogDescription>
              Completa el formulario para crear un nuevo usuario, selecciona su rol y tipo
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de usuario" {...field} />
                    </FormControl>
                    <FormDescription>
                      Solo letras, números y guiones bajos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Usuario Administrador</FormLabel>
                      <FormDescription>
                        Acceso a todas las funciones del sistema, incluida la gestión de usuarios.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol del Usuario</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="designer">Diseñador</SelectItem>
                        <SelectItem value="content_creator">Creador de Contenido</SelectItem>
                        <SelectItem value="analyst">Analista</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      El rol define los permisos y el acceso a las funciones del sistema.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createUserMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : "Crear usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar permisos de usuario */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar permisos de usuario</DialogTitle>
            <DialogDescription>
              Modifica los permisos y rol de {editingUser?.fullName}
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de usuario" {...field} />
                    </FormControl>
                    <FormDescription>
                      Solo letras, números y guiones bajos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={editingUser?.id === currentUserId}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Usuario Administrador</FormLabel>
                      <FormDescription>
                        {editingUser?.id === currentUserId
                          ? "No puedes modificar tus propios permisos de administrador."
                          : "Acceso a todas las funciones del sistema, incluida la gestión de usuarios."
                        }
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol del Usuario</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="designer">Diseñador</SelectItem>
                        <SelectItem value="content_creator">Creador de Contenido</SelectItem>
                        <SelectItem value="analyst">Analista</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      El rol define los permisos y el acceso a las funciones del sistema.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingUser(null);
                    editForm.reset();
                  }}
                  disabled={updateUserMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : "Actualizar permisos"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para cambiar contraseña de usuario */}
      <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Cambiar la contraseña de {changePasswordUser?.fullName}
            </DialogDescription>
          </DialogHeader>

          <Form {...changePasswordForm}>
            <form onSubmit={changePasswordForm.handleSubmit(onChangePasswordSubmit)} className="space-y-4">
              <FormField
                control={changePasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Nueva contraseña"
                        {...field}
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={changePasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirmar contraseña"
                        {...field}
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsChangePasswordDialogOpen(false);
                    setChangePasswordUser(null);
                    changePasswordForm.reset();
                  }}
                  disabled={changePasswordMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cambiando...
                    </>
                  ) : "Cambiar contraseña"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog para eliminar usuario */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El usuario será eliminado permanentemente
              y perderá todo acceso a sus proyectos y asignaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : "Eliminar usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagementPage;