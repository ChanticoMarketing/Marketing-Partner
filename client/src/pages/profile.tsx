import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { Camera, Upload, User, Loader2, Settings, Plus, X, MapPin, Briefcase, Heart, Award, Lock, Activity, Bell, Shield, BarChart3, Calendar, Clock, CheckCircle2, Eye, EyeOff, Edit, Save, Trash2, Image as ImageIcon, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import gsap from "gsap";

// Import avatars from assets
// COMMENTED OUT: Images not found
// import astronaut1 from "@assets/Image_fx (81)_1750440002891.jpg";
// import astronaut2 from "@assets/Image_fx (80)_1750440005597.jpg";
// import astronaut3 from "@assets/Image_fx (78)_1750440024672.jpg";
// import astronaut4 from "@assets/Image_fx (82)_1750440102531.jpg";
// import astronaut5 from "@assets/Image_fx (76)_1750440109336.jpg";
// import astronaut6 from "@assets/Image_fx (74)_1750440111516.jpg";

// COMMENTED OUT: Images not found
// const preloadedAvatars = [
//   { id: 1, name: "Astronauta Cibernetico", src: astronaut1 },
//   { id: 2, name: "Astronauta Clásico", src: astronaut2 },
//   { id: 3, name: "Astronauta Espacial", src: astronaut3 },
//   { id: 4, name: "Astronauta Galáctico", src: astronaut4 },
//   { id: 5, name: "Astronauta Oscuro", src: astronaut5 },
//   { id: 6, name: "Astronauta Rosa", src: astronaut6 },
// ];
const preloadedAvatars: any[] = [];

interface CustomField {
  id: string;
  name: string;
  value: string;
  type: 'text' | 'email' | 'url' | 'tel';
}

interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  jobTitle: string;
  department: string;
  phoneNumber: string;
  customFields: CustomField[];
  isPrimary: boolean;
  role: string;
  createdAt: string;
  location?: string;
  website?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  preferences?: {
    emailNotifications: boolean;
    projectUpdates: boolean;
    taskReminders: boolean;
    weeklyReports: boolean;
  };
}

interface UserStats {
  projectsCreated: number;
  tasksCompleted: number;
  totalSchedules: number;
  totalCollaborations: number;
  profileCompleteness: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  icon: string;
}

