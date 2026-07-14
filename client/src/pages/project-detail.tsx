import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, Download, Pencil, AlertCircle, FileQuestion, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDb } from "@/lib/supabase-helpers";
import {
  PROJECT_COLOR_OPTIONS,
  getProjectColor,
  getProjectImageExtension,
  getProjectImagePath,
  validateProjectImage,
} from "@/lib/project-identity";
import ProjectIdentityAvatar from "@/components/projects/project-identity-avatar";
import ProjectAnalysis from "@/components/projects/project-analysis";
import ProjectWorkflows from "@/components/projects/project-workflows";
import ProjectChat from "@/components/projects/project-chat";
import ProjectLogs from "@/components/projects/project-logs";
import ProductList from "@/components/products/product-list";


interface ProjectDetailProps {
  id: number;
  initialTab?: "analysis" | "calendars" | "products" | "chat" | "logs";
  backPath?: string;
}

type ProjectTab = "analysis" | "calendars" | "products" | "chat" | "logs";

// Define interfaces outside of component to avoid recreation on each render
interface ProjectAnalysis {
  id: number;
  projectId: number;
  mission?: string;
  vision?: string;
  objectives?: string;
  targetAudience?: string;
  brandTone?: string;
  keywords?: string;
  coreValues?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectWithAnalysis {
  id: number;
  name: string;
  client: string;
  color?: string | null;
  imageUrl?: string | null;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  analysis?: ProjectAnalysis | null;
}

export default function ProjectDetail({
  id,
  initialTab = "analysis",
  backPath = "/projects",
}: ProjectDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<ProjectTab>(initialTab);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    client: string;
    color: string;
    description: string;
    startDate: string;
    endDate: string;
    status: string;
  }>({
    name: "",
    client: "",
    color: PROJECT_COLOR_OPTIONS[0].value,
    description: "",
    startDate: "",
    endDate: "",
    status: ""
  });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [editImageError, setEditImageError] = useState<string | null>(null);

  // Mutation for updating project
  const updateProjectMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const originalImageUrl = project?.imageUrl ?? null;
      const shouldUpdateImage = Boolean(editImageFile || removeImage);
      let uploadedPath: string | null = null;
      let imageUrl = removeImage ? null : originalImageUrl;

