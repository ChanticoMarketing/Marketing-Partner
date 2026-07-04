import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import {
  CalendarIcon,
  Clock,
  PlusCircle,
  ListChecks,
  AlertCircle,
  Layout,
  BarChart4,
  Table,
  KanbanSquare,
  GanttChartSquare,
  Tag,
  ListFilter,
  Users,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  LayoutDashboard,
  Sparkles,
  Filter,
  MoreHorizontal,
  Trash2,
  Edit
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Importaciones para los componentes de Kanban
import { TaskForm } from '@/components/tasks/task-form';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { KanbanBoard } from '@/components/tasks/kanban-board';

// Definir el esquema de validación para crear/editar tareas
const taskSchema = z.object({
  title: z.string().min(3, {
    message: "El título debe tener al menos 3 caracteres",
  }),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent", "critical"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "blocked", "deferred"]).optional(),
  dueDate: z.date().optional().nullable(),
  projectId: z.number(),
  assignedToId: z.string().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

// Componente de Tareas
const TaskManager = () => {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'table'>('kanban');
  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'priority'>('status');
  const [draggedTask, setDraggedTask] = useState<any>(null);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Sincronización en tiempo real para tareas (solo si hay un proyecto seleccionado)
  useRealtimeSync({
    table: 'tasks',
    filter: selectedProject ? `project_id=eq.${selectedProject}` : undefined,
    queryKey: ['projects', selectedProject, 'tasks'],
    enabled: !!selectedProject
  });

  // Configuración de sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Consultar proyectos
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<any[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray("projects", data) || [];
    },
  });

  // Consultar tareas del proyecto seleccionado
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['projects', selectedProject, 'tasks'],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", selectedProject)
        .order("position", { ascending: true });
      if (error) throw error;
      return fromDbArray("tasks", data);
    },
    enabled: !!selectedProject,
  });

  // Crear nueva tarea
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      return dbQuery("tasks").insertSingle(data);
    },
    onSuccess: () => {
      toast({
        title: "Tarea creada",
        description: "La tarea ha sido creada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ['projects', selectedProject, 'tasks'] });
      setIsNewTaskDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error al crear la tarea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar tarea
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: any }) => {
      return dbQuery("tasks").updateSingle(updates, { id: taskId });
    },
    onSuccess: () => {
      toast({
        title: "Tarea actualizada",
        description: "La tarea ha sido actualizada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ['projects', selectedProject, 'tasks'] });
      setIsEditTaskDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar la tarea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Eliminar tarea
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await dbQuery("tasks").delete({ id: taskId });
    },
    onSuccess: () => {
      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ['projects', selectedProject, 'tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar la tarea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generar tareas con IA
  // TODO: migrar a Edge Function cuando exista generate-tasks
  const generateTasksMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/generate-tasks`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tareas generadas",
        description: `Se han generado ${data.length} tareas con IA`,
      });
      queryClient.invalidateQueries({ queryKey: ['projects', selectedProject, 'tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Error al generar tareas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Formulario para nueva tarea
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      projectId: selectedProject || undefined,
    },
  });

  // Formulario para editar tarea
  const editForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
      projectId: selectedProject || undefined,
    },
  });

  // Actualizar el proyecto seleccionado en el formulario cuando cambia
  React.useEffect(() => {
    if (selectedProject) {
      form.setValue('projectId', selectedProject);
    }
  }, [selectedProject, form]);

  // Preparar el formulario para editar una tarea
  const handleEditTask = (task: any) => {
    setSelectedTask(task);

    // Convertir la fecha a un objeto Date
    const dueDateObj = task.dueDate
      ? new Date(task.dueDate)
      : null;

    editForm.reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      dueDate: dueDateObj,
      projectId: task.projectId,
      assignedToId: task.assignedToId,
    });

    setIsEditTaskDialogOpen(true);
  };

  // Cambiar el estado de una tarea
  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({
      taskId: taskId,
      updates: { status: newStatus },
    });
  };

  // Obtener usuarios para asignar tareas
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, full_name, username, profile_image, role")
          .order("full_name", { ascending: true });
        if (error) throw error;
        return fromDbArray("users", data);
      } catch (error) {
        return [];
      }
    },
  });

  // Renderizar badge según prioridad
  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30">Urgente</Badge>;
      case 'high':
        return <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30">Media</Badge>;
      case 'low':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">Baja</Badge>;
      default:
        return <Badge variant="outline">No definida</Badge>;
    }
  };

  // Renderizar badge según estado
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-border text-muted-foreground">Pendiente</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 hover:bg-blue-500/30">En progreso</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">Completada</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-muted-foreground border-gray-500/30 hover:bg-gray-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">No definido</Badge>;
    }
  };

  // Filtrar tareas por estado
  const pendingTasks = tasks.filter((task: any) => task.status === 'pending');
  const inProgressTasks = tasks.filter((task: any) => task.status === 'in_progress');
  const completedTasks = tasks.filter((task: any) => task.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shadow-md">
          <ListChecks className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-primary">/</span> GESTOR DE TAREAS
          </h1>
          <p className="text-muted-foreground tracking-wide">
            Control de misiones y objetivos operativos
          </p>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-card border-border p-4 rounded-xl border border-border/50 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Select
              value={selectedProject?.toString() || ""}
              onValueChange={(value) => setSelectedProject(parseInt(value))}
            >
              <SelectTrigger className="w-full sm:w-[300px] bg-muted/50 border-border text-foreground">
                <SelectValue placeholder="Selecciona un proyecto" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-border text-foreground">
                {projects.map((project: any) => (
                  <SelectItem key={project.id} value={project.id.toString()} className="focus:bg-primary/20 focus:text-foreground">
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProject && (
              <CreateTaskDialog>
                <Button className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 uppercase tracking-wider font-bold w-full sm:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Tarea
                </Button>
              </CreateTaskDialog>
            )}

            <Button
              variant="outline"
              onClick={() => {
                if (selectedProject) {
                  generateTasksMutation.mutate(selectedProject);
                }
              }}
              disabled={!selectedProject || generateTasksMutation.isPending}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 w-full sm:w-auto"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generar con IA
            </Button>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveView('kanban')}
                      className={activeView === 'kanban' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}
                    >
                      <KanbanSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vista Kanban</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveView('list')}
                      className={activeView === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}
                    >
                      <ListChecks className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vista Lista</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveView('table')}
                      className={activeView === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}
                    >
                      <Table className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vista Tabla</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1 bg-muted/80" />

            <Select
              value={groupBy}
              onValueChange={(value: 'status' | 'assignee' | 'priority') => setGroupBy(value)}
            >
              <SelectTrigger className="w-[140px] bg-muted/50 border-border text-foreground">
                <div className="flex items-center">
                  <Filter className="h-3 w-3 mr-2 text-primary" />
                  <SelectValue placeholder="Agrupar por" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-border text-foreground">
                <SelectItem value="status" className="focus:bg-primary/20">Estado</SelectItem>
                <SelectItem value="assignee" className="focus:bg-primary/20">Asignado a</SelectItem>
                <SelectItem value="priority" className="focus:bg-primary/20">Prioridad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tasks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-border/50">
            <Badge variant="outline" className="px-3 py-1 border-border bg-muted text-muted-foreground">
              <Users className="h-3 w-3 mr-1 text-primary" />
              {users.filter(u => tasks.some((t: any) => t.assignedToId === u.id)).length} asignados
            </Badge>

            <Badge variant="outline" className="px-3 py-1 border-border bg-muted text-muted-foreground">
              <Clock className="h-3 w-3 mr-1 text-primary/80" />
              {tasks.filter((t: any) => t.dueDate).length} con fecha límite
            </Badge>

            <Badge variant="outline" className="px-3 py-1 border-blue-500/30 bg-blue-500/10 text-blue-400">
              <Sparkles className="h-3 w-3 mr-1" />
              {tasks.filter((t: any) => t.aiGenerated).length} generadas por IA
            </Badge>
          </div>
        )}
      </div>

      {!selectedProject ? (
        <div className="bg-card border-border rounded-xl p-12 text-center border border-border/50 flex flex-col items-center justify-center min-h-[400px]">
          <div className="bg-primary/10 p-6 rounded-full mb-6 animate-pulse">
            <LayoutDashboard className="h-16 w-16 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">Selecciona una Misión</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Elige un proyecto del panel de control para visualizar y gestionar sus objetivos tácticos.
          </p>
        </div>
      ) : isLoadingTasks ? (
        <div className="flex justify-center py-24">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* Vista Kanban */}
          {activeView === 'kanban' && (
            <div className="kanban-board h-[calc(100vh-300px)]">
              <KanbanBoard
                tasks={tasks}
                users={users}
                onEditTask={handleEditTask}
                onDeleteTask={(taskId: number) => {
                  if (confirm('¿Estás seguro de que deseas eliminar esta tarea?')) {
                    deleteTaskMutation.mutate(taskId);
                  }
                }}
                onTaskMove={(taskId: number, newStatus: string) => {
                  updateTaskMutation.mutate({
                    taskId,
                    updates: { status: newStatus }
                  });
                }}
                groupBy={groupBy}
              />
            </div>
          )}

          {/* Vista Lista */}
          {activeView === 'list' && (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="mb-6 bg-muted/30 border border-border p-1">
                <TabsTrigger value="pending" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">
                  Pendientes <Badge variant="outline" className="ml-2 border-border bg-muted">{pendingTasks.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="in-progress" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-muted-foreground">
                  En Progreso <Badge variant="outline" className="ml-2 border-border bg-muted">{inProgressTasks.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 text-muted-foreground">
                  Completadas <Badge variant="outline" className="ml-2 border-border bg-muted">{completedTasks.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {pendingTasks.length === 0 ? (
                  <div className="text-center p-12 border border-border/50 rounded-xl bg-muted/50">
                    <p className="text-muted-foreground">No hay tareas pendientes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingTasks.map((task: any) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={handleEditTask}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                        onStatusChange={handleStatusChange}
                        renderPriorityBadge={renderPriorityBadge}
                        renderStatusBadge={renderStatusBadge}
                        users={users}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="in-progress" className="space-y-4">
                {inProgressTasks.length === 0 ? (
                  <div className="text-center p-12 border border-border/50 rounded-xl bg-muted/50">
                    <p className="text-muted-foreground">No hay tareas en progreso</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inProgressTasks.map((task: any) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={handleEditTask}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                        onStatusChange={handleStatusChange}
                        renderPriorityBadge={renderPriorityBadge}
                        renderStatusBadge={renderStatusBadge}
                        users={users}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedTasks.length === 0 ? (
                  <div className="text-center p-12 border border-border/50 rounded-xl bg-muted/50">
                    <p className="text-muted-foreground">No hay tareas completadas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedTasks.map((task: any) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={handleEditTask}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                        onStatusChange={handleStatusChange}
                        renderPriorityBadge={renderPriorityBadge}
                        renderStatusBadge={renderStatusBadge}
                        users={users}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Vista Tabla */}
          {activeView === 'table' && (
            <div className="bg-card border-border rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">#</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">Título</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">Estado</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">Prioridad</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">Asignado a</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">Fecha límite</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground uppercase tracking-wider text-xs">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No hay tareas disponibles
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task: any, index: number) => {
                        const assignedUser = users.find(user => user.id === task.assignedToId);
                        return (
                          <tr key={task.id} className="border-b border-border/50 hover:bg-muted transition-colors">
                            <td className="p-4 align-middle text-muted-foreground">{index + 1}</td>
                            <td className="p-4 align-middle font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {task.title}
                                {task.aiGenerated && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Sparkles className="h-3 w-3 text-blue-400" />
                                      </TooltipTrigger>
                                      <TooltipContent>Generada por IA</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </td>
                            <td className="p-4 align-middle">{renderStatusBadge(task.status)}</td>
                            <td className="p-4 align-middle">{renderPriorityBadge(task.priority)}</td>
                            <td className="p-4 align-middle">
                              {assignedUser ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6 border border-border">
                                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{assignedUser.fullName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-muted-foreground">{assignedUser.fullName}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">No asignado</span>
                              )}
                            </td>
                            <td className="p-4 align-middle">
                              {task.dueDate ? (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <CalendarIcon className="h-3 w-3 mr-2 text-primary" />
                                  {format(new Date(task.dueDate), "d 'de' MMM, yyyy", { locale: es })}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Sin fecha</span>
                              )}
                            </td>
                            <td className="p-4 align-middle">
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleEditTask(task)} className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500 text-muted-foreground"
                                  onClick={() => deleteTaskMutation.mutate(task.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diálogo para crear nueva tarea */}
      <Dialog open={isNewTaskDialogOpen} onOpenChange={setIsNewTaskDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-card border-border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Crear Nueva Tarea</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crea una nueva tarea para el proyecto seleccionado
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createTaskMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título de la tarea" {...field} className="bg-muted/30 border-border text-foreground placeholder:text-gray-600" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción detallada de la tarea"
                        className="min-h-[100px] bg-muted/30 border-border text-foreground placeholder:text-gray-600"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Prioridad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/30 border-border text-foreground">
                            <SelectValue placeholder="Selecciona prioridad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-black/90 border-border text-foreground">
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-muted-foreground">Fecha límite</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full text-left font-normal bg-muted/30 border-border text-foreground hover:bg-muted hover:text-foreground ${!field.value && "text-muted-foreground"
                                }`}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: es })
                              ) : (
                                <span>Sin fecha límite</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-black/90 border-border text-foreground" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                            className="bg-black/90 text-foreground"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Asignar a</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-muted/30 border-border text-foreground">
                          <SelectValue placeholder="Asignar a un usuario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-black/90 border-border text-foreground">
                        {users.map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewTaskDialogOpen(false)}
                  className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  {createTaskMutation.isPending && (
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-black rounded-full"></div>
                  )}
                  Crear Tarea
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar tarea */}
      <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-card border-border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Tarea</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modifica los detalles de la tarea seleccionada
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateTaskMutation.mutate({ taskId: selectedTask.id, updates: data }))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título de la tarea" {...field} className="bg-muted/30 border-border text-foreground placeholder:text-gray-600" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción detallada de la tarea"
                        className="min-h-[100px] bg-muted/30 border-border text-foreground placeholder:text-gray-600"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Prioridad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/30 border-border text-foreground">
                            <SelectValue placeholder="Selecciona prioridad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-black/90 border-border text-foreground">
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-muted-foreground">Fecha límite</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full text-left font-normal bg-muted/30 border-border text-foreground hover:bg-muted hover:text-foreground ${!field.value && "text-muted-foreground"
                                }`}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: es })
                              ) : (
                                <span>Sin fecha límite</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-black/90 border-border text-foreground" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                            className="bg-black/90 text-foreground"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Estado</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/30 border-border text-foreground">
                            <SelectValue placeholder="Selecciona estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-black/90 border-border text-foreground">
                          <SelectItem value="pending">Pendiente</SelectItem>
                          <SelectItem value="in_progress">En progreso</SelectItem>
                          <SelectItem value="completed">Completada</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Asignar a</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/30 border-border text-foreground">
                            <SelectValue placeholder="Asignar a un usuario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-black/90 border-border text-foreground">
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditTaskDialogOpen(false)}
                  className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateTaskMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  {updateTaskMutation.isPending && (
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-black rounded-full"></div>
                  )}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente de Tarjeta de Tarea
interface TaskCardProps {
  task: any;
  onEdit: (task: any) => void;
  onDelete: () => void;
  onStatusChange: (taskId: number, newStatus: string) => void;
  renderPriorityBadge: (priority: string) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
  users: any[];
}

const TaskCard = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  renderPriorityBadge,
  renderStatusBadge,
  users
}: TaskCardProps) => {
  const assignedUser = users.find(user => user.id === task.assignedToId);

  return (
    <Card className={`bg-card border-border border-border/50 hover:border-primary/30 transition-all duration-300 group ${task.aiGenerated ? 'shadow-[0_0_15px_rgba(59,130,246,0.1)]' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex gap-2 flex-wrap">
            {renderPriorityBadge(task.priority)}
            {renderStatusBadge(task.status)}
          </div>
          {task.aiGenerated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="text-xs font-medium text-blue-400 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
                    <Sparkles className="h-3 w-3" />
                    <span className="hidden sm:inline">IA</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Tarea generada por Inteligencia Artificial</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <CardTitle className="text-lg text-foreground mt-3 leading-tight">{task.title}</CardTitle>
        {task.dueDate && (
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <CalendarIcon className="h-3 w-3 mr-1 text-primary/70" />
            {format(new Date(task.dueDate), "d 'de' MMMM, yyyy", { locale: es })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {task.description || "Sin descripción"}
        </p>

        {assignedUser && (
          <div className="mt-4 flex items-center pt-3 border-t border-border/50">
            <Avatar className="h-6 w-6 border border-border">
              <AvatarFallback className="bg-primary/20 text-primary text-xs">{assignedUser.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs ml-2 text-muted-foreground">{assignedUser.fullName}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between pt-0 pb-4">
        <div className="w-[140px]">
          <Select
            defaultValue={task.status}
            onValueChange={(value) => onStatusChange(task.id, value)}
          >
            <SelectTrigger className="h-8 text-xs border-border bg-muted/50 text-muted-foreground">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-border text-foreground">
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={() => onEdit(task)} className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary text-muted-foreground">
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500 text-muted-foreground" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default TaskManager;