// Schema for change password form
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La confirmación de contraseña es requerida"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<'text' | 'email' | 'url' | 'tel'>('text');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<string>("");
  const [editMode, setEditMode] = useState<'profile' | 'cover'>('profile');
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<UserProfile>>({});

  // Fetch user profile
  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      return fromDb<UserProfile>("users", data);
    },
  });

  useEffect(() => {
    if (isLoading) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".gsap-stagger",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.15,
          ease: "power3.out",
          delay: 0.2
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [isLoading]);

  // Fetch user statistics
  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    staleTime: 30000, // 30 seconds
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery<RecentActivity[]>({
    queryKey: ["/api/user/activity"],
    staleTime: 60000, // 1 minute
  });

  // Form for changing password
  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile> & Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No hay usuario autenticado");
      const { data: updated, error } = await supabase
        .from("users")
        .update({
          full_name: data.fullName,
          bio: data.bio,
          job_title: data.jobTitle,
          department: data.department,
          phone_number: data.phoneNumber,
          profile_image: data.profileImage,
          cover_image: data.coverImage,
          nickname: data.nickname,
          first_name: data.firstName,
          last_name: data.lastName,
        })
        .eq("id", session.user.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      setPendingChanges({}); // Limpiar cambios pendientes
      setIsEditModalOpen(false); // Cerrar modal de edición
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error en mutación:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormValues) => {
      return apiRequest("POST", "/api/profile/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Contraseña cambiada",
        description: "Tu contraseña ha sido actualizada exitosamente",
      });
      setIsChangePasswordOpen(false);
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cambiar contraseña",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload cover image mutation
  const uploadCoverMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No hay sesión activa");

      const filePath = `${session.user.id}/cover-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("cover-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("cover-images")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update user profile with new cover image URL
      const { error: updateError } = await supabase
        .from("users")
        .update({ cover_image: publicUrl })
        .eq("id", session.user.id);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setCoverImagePreview("");
      setCoverImageFile(null);
      toast({
        title: "Imagen de portada actualizada",
        description: "La imagen se ha subido correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo subir la imagen de portada",
        variant: "destructive",
      });
    },
  });

  const handleAvatarSelect = (avatarSrc: string) => {
    setSelectedAvatar(avatarSrc);
    updateProfileMutation.mutate({ profileImage: avatarSrc });
    setIsAvatarDialogOpen(false);
  };

  const handleCustomImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Por favor selecciona un archivo de imagen válido",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "La imagen debe ser menor a 5MB",
          variant: "destructive",
        });
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("No hay sesión activa");

        const filePath = `${session.user.id}/profile-${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-images")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("profile-images")
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        const { error: updateError } = await supabase
          .from("users")
          .update({ profile_image: publicUrl })
          .eq("id", session.user.id);

        if (updateError) throw updateError;

        queryClient.invalidateQueries({ queryKey: ['user'] });
        setIsAvatarDialogOpen(false);
        toast({
          title: "Imagen actualizada",
          description: "Tu foto de perfil se ha actualizado correctamente",
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudo actualizar el perfil",
          variant: "destructive",
        });
      }
    }
  };

  const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverImageUpload = () => {
    if (coverImageFile) {
      // En lugar de subir directamente, agregar a cambios pendientes
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        handleFieldUpdate('coverImage', imageData);
        toast({
          title: "Imagen preparada",
          description: "La imagen de portada se guardará al hacer clic en 'Guardar Cambios'",
        });
      };
      reader.readAsDataURL(coverImageFile);
    }
  };

  const handleProfileImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tamaño del archivo (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo es demasiado grande. Máximo 5MB.",
          variant: "destructive",
        });
        return;
      }

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Por favor selecciona una imagen válida.",
          variant: "destructive",
        });
        return;
      }

      // Actualizar imagen de perfil
      // uploadProfileMutation.mutate(file); // This mutation doesn't exist in the provided code, commenting out
      console.warn("uploadProfileMutation not implemented");
    }
  };

  const handleFieldUpdate = (field: keyof UserProfile, value: any) => {
    setPendingChanges(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const openImageEditor = (imageUrl: string, mode: 'profile' | 'cover') => {
    setImageToEdit(imageUrl);
    setEditMode(mode);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });

    // Configurar área de recorte según el modo
    if (mode === 'profile') {
      setCropArea({ x: 0, y: 0, width: 200, height: 200 });
    } else {
      setCropArea({ x: 0, y: 0, width: 800, height: 200 });
    }

    setIsImageEditorOpen(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Limitar el movimiento dentro de límites razonables
    const maxMove = 200;
    const limitedX = Math.max(-maxMove, Math.min(maxMove, newX));
    const limitedY = Math.max(-maxMove, Math.min(maxMove, newY));

    setImagePosition({ x: limitedX, y: limitedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Agregar event listeners para arrastre
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const applyImageEdits = () => {
    // Crear un canvas para aplicar los cambios
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Configurar canvas según el modo
      if (editMode === 'profile') {
        canvas.width = 200;
        canvas.height = 200;
      } else {
        canvas.width = 800;
        canvas.height = 200;
      }

      // Aplicar transformaciones
      ctx.save();
      ctx.translate(imagePosition.x, imagePosition.y);
      ctx.scale(imageScale, imageScale);

      // Dibujar imagen con recorte
      ctx.drawImage(
        img,
        cropArea.x, cropArea.y, cropArea.width, cropArea.height,
        0, 0, canvas.width, canvas.height
      );

      ctx.restore();

      // Convertir a base64
      const editedImageData = canvas.toDataURL('image/jpeg', 0.9);

      // Aplicar cambios según el modo
      if (editMode === 'profile') {
        setSelectedAvatar(editedImageData);
        handleFieldUpdate('profileImage', editedImageData);
      } else {
        handleFieldUpdate('coverImage', editedImageData);
      }

      setIsImageEditorOpen(false);

      toast({
        title: "Imagen editada",
        description: "Los cambios se guardarán al hacer clic en 'Guardar Cambios'",
      });
    };

    img.src = imageToEdit;
  };

  const handleSaveAllChanges = async () => {
    console.log("Cambios pendientes:", pendingChanges);
    console.log("Selected avatar:", selectedAvatar);

    // Crear objeto con todos los cambios, incluyendo la imagen seleccionada
    const allChanges = { ...pendingChanges };

    // Si hay una imagen seleccionada, incluirla en los cambios
    if (selectedAvatar) {
      allChanges.profileImage = selectedAvatar;
    }

    // Si hay una imagen de portada preparada, subirla primero
    if (coverImageFile) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("No hay sesión activa");

        const filePath = `${session.user.id}/cover-${Date.now()}-${coverImageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cover-images")
          .upload(filePath, coverImageFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("cover-images")
          .getPublicUrl(filePath);

        allChanges.coverImage = urlData.publicUrl;
      } catch (error) {
        console.error("Error uploading cover image:", error);
        toast({
          title: "Error",
          description: "No se pudo subir la imagen de portada",
          variant: "destructive",
        });
        return;
      }
    }

    console.log("Todos los cambios a enviar:", allChanges);

    if (Object.keys(allChanges).length > 0) {
      updateProfileMutation.mutate(allChanges);
    } else {
      toast({
        title: "No hay cambios",
        description: "No se han realizado cambios para guardar",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChange = (data: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(data);
  };

  const calculateProfileCompleteness = () => {
    if (!user) return 0;

    const fields = [
      user.fullName,
      user.email,
      user.bio,
      user.profileImage,
      user.jobTitle,
      user.department,
      user.phoneNumber,
    ];

    const completedFields = fields.filter(field => field && field.trim() !== '').length;
    return Math.round((completedFields / fields.length) * 100);
  };

  const addCustomField = () => {
    if (newFieldName.trim()) {
      const newField: CustomField = {
        id: Date.now().toString(),
        name: newFieldName,
        value: "",
        type: newFieldType,
      };
      const updatedFields = [...customFields, newField];
      setCustomFields(updatedFields);
      handleFieldUpdate('customFields', updatedFields);
      setNewFieldName("");
      setNewFieldType('text');
    }
  };

  const removeCustomField = (fieldId: string) => {
    const updatedFields = customFields.filter(field => field.id !== fieldId);
    setCustomFields(updatedFields);
    handleFieldUpdate('customFields', updatedFields);
  };

  const updateCustomField = (fieldId: string, value: string) => {
    const updatedFields = customFields.map(field =>
      field.id === fieldId ? { ...field, value } : field
    );
    setCustomFields(updatedFields);
    handleFieldUpdate('customFields', updatedFields);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" ref={containerRef}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 gsap-stagger">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shadow-md">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              <span className="text-primary">/</span> MI PERFIL
            </h1>
            <p className="text-muted-foreground tracking-wide">
              Identidad digital y estadísticas de rendimiento
            </p>
          </div>
        </div>

        {/* Cover Image Section */}
        <div className="bg-card border-border border-border rounded-xl overflow-hidden relative group gsap-stagger">
          <div className="relative h-64 bg-black/50 overflow-hidden">
            {user?.coverImage || coverImagePreview ? (
              <img
                src={coverImagePreview || user?.coverImage}
                alt="Imagen de portada"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
              />
            ) : (
              <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>

            {/* Overlay Grid Pattern */}
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20"></div>
          </div>

          <div className="px-8 pb-8 relative -mt-20 flex flex-col md:flex-row items-end gap-6">
            <div className="relative group/avatar">
              <div className="h-40 w-40 rounded-2xl border-2 border-primary/50 bg-black/80 overflow-hidden shadow-md backdrop-blur-xl p-1">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center rounded-xl">
                    <User className="h-20 w-20 text-primary/50" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-black/80 backdrop-blur-md border border-primary/30 text-primary p-2 rounded-lg shadow-lg">
                <Shield className="h-5 w-5" />
              </div>
            </div>

            <div className="flex-1 mb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
                    {user?.fullName}
                    {user?.isPrimary && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-wider text-[10px]">
                        Comandante
                      </Badge>
                    )}
                  </h2>
                  <p className="text-primary/80 font-mono text-sm mb-2">@{user?.username}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {user?.jobTitle && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4 text-primary/70" />
                        {user.jobTitle}
                      </div>
                    )}
                    {user?.department && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-primary/70" />
                        {user.department}
                      </div>
                    )}
                    {user?.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary/70" />
                        {user.location}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setIsEditModalOpen(true)}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider font-bold shadow-md"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Datos
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 gsap-stagger">
          <div className="bg-card border-border p-6 rounded-xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Briefcase className="w-16 h-16 text-primary" />
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Proyectos Creados</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">{userStats?.projectsCreated || 0}</p>
                <span className="text-xs text-primary mb-1.5 font-mono">MISIONES</span>
              </div>
            </div>
          </div>

          <div className="bg-card border-border p-6 rounded-xl border border-border/50 relative overflow-hidden group hover:border-green-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Tareas Completadas</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">{userStats?.tasksCompleted || 0}</p>
                <span className="text-xs text-green-500 mb-1.5 font-mono">OBJETIVOS</span>
              </div>
            </div>
          </div>

          <div className="bg-card border-border p-6 rounded-xl border border-border/50 relative overflow-hidden group hover:border-purple-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calendar className="w-16 h-16 text-purple-500" />
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Cronogramas</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">{userStats?.totalSchedules || 0}</p>
                <span className="text-xs text-purple-500 mb-1.5 font-mono">PLANES</span>
              </div>
            </div>
          </div>

          <div className="bg-card border-border p-6 rounded-xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart3 className="w-16 h-16 text-primary" />
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Nivel de Perfil</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl font-bold text-foreground">{calculateProfileCompleteness()}%</p>
                <span className="text-xs text-primary mb-1.5 font-mono">COMPLETO</span>
              </div>
              <Progress value={calculateProfileCompleteness()} className="h-1.5 bg-muted/80" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end mb-6 gsap-stagger">
          <Button onClick={() => setIsEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar Perfil
          </Button>
        </div>

        {/* Edit Profile Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Perfil</DialogTitle>
              <DialogDescription>
                Actualiza tu información personal y profesional
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="professional">Profesional</TabsTrigger>
                <TabsTrigger value="images">Imágenes</TabsTrigger>
              </TabsList>

              {/* Personal Tab */}
              <TabsContent value="personal" className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Información Personal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre Completo</Label>
                      <Input
                        value={pendingChanges.fullName || user?.fullName || ''}
                        onChange={(e) => handleFieldUpdate('fullName', e.target.value)}
                        placeholder="Tu nombre completo"
                      />
                    </div>
                    <div>
                      <Label>Nombre de usuario</Label>
                      <Input
                        value={pendingChanges.username || user?.username || ''}
                        onChange={(e) => handleFieldUpdate('username', e.target.value)}
                        placeholder="Tu nombre de usuario"
                      />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input
                        value={pendingChanges.phoneNumber || user?.phoneNumber || ''}
                        onChange={(e) => handleFieldUpdate('phoneNumber', e.target.value)}
                        placeholder="Tu número de teléfono"
                      />
                    </div>
                    <div>
                      <Label>Ubicación</Label>
                      <Input
                        value={pendingChanges.location || user?.location || ''}
                        onChange={(e) => handleFieldUpdate('location', e.target.value)}
                        placeholder="Tu ubicación"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Biografía</Label>
                    <Textarea
                      value={pendingChanges.bio || user?.bio || ''}
                      onChange={(e) => handleFieldUpdate('bio', e.target.value)}
                      placeholder="Cuéntanos sobre ti"
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Professional Tab */}
              <TabsContent value="professional" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Información Profesional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Cargo</Label>
                      <Input
                        value={pendingChanges.jobTitle || user?.jobTitle || ''}
                        onChange={(e) => handleFieldUpdate('jobTitle', e.target.value)}
                        placeholder="Tu cargo o posición"
                      />
                    </div>
                    <div>
                      <Label>Departamento</Label>
                      <Input
                        value={pendingChanges.department || user?.department || ''}
                        onChange={(e) => handleFieldUpdate('department', e.target.value)}
                        placeholder="Tu departamento"
                      />
                    </div>
                    <div>
                      <Label>Sitio Web</Label>
                      <Input
                        value={pendingChanges.website || user?.website || ''}
                        onChange={(e) => handleFieldUpdate('website', e.target.value)}
                        placeholder="Tu sitio web profesional"
                      />
                    </div>
                    <div>
                      <Label>LinkedIn</Label>
                      <Input
                        value={pendingChanges.socialLinks?.linkedin || user?.socialLinks?.linkedin || ''}
                        onChange={(e) => handleFieldUpdate('socialLinks', {
                          ...pendingChanges.socialLinks,
                          linkedin: e.target.value
                        })}
                        placeholder="Tu perfil de LinkedIn"
                      />
                    </div>
                    <div>
                      <Label>GitHub</Label>
                      <Input
                        value={pendingChanges.socialLinks?.github || user?.socialLinks?.github || ''}
                        onChange={(e) => handleFieldUpdate('socialLinks', {
                          ...pendingChanges.socialLinks,
                          github: e.target.value
                        })}
                        placeholder="Tu perfil de GitHub"
                      />
                    </div>
                    <div>
                      <Label>Twitter</Label>
                      <Input
                        value={pendingChanges.socialLinks?.twitter || user?.socialLinks?.twitter || ''}
                        onChange={(e) => handleFieldUpdate('socialLinks', {
                          ...pendingChanges.socialLinks,
                          twitter: e.target.value
                        })}
                        placeholder="Tu perfil de Twitter"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Images Tab */}
              <TabsContent value="images" className="space-y-6">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Gestión de Imágenes</h3>

                  {/* Profile Image Section */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Foto de Perfil</h4>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-lg border-2 border-border bg-muted overflow-hidden">
                          {(selectedAvatar || user?.profileImage) ? (
                            <img
                              src={selectedAvatar || user?.profileImage}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <User className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfileImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">
                          Haz clic en la imagen para cambiar tu foto de perfil
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement | null)?.click()}
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Cambiar Foto
                          </Button>
                          {(selectedAvatar || user?.profileImage) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openImageEditor(selectedAvatar || user?.profileImage || '', 'profile')}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                          )}
                          {user?.profileImage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Aquí puedes agregar lógica para eliminar la imagen de perfil
                                toast({
                                  title: "Funcionalidad pendiente",
                                  description: "La eliminación de imagen se implementará próximamente",
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preloaded Avatars Section */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium">Selecciona una imagen predefinida</h5>
                      <div className="grid grid-cols-6 gap-3">
                        {preloadedAvatars.map((avatar) => (
                          <div
                            key={avatar.id}
                            className="relative cursor-pointer group"
                            onClick={() => {
                              // Actualizar imagen de perfil con imagen predefinida
                              const imageUrl = avatar.src;
                              setSelectedAvatar(imageUrl);
                              handleFieldUpdate('profileImage', imageUrl);
                              toast({
                                title: "Imagen seleccionada",
                                description: `Has seleccionado: ${avatar.name}. Recuerda guardar los cambios.`,
                              });
                            }}
                          >
                            <div className="w-16 h-16 rounded-lg border-2 border-border bg-muted overflow-hidden hover:border-primary transition-colors">
                              <img
                                src={avatar.src}
                                alt={avatar.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <CheckCircle2 className="h-6 w-6 text-foreground" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Haz clic en cualquier imagen para seleccionarla como tu foto de perfil
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Cover Image Section */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Imagen de Portada</h4>
                    <div className="space-y-4">
                      <div className="relative h-40 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg overflow-hidden border-2 border-dashed border-border">
                        {user?.coverImage || coverImagePreview ? (
                          <img
                            src={coverImagePreview || user?.coverImage}
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <div className="text-center text-foreground">
                              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-70" />
                              <p className="text-sm">Sin imagen de portada</p>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement | undefined)?.click()}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Cambiar Portada
                        </Button>
                        {coverImagePreview && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleCoverImageUpload}
                            disabled={uploadCoverMutation.isPending}
                          >
                            {uploadCoverMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Preparar Imagen
                              </>
                            )}
                          </Button>
                        )}
                        {(user?.coverImage || coverImagePreview) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openImageEditor(coverImagePreview || user?.coverImage || '', 'cover')}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                        )}
                        {(user?.coverImage || coverImagePreview) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCoverImagePreview(null);
                              setCoverImageFile(null);
                              // Aquí puedes agregar lógica para eliminar la imagen de portada del servidor
                              toast({
                                title: "Funcionalidad pendiente",
                                description: "La eliminación de imagen se implementará próximamente",
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Recomendado: 1200x400 píxeles. Formatos: JPG, PNG, GIF (máx. 5MB)
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Save Status */}
              {updateProfileMutation.isPending && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Guardando cambios...</span>
                </div>
              )}
            </Tabs>

            <div className="flex justify-end p-6 border-t">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveAllChanges}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cambiar Contraseña</DialogTitle>
              <DialogDescription>
                Actualiza tu contraseña para mantener tu cuenta segura.
              </DialogDescription>
            </DialogHeader>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña actual</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Ingresa tu contraseña actual"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Ingresa tu nueva contraseña"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nueva contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirma tu nueva contraseña"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsChangePasswordOpen(false)}
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
                    ) : (
                      "Cambiar contraseña"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Modal de edición de imagen */}
        <Dialog open={isImageEditorOpen} onOpenChange={setIsImageEditorOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Editar Imagen</DialogTitle>
              <DialogDescription>
                Arrastra la imagen para posicionarla o usa los controles deslizantes. Ajusta el tamaño con el zoom.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Vista previa de la imagen */}
              <div className="flex justify-center">
                <div className="relative w-96 h-96 border-2 border-dashed border-muted-foreground rounded-lg overflow-hidden bg-muted">
                  {imageToEdit && (
                    <div
                      ref={imageRef}
                      className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
                      style={{
                        transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                        transformOrigin: 'center'
                      }}
                      onMouseDown={handleMouseDown}
                    >
                      <img
                        src={imageToEdit}
                        alt="Imagen para editar"
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  )}
                  {!imageToEdit && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">Imagen para editar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Controles de edición */}
              <div className="space-y-4">
                {/* Control de escala */}
                <div className="space-y-2">
                  <Label>Tamaño: {Math.round(imageScale * 100)}%</Label>
                  <div className="flex items-center gap-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setImageScale(Math.max(0.5, imageScale - 0.1))}
                    >
                      -
                    </Button>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={imageScale}
                      onChange={(e) => setImageScale(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setImageScale(Math.min(2, imageScale + 0.1))}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Controles de posición */}
                <div className="space-y-2">
                  <Label>Posición (o arrastra la imagen directamente)</Label>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Horizontal: {imagePosition.x}px</Label>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      value={imagePosition.x}
                      onChange={(e) => setImagePosition({ ...imagePosition, x: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Vertical: {imagePosition.y}px</Label>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      value={imagePosition.y}
                      onChange={(e) => setImagePosition({ ...imagePosition, y: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImageScale(1);
                    setImagePosition({ x: 0, y: 0 });
                  }}
                >
                  Resetear
                </Button>
                <Button
                  onClick={applyImageEdits}
                >
                  Aplicar cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
