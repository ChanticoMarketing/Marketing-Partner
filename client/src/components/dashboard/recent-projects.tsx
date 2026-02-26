
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, ArrowRight, Calendar } from "lucide-react";

interface Project {
  id: number;
  name: string;
  client: string;
  status: string;
  createdAt: string;
}

export default function RecentProjects() {
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    staleTime: 30000,
  });
  const [, setLocation] = useLocation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'paused': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'in_progress': return 'En Progreso';
      case 'planning': return 'Planificación';
      case 'paused': return 'Pausado';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const recentProjects = projects.slice(0, 3);

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <div className="p-2 rounded-md bg-secondary text-foreground">
          <FolderOpen className="h-4 w-4" />
        </div>
        <h3 className="font-semibold text-sm tracking-tight text-foreground">Proyectos Recientes</h3>
      </div>
      <div className="p-0">
        {recentProjects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="relative mx-auto mb-4 h-16 w-16 opacity-10">
              <FolderOpen className="h-16 w-16" />
            </div>
            <p className="text-lg font-medium mb-2">No hay proyectos recientes</p>
            <p className="text-sm text-muted-foreground mb-6">Comienza creando tu primera campaña</p>
            <Button
              className="font-medium"
              onClick={() => setLocation("/projects")}
            >
              Crear Primer Proyecto
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="group flex items-center justify-between p-4 border-b last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-sm text-foreground">{project.name}</h4>
                    <Badge variant="outline" className="font-medium uppercase text-[10px]">
                      {getStatusText(project.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{project.client}</span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(project.createdAt)}
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
                onClick={() => setLocation("/projects")}
              >
                Ver Todos los Proyectos
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
