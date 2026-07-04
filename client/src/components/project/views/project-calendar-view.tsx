import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Calendar as CalendarIcon, Search, Plus } from "lucide-react";
import { addDays, format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";

interface ProjectCalendarViewProps {
  projectId: number;
  viewId: number;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  assignedToId: number | null;
}

export default function ProjectCalendarView({ projectId, viewId }: ProjectCalendarViewProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Sincronización en tiempo real para tareas
  useRealtimeSync({
    table: 'tasks',
    filter: `project_id=eq.${projectId}`,
    queryKey: ["projects", projectId, "tasks"]
  });

  // Obtener tareas del proyecto
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true });
      if (error) throw error;
      return fromDbArray("tasks", data);
    },
  });

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

  // Filtrar tareas por texto de búsqueda
  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    
    if (!searchTerm) return tasks;
    
    const term = searchTerm.toLowerCase();
    return tasks.filter(
      (task: Task) =>
        task.title.toLowerCase().includes(term) ||
        (task.description && task.description.toLowerCase().includes(term))
    );
  }, [tasks, searchTerm]);

  // Función para obtener tareas para una fecha específica
  const getTasksForDay = (day: Date) => {
    return filteredTasks.filter((task: Task) => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return isSameDay(dueDate, day);
    });
  };

  // Lista de días para el calendario
  const calendarDays = React.useMemo(() => {
    if (!date) return [];
    
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    return eachDayOfInterval({ start, end });
  }, [date]);

  // Función para obtener el color según la prioridad de la tarea
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-primary";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-blue-500";
    }
  };

  // Organizar tareas por días para el mes actual
  const tasksByDay = React.useMemo(() => {
    const result: Record<string, Task[]> = {};
    
    if (!filteredTasks || filteredTasks.length === 0) return result;
    
    calendarDays.forEach(day => {
      const formattedDay = format(day, "yyyy-MM-dd");
      result[formattedDay] = [];
    });
    
    filteredTasks.forEach((task: Task) => {
      if (!task.dueDate) return;
      
      const dueDate = new Date(task.dueDate);
      const formattedDueDate = format(dueDate, "yyyy-MM-dd");
      
      if (result[formattedDueDate]) {
        result[formattedDueDate].push(task);
      }
    });
    
    return result;
  }, [filteredTasks, calendarDays]);

  // Renderizar el día con sus tareas
  const renderDay = (day: Date) => {
    const formattedDay = format(day, "yyyy-MM-dd");
    const dayTasks = tasksByDay[formattedDay] || [];
    const hasEvents = dayTasks.length > 0;
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className={`
              h-full min-h-[100px] cursor-pointer p-1 border border-border/20 hover:bg-muted/50 
              ${isSameDay(day, new Date()) ? "bg-blue-100/50 dark:bg-blue-900/20" : ""}
              ${selectedDay && isSameDay(day, selectedDay) ? "ring-2 ring-primary" : ""}
            `}
            onClick={() => setSelectedDay(day)}
          >
            <div className="text-sm font-medium mb-1">
              {format(day, "d", { locale: es })}
            </div>
            <div>
              {dayTasks.slice(0, 3).map((task: Task) => (
                <div 
                  key={task.id} 
                  className={`text-xs rounded px-1 py-0.5 truncate mb-1 text-foreground ${getPriorityColor(task.priority)}`}
                >
                  {task.title}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  {dayTasks.length - 3} más...
                </div>
              )}
            </div>
          </div>
        </PopoverTrigger>
        {hasEvents && (
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <h3 className="font-medium">{format(day, "EEEE, d 'de' MMMM", { locale: es })}</h3>
            </div>
            <div className="p-2 max-h-[300px] overflow-y-auto">
              {dayTasks.map((task: Task) => (
                <div key={task.id} className="p-2 hover:bg-muted rounded-md">
                  <div className="font-medium text-sm">{task.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {translateStatus(task.status)}
                    </Badge>
                    <Badge 
                      className={`text-xs ${
                        task.priority === "urgent" || task.priority === "critical" 
                          ? "bg-red-500" 
                          : task.priority === "high" 
                          ? "bg-primary" 
                          : task.priority === "medium" 
                          ? "bg-yellow-500" 
                          : "bg-green-500"
                      }`}
                    >
                      {translatePriority(task.priority)}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tareas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full pl-8"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setDate(new Date())}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Hoy
          </Button>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Nueva tarea
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Card className="md:w-80 shrink-0">
          <CardHeader>
            <CardTitle className="text-xl">Calendario</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              className="rounded-md border"
              locale={es}
            />
            
            <div className="mt-4 space-y-1">
              <h3 className="font-medium text-sm">Prioridades</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span>Urgente / Crítica</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full bg-primary"></span>
                  <span>Alta</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span>Media</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span>Baja</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-7 gap-0 border border-border/20 rounded-md overflow-hidden">
            {/* Días de la semana */}
            {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
              <div key={day} className="p-2 text-center font-medium bg-muted/50">
                {day}
              </div>
            ))}
            
            {/* Rendereamos los días del mes con sus tareas */}
            {calendarDays.map((day) => (
              <div key={day.toISOString()}>
                {renderDay(day)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}