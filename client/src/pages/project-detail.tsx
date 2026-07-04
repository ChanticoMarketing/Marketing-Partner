import { useState } from "react";
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
import { Loader2, ArrowLeft, ArrowRight, Download, Pencil } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import ProjectAnalysis from "@/components/projects/project-analysis";
import ProjectWorkflows from "@/components/projects/project-workflows";
import ProjectDocuments from "@/components/projects/project-documents";
import ProjectChat from "@/components/projects/project-chat";
import ProductList from "@/components/products/product-list";


interface ProjectDetailProps {
  id: number;
}

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
  description?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  analysis?: ProjectAnalysis | null;
}

export default function ProjectDetail({ id }: ProjectDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("analysis");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    client: "",
    description: "",
    startDate: "",
    endDate: "",
    status: ""
  });

  // Mutation for updating project
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return dbQuery("projects").updateSingle(data, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsEditDialogOpen(false);
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
        description: projectData.description || "",
        startDate: projectData.startDate ? new Date(projectData.startDate).toISOString().split('T')[0] : "",
        endDate: projectData.endDate ? new Date(projectData.endDate).toISOString().split('T')[0] : "",
        status: projectData.status || "planning"
      });
      setIsEditDialogOpen(true);
    }
  };

  // Function to handle form submission
  const handleSaveProject = () => {
    // Convertir fechas a formato Date si existen
    const dataToSubmit = {
      ...editFormData,
      startDate: editFormData.startDate ? new Date(editFormData.startDate) : null,
      endDate: editFormData.endDate ? new Date(editFormData.endDate) : null,
    };
    updateProjectMutation.mutate(dataToSubmit);
  };

  // Fetch project details with analysis
  const {
    data: project,
    isLoading,
    error
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
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle error state
  if (error) {
    console.error("Detailed project loading error:", error);
    return (
      <div className="p-4 border rounded-md bg-red-50 text-red-700 my-4">
        <p>Error loading project: {(error as Error).message}</p>
        <Button variant="link" onClick={() => navigate("/projects")}>
          Return to Projects
        </Button>
      </div>
    );
  }

  // Handle no project found
  if (!project) {
    return (
      <div className="p-4 border rounded-md bg-amber-50 text-amber-700 my-4">
        <p>Project not found</p>
        <Button variant="link" onClick={() => navigate("/projects")}>
          Return to Projects
        </Button>
      </div>
    );
  }

  // Asegurarse de que project tenga las propiedades necesarias
  const projectData = {
    id: project.id,
    name: project.name || 'Proyecto sin nombre',
    client: project.client || 'Cliente no definido',
    description: project.description || '',
    startDate: project.startDate,
    endDate: project.endDate,
    status: project.status || 'planning',
    analysis: project.analysis || null
  };

  console.log('Project render data:', projectData);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">{projectData.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar Calendario
          </Button>
          {user?.isPrimary && (
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="border-b">
            <TabsList className="bg-transparent h-auto p-0">
              <TabsTrigger
                value="analysis"
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                Estrategia
              </TabsTrigger>
              <TabsTrigger
                value="calendars"
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                Calendarios
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                Centro de conocimiento
              </TabsTrigger>
              <TabsTrigger
                value="products"
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                Productos
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
              >
                Chat
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analysis" className="mt-0 pt-4">
            <ProjectAnalysis project={projectData} isPrimary={user?.isPrimary || false} />
          </TabsContent>

          <TabsContent value="calendars" className="mt-0 pt-4">
            <ProjectWorkflows projectId={projectData.id} />
          </TabsContent>

          <TabsContent value="documents" className="mt-0 pt-4">
            <ProjectDocuments
              projectId={projectData.id}
              projectName={projectData.name}
              canApprove={Boolean(
                user?.isPrimary ||
                user?.role === "admin" ||
                project.createdBy === user?.id
              )}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-0 pt-4">
            <ProductList projectId={projectData.id} />
          </TabsContent>

          <TabsContent value="chat" className="mt-0 pt-4">
            <ProjectChat projectId={projectData.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proyecto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Información Básica */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Información Básica</h3>
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

            {/* Fechas y Estado */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Fechas y Estado</h3>
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
                      <SelectItem value="planning">📋 Planificación</SelectItem>
                      <SelectItem value="active">🚀 Activo</SelectItem>
                      <SelectItem value="on_hold">⏸️ En Pausa</SelectItem>
                      <SelectItem value="completed">✅ Completado</SelectItem>
                      <SelectItem value="cancelled">❌ Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
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
