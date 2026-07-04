import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Clock, LayoutDashboard, ListTodo, Rocket } from "lucide-react";

export default function QuickActions() {
  // Fetch project count
  const { data: projects } = useQuery<any[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray("projects", data);
    },
    staleTime: 30000,
  });

  // Fetch recent schedules
  const { data: schedules } = useQuery<any[]>({
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

  const activeProjectsCount = projects?.length || 0;
  const recentSchedulesCount = schedules?.length || 0;
  const pendingTasksCount = 3; // This could be fetched from an API in the future

  return (
    <div className="space-y-8">
      {/* Section Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-1 w-6 bg-primary rounded-full"></div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Acceso Rápido
        </h3>
      </div>

      {/* Primera fila: Acciones principales */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Proyectos activos */}
        <Link href="/projects" className="block w-full">
          <div className="group border rounded-xl bg-card p-5 transition-all duration-200 hover:bg-secondary/30 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-secondary text-foreground">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Proyectos</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Campañas Activas</p>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <span className="text-3xl font-semibold tracking-tight leading-none">{activeProjectsCount}</span>
            </div>
          </div>
        </Link>

        {/* Calendarios recientes */}
        <Link href="/projects" className="block w-full">
          <div className="group border rounded-xl bg-card p-5 transition-all duration-200 hover:bg-secondary/30 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-secondary text-foreground">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Calendarios</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Generados Recientemente</p>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <span className="text-3xl font-semibold tracking-tight leading-none">{recentSchedulesCount}</span>
            </div>
          </div>
        </Link>


      </div>

      {/* Segunda fila: Creación de Calendarios */}
      {/* Segunda fila: Creación de Calendarios - Comparison Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Calendario Rápido - Clean */}
        <Link href="/quick-calendar" className="block w-full">
          <div className="group border rounded-xl bg-card p-6 transition-all duration-200 hover:bg-secondary/30 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-md bg-secondary text-foreground">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight">Calendario Rápido</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium text-muted-foreground">1-2 Minutos</span>
                  <span className="w-1 h-1 rounded-full bg-border"></span>
                  <span className="text-xs font-medium text-muted-foreground">Básico</span>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-sm mt-2">
              Generación veloz de contenido. Ideal para ideas espontáneas y cobertura inmediata.
            </p>
          </div>
        </Link>
        {/* Calendario Avanzado - Clean */}
        <Link href="/calendar-creator" className="block w-full">
          <div className="group border rounded-xl bg-card p-6 transition-all duration-200 hover:bg-secondary/30 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-md bg-secondary text-foreground">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight">Calendario Avanzado</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium text-muted-foreground">5-10 Minutos</span>
                  <span className="w-1 h-1 rounded-full bg-border"></span>
                  <span className="text-xs font-medium text-muted-foreground">Completo</span>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-sm mt-2">
              Control total de misión. Configura plataformas, formatos y distribución detallada.
            </p>
          </div>
        </Link>
      </div>
    </div >
  );
}