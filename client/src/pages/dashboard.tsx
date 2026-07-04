// ===== IMPORTACIONES DEL DASHBOARD =====
// TanStack Query: Para consultas de datos del servidor
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
// Hook para mostrar notificaciones
import { useToast } from "@/hooks/use-toast";

// ===== COMPONENTES DEL DASHBOARD =====
// Sección de bienvenida con información del usuario
import WelcomeSection from "@/components/dashboard/welcome-section";
// Acciones rápidas (crear proyecto, calendario, etc.)
import QuickActions from "@/components/dashboard/quick-actions";
// Lista de proyectos recientes
import RecentProjects from "@/components/dashboard/recent-projects";
// Lista de cronogramas recientes
import RecentSchedules from "@/components/dashboard/recent-schedules";

// ===== COMPONENTE PRINCIPAL DEL DASHBOARD =====
// Página principal que muestra un resumen del estado del usuario y proyectos
export default function Dashboard() {
  // Hook para mostrar notificaciones toast
  const { toast } = useToast();

  // ===== CONSULTA DE DATOS DEL USUARIO =====
  // Obtiene información del usuario autenticado
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      return fromDb("users", data);
    },
    retry: 1
  });

  // ===== CONSULTA DE PROYECTOS =====
  // Obtiene lista de todos los proyectos del usuario
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray("projects", data);
    },
    retry: 1
  });

  // ===== CONSULTA DE CRONOGRAMAS RECIENTES =====
  // Obtiene cronogramas de contenido recientes
  const { data: schedules } = useQuery({
    queryKey: ['schedules', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return fromDbArray("schedules", data);
    },
    retry: 1
  });

  // ===== RENDERIZADO DEL DASHBOARD =====
  return (
    <div className="space-y-6 hide-scrollbar">
      {/* Sección de bienvenida con información del usuario */}
      <WelcomeSection user={user} />
      
      {/* Acciones rápidas para crear contenido */}
      <QuickActions />
      
      {/* Grid responsivo con proyectos y cronogramas recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentProjects />
        <RecentSchedules />
      </div>
    </div>
  );
}