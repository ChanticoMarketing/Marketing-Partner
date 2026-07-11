
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ArrowRight, Clock, FileText } from "lucide-react";

interface Schedule {
  id: number;
  name: string;
  projectId: number;
  createdAt: string;
  entriesCount?: number;
}

export default function RecentSchedules() {
  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["schedules", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return fromDbArray("schedules", data);
    },
    staleTime: 30000,
  });
  const [, setLocation] = useLocation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const recentSchedules = schedules.slice(0, 5);

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <div className="p-2 rounded-md bg-secondary text-foreground">
          <Calendar className="h-4 w-4" />
        </div>
        <h3 className="font-heading font-semibold text-sm tracking-tight text-foreground">Cronogramas Recientes</h3>
      </div>
      <div className="p-0">
        {recentSchedules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="relative mx-auto mb-4 h-16 w-16 opacity-10">
              <Calendar className="h-16 w-16" />
            </div>
            <p className="text-lg font-medium mb-2">No hay cronogramas creados</p>
            <p className="text-sm text-muted-foreground mb-6">Genera tu primer calendario de contenido</p>
            <Button
              className="font-medium"
              onClick={() => setLocation("/calendar-creator")}
            >
              Crear Primer Cronograma
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {recentSchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="group flex items-center justify-between p-4 border-b last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => setLocation(`/projects/${schedule.projectId}/schedule/${schedule.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-sm text-foreground">{schedule.name}</h4>
                    {schedule.entriesCount && (
                      <Badge variant="secondary" className="text-[10px] uppercase font-medium">
                        {schedule.entriesCount} entradas
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(schedule.createdAt)}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Proyecto #{schedule.projectId}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="p-4 bg-muted/20">
              <Button
                variant="outline"
                className="w-full text-xs font-medium h-9"
                onClick={() => setLocation("/calendar-creator")}
              >
                Crear Nuevo Cronograma
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
