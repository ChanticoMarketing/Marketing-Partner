import React from 'react';
import {
  Card,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar, MoreHorizontal, Pencil, Trash2, UserCircle2, Eye } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@shared/schema';
// COMMENTED OUT: File not found
// import { TaskDetailModal } from './task-detail-modal';

interface DraggableTaskCardProps {
  task: Task;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  renderPriorityBadge?: (priority: string) => React.ReactNode;
  renderStatusBadge?: (status: string) => React.ReactNode;
  users: any[];
  isDragging?: boolean;
}

export function DraggableTaskCard({
  task,
  onEdit,
  onDelete,
  renderPriorityBadge,
  renderStatusBadge,
  users,
  isDragging
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `task-${task.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignedUser = users.find(user => user.id === task.assignedToId);
  const formattedDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) : 'Sin fecha';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Card className={`bg-card border-border border-border/50 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group ${isDragging ? 'opacity-50' : ''}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-start">
            <div className="font-medium text-foreground">{task.title}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-border text-foreground">
                {/* COMMENTED OUT: TaskDetailModal not found */}
                {/* <TaskDetailModal taskId={task.id}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver detalles
                  </DropdownMenuItem>
                </TaskDetailModal> */}
                <DropdownMenuItem onClick={() => onEdit(task.id)} className="focus:bg-muted/80 focus:text-foreground">
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(task.id)} className="focus:bg-muted/80 focus:text-foreground">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(task.id)}
                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>

          <div className="flex flex-wrap gap-2">
            {renderPriorityBadge && renderPriorityBadge(task.priority)}
            {renderStatusBadge && renderStatusBadge(task.status)}
          </div>
        </CardContent>

        <CardFooter className="p-3 pt-0 flex items-center justify-between border-t border-border/50 mt-2 pt-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="mr-1 h-3 w-3 text-primary/70" />
            {formattedDate}
          </div>

          {assignedUser ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {assignedUser.fullName?.substring(0, 2).toUpperCase() || 'NA'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2 bg-black/90 border-border text-foreground" align="end">
                <div className="flex items-center space-x-2">
                  <Avatar className="border border-border">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {assignedUser.fullName?.substring(0, 2).toUpperCase() || 'NA'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">{assignedUser.fullName}</div>
                    <div className="text-sm text-muted-foreground">{assignedUser.username}</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
          )}
        </CardFooter>
      </Card>
    </div>
  );
}