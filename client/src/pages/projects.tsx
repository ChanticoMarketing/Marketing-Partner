// ===== IMPORTACIONES PARA PÁGINA DE PROYECTOS =====
// React hooks para manejo de estado
import { useState } from "react";
// TanStack Query para manejo de datos del servidor
import { useQuery, QueryClient } from "@tanstack/react-query";
// Hook de autenticación
import { useAuth } from "@/hooks/use-auth";
// Router para navegación
import { Link } from "wouter";

// ===== COMPONENTES DE TABLA =====
// Componentes para mostrar datos en tabla responsive
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

// ===== COMPONENTES DE UI =====
import { Button } from "@/components/ui/button"; // Botones interactivos
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination"; // Sistema de paginación
import { Badge } from "@/components/ui/badge"; // Badges para estados

// ===== ICONOS Y COMPONENTES ESPECÍFICOS =====
import { Eye, Pencil, Plus, Rocket } from "lucide-react"; // Iconos de acciones
import NewProjectModal from "@/components/projects/new-project-modal"; // Modal para crear proyecto
import { formatRelative } from "date-fns"; // Formateo de fechas

// ===== COMPONENTE DE BADGE DE ESTADO =====
// Componente que muestra el estado del proyecto con colores específicos
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusProps = () => {
    switch (status) {
      case "active":
        return {
          className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "ACTIVO"
        };
      case "planning":
        return {
          className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          label: "PLANIFICACIÓN"
        };
      case "completed":
        return {
          className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
          label: "COMPLETADO"
        };
      case "on_hold":
        return {
          className: "bg-primary/10 text-primary/80 border-primary/20",
          label: "EN ESPERA"
        };
      default:
        return {
          className: "bg-gray-500/10 text-muted-foreground border-gray-500/20",
          label: status.toUpperCase()
        };
    }
  };

  const { className, label } = getStatusProps();

  return (
    <Badge variant="outline" className={`${className} tracking-wider font-bold text-[10px]`}>
      {label}
    </Badge>
  );
};

export default function Projects() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["/api/projects"],
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <Rocket className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-500/20 rounded-xl bg-red-500/10 text-red-400 my-4 backdrop-blur-sm">
        <p className="flex items-center gap-2 font-bold">
          <span className="text-xl">⚠️</span> Error loading projects: {error.message}
        </p>
      </div>
    );
  }

  // Calculate pagination
  const totalProjects = projects?.length || 0;
  const totalPages = Math.ceil(totalProjects / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalProjects);
  const currentProjects = projects?.slice(startIndex, endIndex) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            <span className="text-primary">/</span> PROYECTOS
          </h2>
          <p className="text-sm text-muted-foreground">Gestión de campañas y misiones activas</p>
        </div>
        {user?.isPrimary && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide shadow-md transition-all duration-300 hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            NUEVO PROYECTO
          </Button>
        )}
      </div>

      <div className="bg-card border-border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted">
                <TableHead className="text-xs font-bold text-primary uppercase tracking-wider py-4">Proyecto</TableHead>
                <TableHead className="text-xs font-bold text-primary uppercase tracking-wider py-4">Cliente</TableHead>
                <TableHead className="text-xs font-bold text-primary uppercase tracking-wider py-4">Estado</TableHead>
                <TableHead className="text-xs font-bold text-primary uppercase tracking-wider py-4">Última Actividad</TableHead>
                <TableHead className="text-xs font-bold text-primary uppercase tracking-wider py-4 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Rocket className="h-12 w-12 text-gray-700" />
                      <p>No hay proyectos activos en este sector.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                currentProjects.map((project) => (
                  <TableRow key={project.id} className="border-border/50 hover:bg-muted transition-colors">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary shadow-md"></div>
                        {project.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{project.client}</TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {formatRelative(new Date(project.updatedAt), new Date())}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" title="Ver Detalles">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {user?.isPrimary && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Mostrando <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> de <strong>{totalProjects}</strong>
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={cn(
                      "cursor-pointer hover:bg-muted/80 hover:text-primary transition-colors",
                      currentPage === 1 && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>

                {[...Array(totalPages)].map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={() => setCurrentPage(i + 1)}
                      isActive={currentPage === i + 1}
                      className={cn(
                        "cursor-pointer hover:bg-muted/80 hover:text-primary transition-colors",
                        currentPage === i + 1 && "bg-primary/20 text-primary border-primary/30"
                      )}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={cn(
                      "cursor-pointer hover:bg-muted/80 hover:text-primary transition-colors",
                      currentPage === totalPages && "pointer-events-none opacity-50"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <NewProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
