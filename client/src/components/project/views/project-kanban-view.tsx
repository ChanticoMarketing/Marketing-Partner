import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { Task, taskStatusEnum, taskPriorityEnum } from "@shared/schema";
import { Loader2, Plus, MoreHorizontal, Edit, Check, Clock, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useToast } from "@/hooks/use-toast";

interface ProjectKanbanViewProps {
  projectId: number;
  viewId: number;
}

// Componente para una tarjeta de tarea individual con soporte para arrastrar y soltar
const SortableTaskCard = ({ 
  task, 
  onEdit, 
  onDelete,
  onTrackTime
}: { 
  task: Task, 
  onEdit: (task: Task) => void, 
  onDelete: (taskId: number) => void,
  onTrackTime: (taskId: number) => void 
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
    }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onTrackTime={onTrackTime} />
    </div>
  );
};

// Componente para una tarjeta de tarea individual
function TaskCard({ 
  task, 
  onEdit, 
  onDelete, 
  onTrackTime 
}: { 
  task: Task, 
  onEdit: (task: Task) => void, 
  onDelete: (taskId: number) => void,
  onTrackTime: (taskId: number) => void 
}) {
  // Función para obtener el color de la etiqueta de prioridad
  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "low":
        return "outline";
      case "medium":
        return "secondary";
      case "high":
        return "default";
      case "urgent":
        return "destructive";
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Traducción de prioridades para mostrar en español
  const translatePriority = (priority: string) => {
    const priorityTranslations: Record<string, string> = {
      low: "Baja",
      medium: "Media",
      high: "Alta",
      urgent: "Urgente",
      critical: "Crítica",
    };
    return priorityTranslations[priority] || priority;
  };

  // Determinar si hay una persona asignada
  const hasAssignee = !!task.assignedToId;
  
  // Determinar si la tarea tiene dependencias
  const hasDependencies = task.dependencies && task.dependencies.length > 0;

  return (
    <Card className="mb-2 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-3 pb-0">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">
            {task.title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                Asignar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTrackTime(task.id)}>
                <Clock className="h-4 w-4 mr-2" />
                Registrar tiempo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(task.id)} 
                className="text-destructive">
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Indicador de dependencias */}
        {hasDependencies && (
          <div className="mt-1 flex items-center">
            <div className="text-xs text-primary font-medium flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              Tiene dependencias
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description || "Sin descripción"}
        </p>
      </CardContent>
      
      <CardFooter className="p-3 pt-1 flex flex-col gap-2">
        <div className="flex justify-between items-center w-full">
          <Badge variant={getPriorityBadgeVariant(task.priority) as any} className="text-xs">
            {translatePriority(task.priority)}
          </Badge>
          
          {hasAssignee && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {task.assignedToId?.toString().substring(0, 2) || "?"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        
        {task.dueDate && (
          <div className="flex items-center w-full text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(task.dueDate).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
            })}
            
            {task.estimatedHours && (
              <div className="ml-2 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {task.estimatedHours}h
              </div>
            )}
          </div>
        )}
        
        {/* Mostrar progreso si existe */}
        {typeof task.progress === 'number' && task.progress > 0 && (
          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
            <div 
              className="bg-primary h-1.5 rounded-full" 
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

// Importamos el componente de seguimiento de tiempo
import TimeTrackingDialog from "../time-tracking-dialog";

export default function ProjectKanbanView({ projectId, viewId }: ProjectKanbanViewProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const [taskIdForTimeTracking, setTaskIdForTimeTracking] = useState<number | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);

  // Sincronización en tiempo real para tareas
  useRealtimeSync({
    table: 'tasks',
    filter: `project_id=eq.${projectId}`,
    queryKey: ["projects", projectId, "tasks"]
  });

  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Distancia mínima para activar el arrastre
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Obtener tareas del proyecto
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true });
      if (error) throw error;
      return fromDbArray<Task>("tasks", data);
    },
  });
  
  // Obtener usuarios para asignar tareas
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, username, profile_image, role")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return fromDbArray("users", data);
    },
  });

  // Actualizar tarea (cambio de estado)
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: Partial<Task> }) => {
      return dbQuery("tasks").updateSingle(data, { id: taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      toast({
        title: "Tarea actualizada",
        description: "La tarea ha sido actualizada exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar tarea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Eliminar tarea
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await dbQuery("tasks").delete({ id: taskId });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar tarea",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Crear nueva tarea
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      return dbQuery("tasks").insertSingle({ ...taskData, projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      toast({
        title: "Tarea creada",
        description: "La tarea ha sido creada exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear tarea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Eventos de arrastrar y soltar
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
    // Si es una tarea, obtener sus datos para el overlay
    if (event.active.id.toString().startsWith('task-')) {
      const taskId = parseInt(event.active.id.toString().split('-')[1]);
      const task = tasks?.find(t => t.id === taskId);
      if (task) {
        setActiveTask(task);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveTask(null);
    
    if (!active || !over) return;
    
    // Si arrastras una tarea sobre una columna de estado
    if (active.id.toString().startsWith('task-') && !over.id.toString().startsWith('task-')) {
      const taskId = parseInt(active.id.toString().split('-')[1]);
      const newStatus = over.id.toString();
      
      if (isValidStatus(newStatus)) {
        updateTaskMutation.mutate({ taskId, data: { status: newStatus } });
      }
    }
  };

  const isValidStatus = (status: string): status is typeof taskStatusEnum.enumValues[number] => {
    return Object.values(taskStatusEnum.enumValues).includes(status as any);
  };

  // Filtrar tareas según búsqueda
  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    
    if (!searchTerm) return tasks;
    
    const term = searchTerm.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(term) ||
        (task.description && task.description.toLowerCase().includes(term))
    );
  }, [tasks, searchTerm]);

  // Agrupar tareas por estado
  const tasksByStatus = React.useMemo(() => {
    const result: Record<string, Task[]> = {};
    
    if (!filteredTasks) return result;
    
    // Inicializar todos los estados con arrays vacíos
    Object.values(taskStatusEnum.enumValues).forEach(status => {
      result[status] = [];
    });
    
    // Agrupar tareas por estado
    filteredTasks.forEach(task => {
      if (result[task.status]) {
        result[task.status].push(task);
      }
    });
    
    return result;
  }, [filteredTasks]);

  // Traducción de estados para mostrar en español
  const translateStatus = (status: string) => {
    const statusTranslations: Record<string, string> = {
      pending: "Pendiente",
      in_progress: "En progreso",
      review: "En revisión",
      completed: "Completada",
      cancelled: "Cancelada",
      blocked: "Bloqueada",
      deferred: "Aplazada",
    };
    return statusTranslations[status] || status;
  };

  // Funciones para manejar acciones de tareas
  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsEditDialogOpen(true);
  };

  const handleDeleteTask = (taskId: number) => {
    setTaskToDelete(taskId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete);
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Columnas a mostrar (excluimos 'cancelled')
  const columns = Object.values(taskStatusEnum.enumValues).filter(
    status => status !== 'cancelled'
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar tareas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full sm:w-[300px]"
          />
        </div>

        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {
            setNewTaskStatus(null);
            setIsCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva tarea
        </Button>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {columns.map(status => {
            const { setNodeRef } = useDroppable({
              id: status,
            });
            
            return (
              <div 
                key={status} 
                ref={setNodeRef}
                className="bg-muted/40 rounded-lg p-3 min-h-[300px]"
              >
                <div className="font-medium mb-3 sticky top-0 bg-muted/40 p-2 rounded flex justify-between items-center">
                  <h3>{translateStatus(status)}</h3>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full">
                    {tasksByStatus[status]?.length || 0}
                  </span>
                </div>
                
                <SortableContext 
                  items={tasksByStatus[status]?.map(task => `task-${task.id}`) || []}
                  strategy={verticalListSortingStrategy}
                >
                  {tasksByStatus[status]?.map(task => (
                    <SortableTaskCard 
                      key={task.id} 
                      task={task} 
                      onEdit={handleEditTask} 
                      onDelete={handleDeleteTask}
                      onTrackTime={(taskId) => {
                        setTaskIdForTimeTracking(taskId);
                        setIsTimeTrackingOpen(true);
                      }}
                    />
                  ))}
                </SortableContext>
                
                {tasksByStatus[status]?.length === 0 && (
                  <div className="text-center p-4 text-sm text-muted-foreground">
                    No hay tareas
                  </div>
                )}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => {
                    setNewTaskStatus(status);
                    setIsCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Agregar tarea
                </Button>
              </div>
            );
          })}
          
          <DragOverlay>
            {activeTask && (
              <TaskCard 
                task={activeTask} 
                onEdit={handleEditTask} 
                onDelete={handleDeleteTask}
                onTrackTime={(taskId) => {
                  setTaskIdForTimeTracking(taskId);
                  setIsTimeTrackingOpen(true);
                }}
              />
            )}
          </DragOverlay>
        </div>
      </DndContext>
      
      {/* Diálogo de edición de tarea */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar tarea</DialogTitle>
          </DialogHeader>
          
          {taskToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="title" className="text-right text-sm font-medium">
                  Título
                </label>
                <Input
                  id="title"
                  defaultValue={taskToEdit.title}
                  className="col-span-3"
                  onChange={(e) => setTaskToEdit({ ...taskToEdit, title: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="description" className="text-right text-sm font-medium">
                  Descripción
                </label>
                <Input
                  id="description"
                  defaultValue={taskToEdit.description || ""}
                  className="col-span-3"
                  onChange={(e) => setTaskToEdit({ ...taskToEdit, description: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="priority" className="text-right text-sm font-medium">
                  Prioridad
                </label>
                <select
                  id="priority"
                  defaultValue={taskToEdit.priority}
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  onChange={(e) => setTaskToEdit({ ...taskToEdit, priority: e.target.value as any })}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="dueDate" className="text-right text-sm font-medium">
                  Fecha límite
                </label>
                <Input
                  id="dueDate"
                  type="date"
                  defaultValue={taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : ""}
                  className="col-span-3"
                  onChange={(e) => setTaskToEdit({ 
                    ...taskToEdit, 
                    dueDate: e.target.value ? new Date(e.target.value) : null 
                  })}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="progress" className="text-right text-sm font-medium">
                  Progreso
                </label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="progress"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={taskToEdit.progress || 0}
                    className="w-20"
                    onChange={(e) => setTaskToEdit({ 
                      ...taskToEdit, 
                      progress: parseInt(e.target.value) 
                    })}
                  />
                  <span>%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="estimatedHours" className="text-right text-sm font-medium">
                  Horas estimadas
                </label>
                <Input
                  id="estimatedHours"
                  type="number"
                  min="0"
                  defaultValue={taskToEdit.estimatedHours || ""}
                  className="col-span-3"
                  onChange={(e) => setTaskToEdit({ 
                    ...taskToEdit, 
                    estimatedHours: e.target.value ? parseInt(e.target.value) : null 
                  })}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="dependencies" className="text-right text-sm font-medium">
                  Depende de
                </label>
                <div className="col-span-3">
                  <select
                    id="dependencies"
                    multiple
                    className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={taskToEdit?.dependencies?.map(String) || []}
                    onChange={(e) => {
                      const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value));
                      setTaskToEdit({
                        ...taskToEdit!,
                        dependencies: selectedOptions.map(String)
                      });
                    }}
                  >
                    {tasks?.filter(t => t.id !== taskToEdit?.id).map(task => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecciona múltiples tareas manteniendo presionado Ctrl o Cmd
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (taskToEdit) {
                updateTaskMutation.mutate({ 
                  taskId: taskToEdit.id, 
                  data: {
                    title: taskToEdit.title,
                    description: taskToEdit.description,
                    priority: taskToEdit.priority,
                    dueDate: taskToEdit.dueDate,
                    progress: taskToEdit.progress,
                    estimatedHours: taskToEdit.estimatedHours,
                    dependencies: taskToEdit.dependencies || []
                  }
                });
                setIsEditDialogOpen(false);
              }
            }}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para crear nueva tarea */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crear nueva tarea</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-title" className="text-right text-sm font-medium">
                Título
              </label>
              <Input
                id="new-title"
                placeholder="Título de la tarea"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-description" className="text-right text-sm font-medium">
                Descripción
              </label>
              <Input
                id="new-description"
                placeholder="Descripción detallada de la tarea"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-priority" className="text-right text-sm font-medium">
                Prioridad
              </label>
              <select
                id="new-priority"
                defaultValue="medium"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-status" className="text-right text-sm font-medium">
                Estado
              </label>
              <select
                id="new-status"
                defaultValue={newTaskStatus || "pending"}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En progreso</option>
                <option value="review">En revisión</option>
                <option value="completed">Completada</option>
                <option value="blocked">Bloqueada</option>
                <option value="deferred">Aplazada</option>
              </select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-dueDate" className="text-right text-sm font-medium">
                Fecha límite
              </label>
              <Input
                id="new-dueDate"
                type="date"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-estimatedHours" className="text-right text-sm font-medium">
                Horas estimadas
              </label>
              <Input
                id="new-estimatedHours"
                type="number"
                min="0"
                placeholder="0"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="new-assignee" className="text-right text-sm font-medium">
                Asignar a
              </label>
              <select
                id="new-assignee"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="0">Sin asignar</option>
                {users.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              const titleInput = document.getElementById('new-title') as HTMLInputElement;
              const descriptionInput = document.getElementById('new-description') as HTMLInputElement;
              const priorityInput = document.getElementById('new-priority') as HTMLSelectElement;
              const statusInput = document.getElementById('new-status') as HTMLSelectElement;
              const dueDateInput = document.getElementById('new-dueDate') as HTMLInputElement;
              const estimatedHoursInput = document.getElementById('new-estimatedHours') as HTMLInputElement;
              const assigneeInput = document.getElementById('new-assignee') as HTMLSelectElement;
              
              if (!titleInput.value) {
                toast({
                  title: "Error",
                  description: "El título es obligatorio",
                  variant: "destructive",
                });
                return;
              }
              
              createTaskMutation.mutate({
                title: titleInput.value,
                description: descriptionInput.value || null,
                priority: priorityInput.value as any,
                status: statusInput.value as any,
                dueDate: dueDateInput.value ? new Date(dueDateInput.value) : null,
                estimatedHours: estimatedHoursInput.value ? parseInt(estimatedHoursInput.value) : null,
                assignedToId: assigneeInput.value !== "0" ? assigneeInput.value : null,
                projectId: projectId
              });
              
              setIsCreateDialogOpen(false);
            }}>
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmación para eliminar tarea */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar tarea</DialogTitle>
          </DialogHeader>
          <p>¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteTask}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de seguimiento de tiempo */}
      {taskIdForTimeTracking && (
        <TimeTrackingDialog
          isOpen={isTimeTrackingOpen}
          onClose={() => {
            setIsTimeTrackingOpen(false);
            setTaskIdForTimeTracking(null);
          }}
          taskId={taskIdForTimeTracking}
          projectId={projectId}
        />
      )}
    </div>
  );
}