      if (editImageFile) {
        const extension = getProjectImageExtension(editImageFile);
        if (!extension) throw new Error("Usa una imagen JPEG, PNG o WebP.");

        uploadedPath = `${id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("project-images")
          .upload(uploadedPath, editImageFile, { upsert: false, contentType: editImageFile.type });
        if (uploadError) throw uploadError;

        imageUrl = supabase.storage.from("project-images").getPublicUrl(uploadedPath).data.publicUrl;
      }

      try {
        await dbQuery("projects").updateSingle(
          shouldUpdateImage ? { ...data, imageUrl } : data,
          { id },
        );
      } catch (error) {
        if (uploadedPath) {
          const { error: cleanupError } = await supabase.storage.from("project-images").remove([uploadedPath]);
          if (cleanupError) console.error("[project-images] Limpieza pendiente", { projectId: id, path: uploadedPath, reason: cleanupError.message });
        }
        throw error;
      }

      const oldPath = getProjectImagePath(originalImageUrl, id);
      if (shouldUpdateImage && oldPath) {
        const { error: deleteError } = await supabase.storage.from("project-images").remove([oldPath]);
        if (deleteError) console.error("[project-images] No se pudo eliminar la imagen anterior", { projectId: id, path: oldPath, reason: deleteError.message });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsEditDialogOpen(false);
      setEditImageFile(null);
      setRemoveImage(false);
      setEditImageError(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      toast({
        title: "Proyecto actualizado",
        description: "Los datos del proyecto se han actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar",
        description: error.message || "No se pudo actualizar el proyecto.",
        variant: "destructive",
      });
    },
  });

  // Function to open edit dialog with current project data
  const handleEditProject = () => {
    if (projectData) {
      setEditFormData({
        name: projectData.name || "",
        client: projectData.client || "",
        color: getProjectColor(projectData.color),
        description: projectData.description || "",
        startDate: projectData.startDate ? new Date(projectData.startDate).toISOString().split('T')[0] : "",
        endDate: projectData.endDate ? new Date(projectData.endDate).toISOString().split('T')[0] : "",
        status: projectData.status || "planning"
      });
      setEditImageFile(null);
      setRemoveImage(false);
      setEditImageError(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setIsEditDialogOpen(true);
    }
  };

  // Function to handle form submission
  const handleSaveProject = () => {
    const selectedImageError = validateProjectImage(editImageFile);
    if (selectedImageError) {
      setEditImageError(selectedImageError);
      return;
    }

    // Convertir fechas a formato Date si existen
    const dataToSubmit = {
      ...editFormData,
      startDate: editFormData.startDate ? new Date(editFormData.startDate) : null,
      endDate: editFormData.endDate ? new Date(editFormData.endDate) : null,
    };
    updateProjectMutation.mutate({
      ...dataToSubmit,
      color: getProjectColor(editFormData.color),
    });
  };

  // Fetch project details with analysis
  const {
    data: project,
    isLoading,
    error,
    refetch
  } = useQuery<ProjectWithAnalysis>({
    queryKey: ["projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, analysis:analysis_results(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const result = fromDb<ProjectWithAnalysis>("projects", data);
      return result;
    },
    retry: 3,
    retryDelay: 1000,
  });

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40 hidden sm:flex" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="border-b overflow-x-auto pb-2">
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    console.error("Detailed project loading error:", error);
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-destructive/10 p-4 rounded-full mb-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-heading font-semibold text-foreground mb-3">No pudimos cargar este proyecto.</h2>
        <p className="text-muted-foreground mb-8 max-w-md">Vuelve a intentarlo o regresa a la cartera de proyectos.</p>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(backPath)}>
            Volver a Proyectos
          </Button>
          <Button variant="default" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // Handle no project found
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-muted p-4 rounded-full mb-6">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-heading font-semibold text-foreground mb-3">Este proyecto no está disponible.</h2>
        <p className="text-muted-foreground mb-8 max-w-md">Es posible que haya sido eliminado o que ya no tengas acceso.</p>
        <Button variant="default" onClick={() => navigate(backPath)}>
          Volver a Proyectos
        </Button>
      </div>
    );
  }

  // Asegurarse de que project tenga las propiedades necesarias
  const projectData = {
    id: project.id,
    name: project.name || 'Proyecto sin nombre',
    client: project.client || 'Cliente no definido',
    color: project.color ?? null,
    imageUrl: project.imageUrl ?? null,
    description: project.description || '',
    startDate: project.startDate,
    endDate: project.endDate,
    status: project.status || 'planning',
    createdBy: project.createdBy,
    analysis: Array.isArray(project.analysis) ? project.analysis[0] ?? null : project.analysis ?? null
  };

  const canEditProject = Boolean(
    user?.isPrimary || user?.role === "admin" || projectData.createdBy === user?.id
  );

  const handleEditImageChange = (file: File | null) => {
    setEditImageFile(file);
    setRemoveImage(false);
    setEditImageError(validateProjectImage(file));
  };

  const handleEditDialogChange = (open: boolean) => {
    if (open || updateProjectMutation.isPending) return;
    setIsEditDialogOpen(false);
    setEditImageFile(null);
    setRemoveImage(false);
    setEditImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  console.log('Project render data:', projectData);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed': return { label: 'Completado', className: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' };
      case 'in_progress':
      case 'active': return { label: 'Activo', className: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' };
      case 'planning': return { label: 'Planificación', className: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' };
      case 'paused':
      case 'on_hold': return { label: 'En Pausa', className: 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400' };
      case 'cancelled': return { label: 'Cancelado', className: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' };
      default: return { label: status, className: 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400' };
    }
  };

  const statusInfo = getStatusInfo(projectData.status);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
            className="shrink-0"
            aria-label="Volver a Proyectos"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ProjectIdentityAvatar
            name={projectData.name}
            color={projectData.color}
            imageUrl={projectData.imageUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground truncate">
              {projectData.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground font-sans">
              <span className="font-medium truncate text-foreground/80">{projectData.client}</span>
              <Badge variant="secondary" className={`font-medium border-transparent ${statusInfo.className}`}>
                {statusInfo.label}
              </Badge>
              {(projectData.startDate || projectData.endDate) && (
                <>
                  <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-border"></span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Calendar className="h-3.5 w-3.5 opacity-70" />
                    {projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('es-ES') : 'Inicio N/A'} 
                    {' - '}
                    {projectData.endDate ? new Date(projectData.endDate).toLocaleDateString('es-ES') : 'Sin límite'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-14 md:ml-0">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Calendario
          </Button>
          {canEditProject && (
            <Button
              variant="default"
              size="sm"
              onClick={handleEditProject}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar Proyecto
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ProjectTab)}
          className="space-y-4"
        >
          <div className="border-b overflow-x-auto scrollbar-hide">
            <TabsList className="bg-transparent h-auto p-0 inline-flex w-max min-w-full justify-start">
              <TabsTrigger
                value="analysis"
                className="rounded-none border-b-2 border-transparent px-4 py-3 shrink-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent shadow-none"
              >
                Estrategia
              </TabsTrigger>
              <TabsTrigger
                value="calendars"
                className="rounded-none border-b-2 border-transparent px-4 py-3 shrink-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent shadow-none"
              >
                Calendarios
              </TabsTrigger>
              <TabsTrigger
                value="products"
                className="rounded-none border-b-2 border-transparent px-4 py-3 shrink-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent shadow-none"
              >
                Productos
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="rounded-none border-b-2 border-transparent px-4 py-3 shrink-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent shadow-none"
              >
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="rounded-none border-b-2 border-transparent px-4 py-3 shrink-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent shadow-none"
              >
                Actividad
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analysis" className="mt-0 pt-4">
            <ProjectAnalysis
              project={projectData}
              canEdit={Boolean(
                user?.isPrimary || user?.role === "admin" || projectData.createdBy === user?.id
              )}
            />
          </TabsContent>

          <TabsContent value="calendars" className="mt-0 pt-4">
            <ProjectWorkflows projectId={projectData.id} />
          </TabsContent>

          <TabsContent value="products" className="mt-0 pt-4">
            <ProductList projectId={projectData.id} />
          </TabsContent>

          <TabsContent value="chat" className="mt-0 pt-4">
            <ProjectChat projectId={projectData.id} />
          </TabsContent>

          <TabsContent value="logs" className="mt-0 pt-4">
            <ProjectLogs projectId={projectData.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proyecto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Información General */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold border-b pb-2">Información General</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre del Proyecto</Label>
                  <Input
                    id="name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Nombre del proyecto"
                  />
                </div>
                <div>
                  <Label htmlFor="client">Cliente</Label>
                  <Input
                    id="client"
                    value={editFormData.client}
                    onChange={(e) => setEditFormData({ ...editFormData, client: e.target.value })}
                    placeholder="Nombre del cliente"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color de identidad</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`Seleccionar color ${option.label}`}
                      aria-pressed={editFormData.color === option.value}
                      className={`h-8 w-8 rounded-full border-2 ${editFormData.color === option.value ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: option.value }}
                      onClick={() => setEditFormData({ ...editFormData, color: option.value })}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="projectImage">Imagen de identidad</Label>
                <div className="flex items-center gap-3">
                  <ProjectIdentityAvatar
                    name={editFormData.name}
                    color={editFormData.color}
                    imageUrl={removeImage ? null : projectData.imageUrl}
                    size="md"
                  />
                  <Input
                    ref={imageInputRef}
                    id="projectImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => handleEditImageChange(event.target.files?.[0] ?? null)}
                  />
                </div>
                {projectData.imageUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditImageFile(null);
                      setRemoveImage(true);
                      setEditImageError(null);
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }}
                  >
                    Eliminar imagen
                  </Button>
                )}
                {editImageError && <p className="text-sm text-destructive">{editImageError}</p>}
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Descripción del proyecto"
                  rows={3}
                />
              </div>
            </div>

            {/* Periodo y Estado */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold border-b pb-2">Periodo y Estado</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Fecha de Finalización</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={editFormData.endDate}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Estado del Proyecto</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planificación</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="on_hold">En Pausa</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handleEditDialogChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProject}
              disabled={updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
