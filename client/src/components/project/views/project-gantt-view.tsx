import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { Task, taskStatusEnum, taskPriorityEnum } from "@shared/schema";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectGanttViewProps {
  projectId: number;
  viewId: number;
}

interface DateRange {
  start: Date;
  end: Date;
  days: Date[];
}

export default function ProjectGanttView({ projectId, viewId }: ProjectGanttViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 3);
    
    const end = new Date(today);
    end.setDate(today.getDate() + 27); // ~1 mes vista
    
    return {
      start,
      end,
      days: getDaysArray(start, end),
    };
  });

  // Función para generar un array de fechas entre start y end
  function getDaysArray(start: Date, end: Date) {
    const arr = [];
    const dt = new Date(start);
    
    while (dt <= end) {
      arr.push(new Date(dt));
      dt.setDate(dt.getDate() + 1);
    }
    
    return arr;
  }

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

  // Filtrado de tareas
  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];

    let filtered = [...tasks];

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(term) ||
          (task.description && task.description.toLowerCase().includes(term))
      );
    }

    // Filtrar por estado
    if (statusFilter) {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    // Filtrar por fechas (solo mostrar tareas que tengan fechas y que estén en el rango)
    filtered = filtered.filter((task) => {
      // Si no hay fechas, no mostramos en el gantt
      if (!task.dueDate && !task.dueDate) return false;
      
      // Si hay fecha de inicio o fecha límite, asegurarse que esté en el rango
      const taskStart = task.dueDate ? new Date(task.dueDate) : null;
      const taskEnd = task.dueDate ? new Date(task.dueDate) : null;
      
      if (taskStart && taskEnd) {
        // Verificar si hay superposición entre los rangos
        return taskStart <= dateRange.end && taskEnd >= dateRange.start;
      } else if (taskStart) {
        // Solo fecha de inicio
        return taskStart >= dateRange.start && taskStart <= dateRange.end;
      } else if (taskEnd) {
        // Solo fecha límite
        return taskEnd >= dateRange.start && taskEnd <= dateRange.end;
      }
      
      return false;
    });

    // Ordenar por fecha de inicio
    filtered.sort((a, b) => {
      const aStart = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bStart = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      
      if (aStart === 0 && bStart === 0) {
        // Si ambos no tienen fecha de inicio, ordenar por fecha límite
        const aEnd = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bEnd = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return aEnd - bEnd;
      }
      
      if (aStart === 0) return 1;
      if (bStart === 0) return -1;
      
      return aStart - bStart;
    });

    return filtered;
  }, [tasks, searchTerm, statusFilter, dateRange]);

  // Avanzar/retroceder en el tiempo
  const handleTimeChange = (direction: 'prev' | 'next') => {
    setDateRange(prev => {
      const newStart = new Date(prev.start);
      const newEnd = new Date(prev.end);
      
      const days = (prev.end.getTime() - prev.start.getTime()) / (1000 * 60 * 60 * 24);
      
      if (direction === 'prev') {
        newStart.setDate(newStart.getDate() - Math.ceil(days / 2));
        newEnd.setDate(newEnd.getDate() - Math.ceil(days / 2));
      } else {
        newStart.setDate(newStart.getDate() + Math.ceil(days / 2));
        newEnd.setDate(newEnd.getDate() + Math.ceil(days / 2));
      }
      
      return {
        start: newStart,
        end: newEnd,
        days: getDaysArray(newStart, newEnd),
      };
    });
  };

  // Generar la barra de tarea
  const renderTaskBar = (task: Task) => {
    if (!task.dueDate && !task.dueDate) return null;
    
    const startDate = task.dueDate 
      ? new Date(task.dueDate) 
      : task.dueDate 
        ? new Date(task.dueDate) 
        : null;
        
    const endDate = task.dueDate 
      ? new Date(task.dueDate) 
      : task.dueDate 
        ? new Date(task.dueDate) 
        : null;
    
    if (!startDate || !endDate) return null;
    
    // Ajustar fechas si están fuera del rango visible
    const visibleStart = startDate < dateRange.start ? dateRange.start : startDate;
    const visibleEnd = endDate > dateRange.end ? dateRange.end : endDate;
    
    // Calcular posición y ancho
    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const startOffset = (visibleStart.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
    
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    
    // Seleccionar color según estado
    const getStatusColor = (status: string) => {
      switch (status) {
        case "completed": return "bg-green-500";
        case "in_progress": return "bg-blue-500";
        case "review": return "bg-yellow-500";
        case "blocked": return "bg-red-500";
        case "deferred": return "bg-gray-500";
        default: return "bg-slate-500";
      }
    };

    // Traducción de estados para el tooltip
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
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={`absolute h-5 rounded-sm cursor-pointer ${getStatusColor(task.status)}`}
              style={{ 
                left: `${left}%`, 
                width: `${width}%`,
                minWidth: '4px'
              }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 max-w-[300px]">
              <p className="font-medium">{task.title}</p>
              <div className="text-xs flex items-center space-x-2">
                <Badge variant="outline">{translateStatus(task.status)}</Badge>
                <span>
                  {startDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} - 
                  {endDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                </span>
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground">{task.description}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Función para formatear fecha para el encabezado
  const formatHeaderDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    // Resaltar la fecha actual
    const isToday = date.getTime() === today.getTime();
    
    // Formato para el día de la semana
    const dayName = date.toLocaleDateString("es-ES", { weekday: "short" });
    const dayNumber = date.getDate();
    
    const formattedDay = `${dayName} ${dayNumber}`;
    
    // Agregar mes solo para el primer día del mes
    const isFirstDayOfMonth = date.getDate() === 1;
    const month = isFirstDayOfMonth 
      ? date.toLocaleDateString("es-ES", { month: "short" }) 
      : "";
    
    return (
      <div 
        className={`text-center ${isToday ? 'font-bold text-primary' : ''} text-xs pb-1`}
      >
        <div>{formattedDay}</div>
        {isFirstDayOfMonth && <div className="font-bold">{month}</div>}
      </div>
    );
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tareas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full sm:w-[300px] pl-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter || "all-status"} onValueChange={(val) => setStatusFilter(val === "all-status" ? null : val)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos los estados</SelectItem>
              {Object.values(taskStatusEnum.enumValues).map((status) => (
                <SelectItem key={status} value={status}>
                  {translateStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <Button size="icon" variant="outline" onClick={() => handleTimeChange('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {dateRange.start.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} - 
              {dateRange.end.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
            </span>
            <Button size="icon" variant="outline" onClick={() => handleTimeChange('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Encabezado con fechas */}
          <div className="flex border-b sticky top-0 bg-background z-10">
            <div className="w-[250px] min-w-[250px] border-r shrink-0 p-2 bg-muted/40">
              <span className="font-medium">Tarea</span>
            </div>
            <div className="flex-1 grid grid-cols-31">
              {dateRange.days.map((day, index) => (
                <div key={index} className="border-r last:border-r-0 px-1">
                  {formatHeaderDate(day)}
                </div>
              ))}
            </div>
          </div>

          {/* Filas de tareas */}
          {filteredTasks.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No se encontraron tareas que coincidan con los criterios o que tengan fechas asignadas.
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div key={task.id} className="flex border-b last:border-b-0 hover:bg-muted/50">
                <div className="w-[250px] min-w-[250px] border-r shrink-0 p-2 truncate">
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.dueDate && (
                      <span>
                        {new Date(task.dueDate).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    )}
                    {task.dueDate && task.dueDate && " - "}
                    {task.dueDate && (
                      <span>
                        {new Date(task.dueDate).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 h-8 relative">
                  {renderTaskBar(task)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .grid-cols-31 {
          display: grid;
          grid-template-columns: repeat(${dateRange.days.length}, minmax(30px, 1fr));
        }
      `}</style>
    </div>
  );
}