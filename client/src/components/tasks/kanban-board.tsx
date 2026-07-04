import React, { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { KanbanColumn } from './kanban-column';
import { DraggableTaskCard } from './draggable-task-card';
import { Task } from '@shared/schema';

interface KanbanBoardProps {
  tasks: Task[];
  users: any[];
  onTaskMove: (taskId: number, newStatus: string, newGroup: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  groupBy: 'status' | 'priority' | 'assignee' | 'group';
}

// Helper function to create columns based on groupBy parameter
const createColumns = (tasks: Task[], groupBy: string) => {
  switch (groupBy) {
    case 'priority':
      return {
        columns: [
          { id: 'low', title: 'Baja' },
          { id: 'medium', title: 'Media' },
          { id: 'high', title: 'Alta' },
          { id: 'urgent', title: 'Urgente' }
        ],
        getGroupForTask: (task: Task) => task.priority || 'medium'
      };
    case 'group':
      return {
        columns: [
          { id: 'planificacion', title: 'Planificación' },
          { id: 'creacion', title: 'Creación' },
          { id: 'revision', title: 'Revisión' },
          { id: 'publicacion', title: 'Publicación' }
        ],
        getGroupForTask: (task: Task) => (task as any).taskGroup || 'planificacion' // Usar tipo any para acceder a taskGroup
      };
    case 'assignee':
      // Create dynamic columns for assignees
      const assigneeIds = Array.from(new Set(tasks.map(task => task.assignedToId))).filter(Boolean);
      return {
        columns: [
          { id: 'sin_asignar', title: 'Sin asignar' },
          ...assigneeIds.map(id => ({ id: id?.toString() || 'sin_asignar', title: `Asignado a ${id}` }))
        ],
        getGroupForTask: (task: Task) => task.assignedToId?.toString() || 'sin_asignar'
      };
    default:
      return {
        columns: [
          { id: 'pending', title: 'Pendiente' },
          { id: 'in_progress', title: 'En Progreso' },
          { id: 'completed', title: 'Completada' }
        ],
        getGroupForTask: (task: Task) => task.status || 'pending'
      };
  }
};

export function KanbanBoard({
  tasks,
  users,
  onTaskMove,
  onEditTask,
  onDeleteTask,
  groupBy
}: KanbanBoardProps) {
  // State for active drag
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Setup sensors for drag and drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get column configuration
  const { columns, getGroupForTask } = createColumns(tasks, groupBy);

  // Group tasks by column
  const tasksByColumn = columns.reduce((acc, column) => {
    acc[column.id] = tasks.filter(task => getGroupForTask(task) === column.id);
    return acc;
  }, {} as Record<string, Task[]>);

  // Handle drag start event
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = Number(active.id.toString().replace('task-', ''));
    const task = tasks.find(t => t.id === taskId);

    if (task) {
      setActiveTask(task);
    }
  };

  // Handle drag over event
  const handleDragOver = (event: DragOverEvent) => {
    // This is where we would implement sorting within a column
    // Not implementing for simplicity, but would use arrayMove here
  };

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset active task
    setActiveTask(null);

    if (!over) return;

    const taskId = Number(active.id.toString().replace('task-', ''));
    const task = tasks.find(t => t.id === taskId);

    if (!task) return;

    const targetColumnId = over.id.toString();
    const currentGroup = getGroupForTask(task);

    // If the task was dropped in a different column
    if (currentGroup !== targetColumnId) {
      // Determine what changed based on groupBy
      let newStatus = task.status;
      let newGroup = (task as any).taskGroup;

      if (groupBy === 'status') {
        newStatus = targetColumnId as any; // Cast to any to avoid type error
      } else if (groupBy === 'group') {
        newGroup = targetColumnId;
      }

      // Call the move handler with the new values
      onTaskMove(task.id, newStatus, newGroup);
    }
  };

  // Render priority badges with appropriate colors
  const renderPriorityBadge = (priority: string) => {
    let className = "bg-gray-500/20 text-muted-foreground border-gray-500/30";

    switch (priority) {
      case 'baja':
      case 'low':
        className = "bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30";
        break;
      case 'media':
      case 'medium':
        className = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30";
        break;
      case 'alta':
      case 'high':
        className = "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30";
        break;
      case 'urgente':
      case 'urgent':
        className = "bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30";
        break;
    }

    return (
      <Badge className={`${className} border`} variant="outline">
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  // Render status badges
  const renderStatusBadge = (status: string) => {
    let className = "bg-gray-500/20 text-muted-foreground border-gray-500/30";

    switch (status) {
      case 'pendiente':
      case 'pending':
        className = "bg-muted text-muted-foreground border-border";
        break;
      case 'en_progreso':
      case 'in_progress':
        className = "bg-blue-500/20 text-blue-500 border-blue-500/30 hover:bg-blue-500/30";
        break;
      case 'revision':
        className = "bg-purple-500/20 text-purple-500 border-purple-500/30 hover:bg-purple-500/30";
        break;
      case 'completada':
      case 'completed':
        className = "bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30";
        break;
    }

    return (
      <Badge className={`text-xs ${className} border`} variant="outline">
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </Badge>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {columns.map(column => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByColumn[column.id] || []}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            renderPriorityBadge={renderPriorityBadge}
            renderStatusBadge={renderStatusBadge}
            users={users}
          />
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="w-full max-w-[350px]">
            <DraggableTaskCard
              task={activeTask}
              onEdit={() => { }}
              onDelete={() => { }}
              renderPriorityBadge={renderPriorityBadge}
              renderStatusBadge={renderStatusBadge}
              users={users}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
