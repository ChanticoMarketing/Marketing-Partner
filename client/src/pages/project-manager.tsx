import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  FolderPlus,
  Rocket
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Interfaces para el sistema Monday.com
interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled' | 'blocked' | 'deferred';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  dueDate?: string;
  tags: string[];
  projectId: number;
  groupId?: number;
  createdById: number;
  createdAt: string;
}

interface TaskGroup {
  id: number;
  name: string;
  projectId: number;
  position: number;
  color?: string;
  tasks: Task[];
}

interface Project {
  id: number;
  name: string;
  client: string;
  status: string;
}

interface TaskWithDetails {
  task: Task;
  group?: TaskGroup;
  project: Project;
  assignee?: {
    id: number;
    fullName: string;
    username: string;
    profileImage?: string;
  };
}

const statusColors = {
  pending: 'bg-gray-500/10 text-muted-foreground border-gray-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  review: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  blocked: 'bg-red-500/10 text-red-400 border-red-500/20',
  deferred: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
};

const priorityColors = {
  low: 'bg-gray-500/10 text-muted-foreground border-gray-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  high: 'bg-primary/10 text-primary/80 border-primary/20',
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20'
};

export default function ProjectManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener tareas agrupadas
  const { data: tasksData = [], isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ['/api/tasks-with-groups'],
    queryFn: async () => {
      const response = await fetch('/api/tasks-with-groups', {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al obtener tareas: ${errorText}`);
      }
      return response.json();
    },
    retry: 1,
    staleTime: 30000, // 30 seconds
  });

  // Consulta para obtener todos los proyectos
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Crear nueva tarea
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (!response.ok) throw new Error('Error al crear tarea');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks-with-groups'] });
      toast({ title: 'Tarea creada exitosamente' });
    },
  });

  // Actualizar tarea
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: number }) => {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Error al actualizar tarea');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks-with-groups'] });
      toast({ title: 'Tarea actualizada exitosamente' });
    },
  });

  // Extraer todas las tareas de los grupos con validaciones
  const allTasks = tasksData?.flatMap((group: any) =>
    group?.tasks?.map((task: any) => ({
      task,
      group: group.group,
      project: {
        id: task.projectId,
        name: projects?.find((p: any) => p.id === task.projectId)?.name || 'Proyecto',
        client: projects?.find((p: any) => p.id === task.projectId)?.client || 'Cliente'
      },
      assignee: task.assignee
    })) || []
  ) || [];

  // Filtrar tareas
  const filteredTasks = allTasks.filter((item: any) => {
    const matchesSearch = item.task?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.project?.client?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.task?.status === filterStatus;
    const matchesProject = filterProject === 'all' || item.task?.projectId?.toString() === filterProject;

    return matchesSearch && matchesStatus && matchesProject;
  });

  // Agrupar tareas por proyecto
  const tasksByProject = filteredTasks.reduce((acc: any, item: any) => {
    const projectId = item.task?.projectId;
    if (!acc[projectId]) {
      acc[projectId] = {
        project: item.project,
        tasks: []
      };
    }
    acc[projectId].tasks.push(item);
    return acc;
  }, {});

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'blocked': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (isLoading || !tasksData || !projects) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <Rocket className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-primary">/</span> GESTOR DE PROYECTOS
          </h1>
          <p className="text-muted-foreground tracking-wide mt-1">
            Centro de control de tareas y operaciones
          </p>
        </div>
        <div className="flex gap-2 bg-muted/30 p-1 rounded-lg border border-border">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}
            size="sm"
          >
            Tabla
          </Button>
          <Button
            variant={viewMode === 'board' ? 'default' : 'ghost'}
            onClick={() => setViewMode('board')}
            className={viewMode === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}
            size="sm"
          >
            Tablero
          </Button>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-card border-border border-border p-6 rounded-xl">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4" />
              <Input
                placeholder="Buscar tareas, proyectos o clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-muted/30 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
              />
            </div>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px] bg-muted/30 border-border text-foreground">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-border text-foreground">
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="review">Revisión</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px] bg-muted/30 border-border text-foreground">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-border text-foreground">
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {projects.map((project: Project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border-border p-4 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FolderPlus className="w-16 h-16 text-primary" />
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total de Tareas</p>
            <p className="text-3xl font-bold text-foreground mt-1">{allTasks.length}</p>
          </div>
        </div>

        <div className="bg-card border-border p-4 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-16 h-16 text-blue-500" />
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">En Progreso</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">
              {allTasks.filter((t: any) => t.task?.status === 'in_progress').length}
            </p>
          </div>
        </div>

        <div className="bg-card border-border p-4 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Completadas</p>
            <p className="text-3xl font-bold text-green-400 mt-1">
              {allTasks.filter((t: any) => t.task?.status === 'completed').length}
            </p>
          </div>
        </div>

        <div className="bg-card border-border p-4 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-purple-500" />
          </div>
          <div className="relative z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Proyectos Activos</p>
            <p className="text-3xl font-bold text-purple-400 mt-1">{projects.length}</p>
          </div>
        </div>
      </div>

      {/* Vista por proyectos */}
      <div className="space-y-6">
        {Object.values(tasksByProject).map((projectData: any) => (
          <div key={projectData.project.id} className="bg-card border-border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-md"></div>
                  {projectData.project.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                  Cliente: {projectData.project.client} • {projectData.tasks.length} TAREAS
                </p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                {projectData.project.status}
              </Badge>
            </div>
            <div className="p-4 space-y-2">
              {projectData.tasks.map((item: TaskWithDetails) => (
                <div
                  key={item.task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/50 hover:bg-muted transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 rounded-full bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      {getStatusIcon(item.task.status)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-200 group-hover:text-foreground transition-colors">{item.task.title}</h4>
                      {item.task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {item.task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`${statusColors[item.task.status]} text-[10px] uppercase tracking-wider font-bold`} variant="outline">
                          {item.task.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={`${priorityColors[item.task.priority]} text-[10px] uppercase tracking-wider font-bold`} variant="outline">
                          {item.task.priority}
                        </Badge>
                        {item.task.tags?.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-[10px] border-border text-muted-foreground">
                            {tag}
                          </Badge>
                        )) || []}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {item.task.progress > 0 && (
                      <div className="w-24 hidden md:block">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>PROGRESO</span>
                          <span>{item.task.progress}%</span>
                        </div>
                        <Progress value={item.task.progress} className="h-1.5 bg-muted/80" />
                      </div>
                    )}

                    {item.assignee && (
                      <Avatar className="w-8 h-8 border border-border">
                        <AvatarImage src={item.assignee.profileImage} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {item.assignee.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {item.task.dueDate && (
                      <div className="text-xs text-muted-foreground font-mono hidden sm:block">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(item.task.dueDate).toLocaleDateString()}
                      </div>
                    )}

                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted/80">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="bg-card border-border rounded-xl p-12 text-center border border-border/50">
            <div className="inline-flex p-4 rounded-full bg-muted mb-4">
              <FolderPlus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              No se encontraron tareas
            </h3>
            <p className="text-muted-foreground">
              {searchTerm || filterStatus !== 'all' || filterProject !== 'all'
                ? 'Ajusta los parámetros de búsqueda para localizar objetivos.'
                : 'Inicia una nueva misión creando tu primera tarea.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}