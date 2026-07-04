import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useQuery, useMutation } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, Users, Calendar, Flag, Settings, MessageCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { queryClient } from '@/lib/queryClient';
import { TaskGroup, InsertTaskGroup, Task, ProjectColumnSetting, User } from '@shared/schema';
import TaskComments from '@/components/collaboration/task-comments';
import TaskAssignment from '@/components/collaboration/task-assignment';
import NewTaskModal from '@/components/tasks/new-task-modal';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

interface ProjectBoardViewProps {
  projectId: number;
  viewId: number;
}

interface TaskWithDetails extends Task {
  assignee?: {
    id: number;
    fullName: string;
    username: string;
    profileImage: string | null;
  };
  additionalAssignees?: Array<{
    id: number;
    fullName: string;
    username: string;
    profileImage: string | null;
  }>;
}

interface GroupedTasks {
  group: TaskGroup | null;
  tasks: TaskWithDetails[];
}

// Componente de celda configurable para diferentes tipos de columna
function ConfigurableCell({ 
  columnType, 
  value, 
  task, 
  onUpdate 
}: { 
  columnType: string;
  value: any;
  task: TaskWithDetails;
  onUpdate: (taskId: number, field: string, value: any) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSave = () => {
    onUpdate(task.id, columnType, tempValue);
    setIsEditing(false);
  };

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800', 
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
    critical: 'bg-purple-100 text-purple-800'
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    blocked: 'bg-orange-100 text-orange-800',
    deferred: 'bg-yellow-100 text-yellow-800'
  };

  switch (columnType) {
    case 'text':
      return isEditing ? (
        <Input
          value={tempValue || ''}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          className="h-8 text-sm"
        />
      ) : (
        <div 
          onClick={() => setIsEditing(true)}
          className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded text-sm"
        >
          {value || 'Hacer clic para editar'}
        </div>
      );

    case 'status':
      return (
        <Select value={value || 'pending'} onValueChange={(val) => onUpdate(task.id, 'status', val)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue>
              <Badge className={statusColors[value as keyof typeof statusColors] || 'bg-gray-100'}>
                {value || 'pending'}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="deferred">Diferido</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'people':
      return (
        <div className="flex -space-x-1">
          {task.assignee && (
            <Avatar className="h-6 w-6 border-2 border-white">
              <AvatarImage src={task.assignee.profileImage || undefined} />
              <AvatarFallback className="text-xs">
                {task.assignee.fullName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          )}
          {task.additionalAssignees?.map((assignee) => (
            <Avatar key={assignee.id} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={assignee.profileImage || undefined} />
              <AvatarFallback className="text-xs">
                {assignee.fullName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      );

    case 'date':
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-8 px-2 text-sm justify-start">
              <Calendar className="h-3 w-3 mr-1" />
              {value ? new Date(value).toLocaleDateString() : 'Sin fecha'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => onUpdate(task.id, 'dueDate', date?.toISOString())}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );

    case 'dropdown':
      const priorityValue = value || task.priority || 'medium';
      return (
        <Select value={priorityValue} onValueChange={(val) => onUpdate(task.id, 'priority', val)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue>
              <Badge className={priorityColors[priorityValue as keyof typeof priorityColors] || 'bg-gray-100'}>
                <Flag className="h-3 w-3 mr-1" />
                {priorityValue}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baja</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
          </SelectContent>
        </Select>
      );

    default:
      return <div className="text-sm text-muted-foreground">{value || '-'}</div>;
  }
}

// Componente de tarea arrastrable
function SortableTaskItem({ 
  task, 
  columns, 
  onTaskUpdate,
  onOpenComments 
}: { 
  task: TaskWithDetails;
  columns: ProjectColumnSetting[];
  onTaskUpdate: (taskId: number, field: string, value: any) => void;
  onOpenComments: (taskId: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group"
    >
      {/* Área de arrastre principal */}
      <div {...attributes} {...listeners} className="cursor-move">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
          {columns.map((column) => (
            <div key={column.id} className="min-w-0">
              <ConfigurableCell
                columnType={column.columnType}
                value={getTaskValue(task, column.columnType)}
                task={task}
                onUpdate={onTaskUpdate}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Botones de colaboración */}
      <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments(task.id);
          }}
          className="h-7 px-2"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Comentarios
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            // Aquí se abriría el modal de asignación
          }}
          className="h-7 px-2"
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Asignar
        </Button>
      </div>
    </div>
  );
}

// Función auxiliar para obtener el valor de la tarea según el tipo de columna
function getTaskValue(task: TaskWithDetails, columnType: string): any {
  switch (columnType) {
    case 'text':
      return task.title;
    case 'status':
      return task.status;
    case 'people':
      return task.assignee;
    case 'date':
      return task.dueDate;
    case 'dropdown':
      return task.priority;
    default:
      return null;
  }
}

// Componente principal del tablero
export default function ProjectBoardView({ projectId, viewId }: ProjectBoardViewProps) {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<number | null>(null);
  const [showTaskComments, setShowTaskComments] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedGroupForNewTask, setSelectedGroupForNewTask] = useState<number | null>(null);

  // Sincronización en tiempo real para tareas
  useRealtimeSync({
    table: 'tasks',
    filter: `project_id=eq.${projectId}`,
    queryKey: ['/api/tasks-with-groups']
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Obtener grupos de tareas con tareas incluidas
  const { data: groupedTasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['/api/tasks-with-groups'],
    queryFn: async () => {
      const response = await fetch('/api/tasks-with-groups', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json() as GroupedTasks[];
    },
  });

  // Obtener configuración de columnas del proyecto
  const { data: columns, isLoading: isLoadingColumns } = useQuery({
    queryKey: ['projects', projectId, 'columns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_column_settings")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return fromDbArray<ProjectColumnSetting>("project_column_settings", data);
    },
  });

  // Obtener grupos de tareas
  const { data: taskGroups } = useQuery({
    queryKey: ['projects', projectId, 'task-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_groups")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true });
      if (error) throw error;
      return fromDbArray<TaskGroup>("task_groups", data);
    },
  });

  // Mutación para crear grupo
  const createGroupMutation = useMutation({
    mutationFn: async (groupData: Partial<InsertTaskGroup>) => {
      return dbQuery("task_groups").insertSingle({ ...groupData, projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'task-groups'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-with-groups'] });
      setIsCreatingGroup(false);
      setNewGroupName('');
    },
  });

  // Mutación para actualizar tarea
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: any }) => {
      return dbQuery("tasks").updateSingle(updates, { id: taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-with-groups'] });
    },
  });

  // Mutación para crear nueva tarea
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return dbQuery("tasks").insertSingle(taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-with-groups'] });
      setShowNewTaskModal(false);
    },
  });

  // Manejar actualización de tarea
  const handleTaskUpdate = (taskId: number, field: string, value: any) => {
    updateTaskMutation.mutate({
      taskId,
      updates: { [field]: value }
    });
  };

  // Manejar arrastrar y soltar
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    // Aquí puedes implementar la lógica de reordenamiento
    // Por ahora, solo registramos el evento
    console.log('Drag end:', { active: active.id, over: over.id });
  };

  // Crear nuevo grupo
  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      createGroupMutation.mutate({
        name: newGroupName.trim(),
        color: '#4285f4',
        position: (taskGroups?.length || 0),
      });
    }
  };

  // Manejar comentarios de tarea
  const handleOpenComments = (taskId: number) => {
    setSelectedTaskForComments(taskId);
    setShowTaskComments(true);
  };

  const handleCloseComments = () => {
    setShowTaskComments(false);
    setSelectedTaskForComments(null);
  };

  // Manejar creación de nueva tarea
  const handleNewTask = (groupId?: number) => {
    setSelectedGroupForNewTask(groupId || null);
    setShowNewTaskModal(true);
  };

  const handleCreateTask = (taskData: any) => {
    createTaskMutation.mutate({
      ...taskData,
      projectId,
      groupId: selectedGroupForNewTask,
    });
  };

  if (isLoadingTasks || isLoadingColumns) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Encabezado del tablero */}
      <div className="flex items-center justify-between p-4 border-b bg-[#10141c]">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold">Tablero de Proyecto</h2>
          <Badge variant="secondary">
            {groupedTasks?.reduce((acc, group) => acc + group.tasks.length, 0) || 0} tareas
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar columnas
          </Button>
          <Button size="sm" onClick={() => handleNewTask()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva tarea
          </Button>
        </div>
      </div>
      {/* Encabezados de columnas */}
      {columns && columns.length > 0 && (
        <div className="border-b p-4 bg-[#10141c] text-[#ffffff]">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
            {columns.map((column) => (
              <div key={column.id} className="text-sm font-medium flex items-center text-[#f8fafc]">
                {column.columnType === 'people' && <Users className="h-4 w-4 mr-1" />}
                {column.columnType === 'date' && <Calendar className="h-4 w-4 mr-1" />}
                {column.columnType === 'dropdown' && <Flag className="h-4 w-4 mr-1" />}
                {column.columnName}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Contenido del tablero */}
      <div className="flex-1 overflow-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {groupedTasks?.map((groupData) => (
              <div key={groupData.group?.id || 'ungrouped'} className="bg-white rounded-lg border">
                {/* Encabezado del grupo */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: groupData.group?.color || '#4285f4' }}
                      />
                      <h3 className="font-medium">
                        {groupData.group?.name || 'Sin grupo'}
                      </h3>
                      <Badge variant="secondary">
                        {groupData.tasks.length}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Lista de tareas */}
                <div className="p-4">
                  <SortableContext
                    items={groupData.tasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {groupData.tasks.map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          columns={columns || []}
                          onTaskUpdate={handleTaskUpdate}
                          onOpenComments={handleOpenComments}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  {/* Botón para agregar tarea */}
                  <Button
                    variant="ghost"
                    className="w-full mt-3 border-dashed border"
                    size="sm"
                    onClick={() => handleNewTask(groupData.group?.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar tarea
                  </Button>
                </div>
              </div>
            ))}

            {/* Crear nuevo grupo */}
            {isCreatingGroup ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Nombre del grupo"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                      autoFocus
                    />
                    <Button onClick={handleCreateGroup} size="sm">
                      Crear
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setIsCreatingGroup(false);
                        setNewGroupName('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setIsCreatingGroup(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar grupo
              </Button>
            )}
          </div>
        </DndContext>
      </div>

      {/* Modal de comentarios de tarea */}
      {selectedTaskForComments && (
        <TaskComments
          taskId={selectedTaskForComments}
          isOpen={showTaskComments}
          onClose={handleCloseComments}
        />
      )}

      {/* Modal de nueva tarea */}
      <NewTaskModal
        isOpen={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        onSubmit={handleCreateTask}
        groupName={
          selectedGroupForNewTask 
            ? taskGroups?.find(g => g.id === selectedGroupForNewTask)?.name 
            : undefined
        }
      />
    </div>
  );
}
