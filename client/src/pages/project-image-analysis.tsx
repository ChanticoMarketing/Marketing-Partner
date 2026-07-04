import { useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import ProjectHeader from '@/components/project/project-header';
import ImageAnalysisPanel from '@/components/marketing/image-analysis-panel';
import { Icons } from '@/components/ui/icons';
import { Card } from '@/components/ui/card';

export default function ProjectImageAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Obtener información del proyecto
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['projects', parseInt(projectId || '0')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", parseInt(projectId || '0'))
        .single();
      if (error) throw error;
      return fromDb("projects", data);
    },
    enabled: !!projectId,
  });

  // Si el ID del proyecto no es válido, mostrar error
  if (!projectId) {
    return (
      <div className="container py-10">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
          <p>ID de proyecto no válido</p>
        </Card>
      </div>
    );
  }

  // Durante la carga, mostrar indicador
  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto py-10">
        <div className="flex items-center justify-center h-[60vh]">
          <Icons.spinner className="h-10 w-10 animate-spin" />
        </div>
      </div>
    );
  }
  
  // Si hay error al cargar el proyecto, mostrar mensaje
  if (error || !project) {
    return (
      <div className="container py-10">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
          <p>No se pudo cargar la información del proyecto</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects">Proyectos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/projects/${projectId}`}>{project.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Análisis de Imágenes</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <ProjectHeader project={project} activeTab="imageAnalysis" />
      
      <div className="mt-6">
        <ImageAnalysisPanel />
      </div>
    </div>
  );
}