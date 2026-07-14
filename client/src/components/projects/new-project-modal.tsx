import { useLocation } from "wouter";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { dbQuery } from "@/lib/supabase-helpers";
import {
  PROJECT_COLOR_OPTIONS,
  getProjectImageExtension,
  getProjectColor,
  normalizeProjectColor,
  validateProjectImage,
} from "@/lib/project-identity";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre del proyecto es requerido"),
  color: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => normalizeProjectColor(value) !== null, {
      message: "Selecciona un color válido",
    }),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const defaultValues: ProjectFormValues = {
  name: "",
  color: PROJECT_COLOR_OPTIONS[0].value,
};

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<number | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  });

  const handleClose = (force = false) => {
    if (!force && createProjectMutation.isPending) return;
    form.reset(defaultValues);
    setImageFile(null);
    setImageError(null);
    setUploadError(null);
    setPendingProjectId(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    onClose();
  };

  const finishProject = (projectId: number) => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    handleClose(true);
    navigate(`/projects/${projectId}`);
  };

  const createProjectMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      if (!user?.id) {
        throw new Error("Debes iniciar sesión para crear un proyecto.");
      }

      const selectedImageError = validateProjectImage(imageFile);
      if (selectedImageError) throw new Error(selectedImageError);

      const projectId = pendingProjectId ?? (await dbQuery("projects").insertSingle({
        name: values.name.trim(),
        client: values.name.trim(),
        color: getProjectColor(values.color),
        imageUrl: null,
        createdBy: user.id,
        status: "planning",
      })).id;

      if (!projectId) throw new Error("El proyecto se creó sin un identificador válido.");
      if (!imageFile) return { projectId, pendingImage: false };

      const extension = getProjectImageExtension(imageFile);
      if (!extension) throw new Error("Usa una imagen JPEG, PNG o WebP.");
      const path = `${projectId}/${crypto.randomUUID()}.${extension}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("project-images")
          .upload(path, imageFile, { upsert: false, contentType: imageFile.type });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from("project-images")
          .getPublicUrl(path);

        await dbQuery("projects").updateSingle(
          { imageUrl: publicUrl.publicUrl },
          { id: projectId },
        );
        return { projectId, pendingImage: false };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Error desconocido";
        console.error("[project-images] No se pudo completar la imagen", {
          projectId,
          path,
          reason,
        });

        const { error: cleanupError } = await supabase.storage
          .from("project-images")
          .remove([path]);
        if (cleanupError) {
          console.error("[project-images] Limpieza pendiente", {
            projectId,
            path,
            reason: cleanupError.message,
          });
        }

        return { projectId, pendingImage: true, reason };
      }
    },
    onSuccess: (result) => {
      if (result.pendingImage) {
        setPendingProjectId(result.projectId);
        setUploadError(result.reason ?? "No se pudo subir la imagen.");
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        return;
      }

      toast({ title: "Proyecto creado", description: "Tu nuevo proyecto ya está listo." });
      finishProject(result.projectId);
    },
    onError: (error) => {
      toast({
        title: "Error al crear proyecto",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProjectFormValues) => {
    if (imageError) return;
    createProjectMutation.mutate(values);
  };

  const handleImageChange = (file: File | null) => {
    setUploadError(null);
    setImageFile(file);
    setImageError(validateProjectImage(file));
  };

  const handleDialogChange = (open: boolean) => {
    if (open) return;
    if (pendingProjectId && !createProjectMutation.isPending) {
      finishProject(pendingProjectId);
      return;
    }
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Crear Nuevo Proyecto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del proyecto</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej. Cohete Brands"
                      autoComplete="off"
                      disabled={createProjectMutation.isPending || pendingProjectId !== null}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color identificador</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                      {PROJECT_COLOR_OPTIONS.map((option) => {
                        const isSelected = field.value === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => field.onChange(option.value)}
                            className={`rounded-xl border p-2 text-left transition-all ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border hover:border-primary/40"
                            }`}
                            aria-label={`Seleccionar color ${option.label}`}
                            disabled={createProjectMutation.isPending || pendingProjectId !== null}
                          >
                            <div
                              className="mb-2 h-8 rounded-lg"
                              style={{ backgroundColor: option.value }}
                            />
                            <div className="text-[11px] font-medium text-foreground">
                              {option.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Imagen opcional</FormLabel>
              <Input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={createProjectMutation.isPending}
                onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">JPEG, PNG o WebP; máximo 5 MB.</p>
              {imageError && <p className="text-sm text-destructive">{imageError}</p>}
              {uploadError && (
                <p className="text-sm text-amber-600">
                  El proyecto ya fue creado, pero la imagen falló: {uploadError}
                </p>
              )}
            </FormItem>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => pendingProjectId ? finishProject(pendingProjectId) : handleClose()}
                disabled={createProjectMutation.isPending}
              >
                {pendingProjectId ? "Continuar sin imagen" : "Cancelar"}
              </Button>
              <Button
                type="submit"
                disabled={createProjectMutation.isPending || !!imageError || !imageFile && pendingProjectId !== null}
              >
                {createProjectMutation.isPending
                  ? pendingProjectId ? "Reintentando..." : "Creando..."
                  : pendingProjectId ? "Reintentar imagen" : "Crear Proyecto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
