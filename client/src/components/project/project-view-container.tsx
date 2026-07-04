import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useToast } from "@/hooks/use-toast";
import { ProjectView, viewTypeEnum } from "@shared/schema";
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProjectListView from "./views/project-list-view";
import ProjectKanbanView from "./views/project-kanban-view";
import ProjectGanttView from "./views/project-gantt-view";
import ProjectCalendarView from "./views/project-calendar-view";
import ProjectBoardView from "./views/project-board-view";

interface ProjectViewContainerProps {
  projectId?: number;
}

type ViewType = (typeof viewTypeEnum.enumValues)[number];

type ViewFormData = {
  name: string;
  type: ViewType;
  isDefault: boolean;
  config: Record<string, unknown>;
};

export default function ProjectViewContainer({ projectId: propProjectId }: ProjectViewContainerProps) {
  const params = useParams<{ projectId: string }>();
  const urlProjectId = params.projectId;
  const [, navigate] = useLocation();
  
  // Usar el ID del proyecto de los props o de los parámetros de URL
  const projectId = propProjectId?.toString() || urlProjectId;
  const { toast } = useToast();
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [isEditingView, setIsEditingView] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ViewFormData>({
    name: "",
    type: "list",
    isDefault: false,
    config: {},
  });

  // Obtener vistas del proyecto
  const { data: views, isLoading } = useQuery({
    queryKey: ["projects", projectId, "views"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_views")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray<ProjectView>("project_views", data);
    },
  });

  // Obtener la vista activa o predeterminada
  const activeView = React.useMemo(() => {
    if (!views || views.length === 0) return null;
    
    // Si hay una vista seleccionada, usar esa
    if (selectedViewId) {
      const found = views.find(v => v.id === selectedViewId);
      if (found) return found;
    }
    
    // De lo contrario, buscar la vista predeterminada
    const defaultView = views.find(v => v.isDefault);
    if (defaultView) return defaultView;
    
    // Si no hay vista predeterminada, usar la primera
    return views[0];
  }, [views, selectedViewId]);

  // Crear una nueva vista
  const createViewMutation = useMutation({
    mutationFn: async (view: ViewFormData) => {
      return dbQuery("project_views").insertSingle({
        projectId: parseInt(projectId!),
        name: view.name,
        type: view.type,
        isDefault: view.isDefault,
        config: view.config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "views"] });
      toast({
        title: "Vista creada",
        description: "La vista ha sido creada exitosamente.",
      });
      setIsCreatingView(false);
      setFormData({
        name: "",
        type: "list",
        isDefault: false,
        config: {},
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear vista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar una vista existente
  const updateViewMutation = useMutation({
    mutationFn: async (viewData: { id: number; data: Partial<ProjectView> }) => {
      return dbQuery("project_views").updateSingle(viewData.data, { id: viewData.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "views"] });
      toast({
        title: "Vista actualizada",
        description: "La vista ha sido actualizada exitosamente.",
      });
      setIsEditingView(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar vista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Eliminar una vista
  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: number) => {
      await dbQuery("project_views").delete({ id: viewId });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "views"] });
      toast({
        title: "Vista eliminada",
        description: "La vista ha sido eliminada exitosamente.",
      });
      setSelectedViewId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar vista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateView = () => {
    if (!formData.name) {
      toast({
        title: "Nombre requerido",
        description: "Por favor ingrese un nombre para la vista.",
        variant: "destructive",
      });
      return;
    }

    createViewMutation.mutate({
      name: formData.name,
      type: formData.type,
      isDefault: formData.isDefault,
      config: formData.config,
    });
  };

  const handleUpdateView = () => {
    if (!selectedViewId || !formData.name) return;

    updateViewMutation.mutate({
      id: selectedViewId,
      data: {
        name: formData.name,
        type: formData.type,
        isDefault: formData.isDefault,
        config: formData.config,
      },
    });
  };

  const handleDeleteView = (viewId: number) => {
    if (views && views.length <= 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe existir al menos una vista en el proyecto.",
        variant: "destructive",
      });
      return;
    }

    deleteViewMutation.mutate(viewId);
  };

  const handleEditView = (view: ProjectView) => {
    setSelectedViewId(view.id);
    setFormData({
      name: view.name,
      type: view.type,
      isDefault: view.isDefault,
      config: view.config,
    });
    setIsEditingView(true);
  };

  const handleSelectView = (viewId: number) => {
    setSelectedViewId(viewId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 items-center">
          {views && views.length > 0 ? (
            <Select
              value={activeView?.id.toString()}
              onValueChange={(value) => handleSelectView(parseInt(value))}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Seleccionar vista" />
              </SelectTrigger>
              <SelectContent>
                {views.map((view) => (
                  <SelectItem key={view.id} value={view.id.toString()}>
                    {view.name} {view.isDefault && "(Predeterminada)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground">No hay vistas definidas</span>
          )}

          {activeView && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => handleEditView(activeView)}
                >
                  Editar vista
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => handleDeleteView(activeView.id)}
                >
                  Eliminar vista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Dialog open={isCreatingView} onOpenChange={setIsCreatingView}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nueva vista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nueva vista</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la vista"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de vista</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de vista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">Lista</SelectItem>
                    <SelectItem value="kanban">Kanban</SelectItem>
                    <SelectItem value="gantt">Gantt</SelectItem>
                    <SelectItem value="calendar">Calendario</SelectItem>
                    <SelectItem value="board">Tablero Monday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isDefault">Establecer como vista predeterminada</Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleCreateView}
                disabled={createViewMutation.isPending}
              >
                {createViewMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditingView} onOpenChange={setIsEditingView}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar vista</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la vista"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Tipo de vista</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de vista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">Lista</SelectItem>
                    <SelectItem value="kanban">Kanban</SelectItem>
                    <SelectItem value="gantt">Gantt</SelectItem>
                    <SelectItem value="calendar">Calendario</SelectItem>
                    <SelectItem value="board">Tablero Monday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="edit-isDefault">Establecer como vista predeterminada</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditingView(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateView}
                disabled={updateViewMutation.isPending}
              >
                {updateViewMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Actualizar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeView ? (
        <div className="border border-border rounded-lg bg-background">
          {activeView.type === "list" && <ProjectListView projectId={parseInt(projectId!)} viewId={activeView.id} />}
          {activeView.type === "kanban" && <ProjectKanbanView projectId={parseInt(projectId!)} viewId={activeView.id} />}
          {activeView.type === "gantt" && <ProjectGanttView projectId={parseInt(projectId!)} viewId={activeView.id} />}
          {activeView.type === "calendar" && <ProjectCalendarView projectId={parseInt(projectId!)} viewId={activeView.id} />}
          {activeView.type === "board" && <ProjectBoardView projectId={parseInt(projectId!)} viewId={activeView.id} />}
        </div>
      ) : (
        <div className="border border-border rounded-lg p-8 text-center bg-card">
          <p className="text-muted-foreground mb-4">No hay vistas disponibles. Crea una nueva vista para comenzar.</p>
          <Button onClick={() => setIsCreatingView(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Crear vista
          </Button>
        </div>
      )}
    </div>
  );
}
