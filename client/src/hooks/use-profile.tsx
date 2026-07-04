import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

type UpdateProfile = {
  fullName?: string;
  bio?: string;
  jobTitle?: string;
  department?: string;
  phoneNumber?: string;
  preferredLanguage?: string;
  theme?: string;
  profileImage?: string;
  coverImage?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
};

export function useProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfile) => {
      if (!user) throw new Error("No hay usuario autenticado");

      const { data: updated, error } = await supabase
        .from("users")
        .update({
          full_name: data.fullName,
          bio: data.bio,
          job_title: data.jobTitle,
          department: data.department,
          phone_number: data.phoneNumber,
          preferred_language: data.preferredLanguage,
          theme: data.theme,
          profile_image: data.profileImage,
          cover_image: data.coverImage,
          nickname: data.nickname,
          first_name: data.firstName,
          last_name: data.lastName,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: (data) => {
      toast({
        title: "Perfil actualizado",
        description: "Tus datos de perfil se han actualizado correctamente",
      });
      queryClient.setQueryData(["/api/user"], data);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ newPassword }: { currentPassword?: string; newPassword: string }) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido actualizada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadProfileImage = async (file: File) => {
    setIsUploading(true);
    try {
      if (!user) throw new Error("No hay usuario autenticado");

      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await updateProfileMutation.mutateAsync({ profileImage: publicUrl });

      toast({
        title: "Imagen actualizada",
        description: "Tu foto de perfil se ha actualizado correctamente",
      });

      return publicUrl;
    } catch (error) {
      toast({
        title: "Error al subir imagen",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al subir la imagen",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    changePassword: changePasswordMutation.mutate,
    changePasswordAsync: changePasswordMutation.mutateAsync,
    uploadProfileImage,
    isUpdating: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    isUploading,
    user,
  };
}
