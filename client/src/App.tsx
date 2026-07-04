// ===== IMPORTACIONES DE ROUTING =====
// Wouter: Librería de routing ligera para React
import { Switch, Route } from "wouter";

// ===== IMPORTACIONES DE GESTIÓN DE ESTADO =====
// React Query: Para manejo de estado del servidor y cache
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";

// ===== IMPORTACIONES DE COMPONENTES UI =====
// Toaster: Para mostrar notificaciones/mensajes
import { Toaster } from "@/components/ui/toaster";

// ===== IMPORTACIONES DE PÁGINAS =====
// Página 404 cuando no se encuentra la ruta
import NotFound from "@/pages/not-found";
// Páginas de autenticación
import AuthPage from "@/pages/auth-page";
import CreateAccount from "@/pages/create-account";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import CreatePrimaryUser from "@/pages/create-primary-user";
import AuthCallback from "@/pages/auth-callback";
// Páginas principales de la aplicación
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import ScheduleDetail from "@/pages/schedule-detail";
import CalendarCreator from "@/pages/calendar-creator";
import QuickCalendar from "@/pages/quick-calendar";
import TaskManager from "@/pages/task-manager";
import TaskManagerPage from "@/pages/task-manager-page";
import ProjectManager from "@/pages/project-manager";
import UserManagementPage from "@/pages/user-management";
import Analytics from "@/pages/analytics";
import Profile from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import ProjectImageAnalysisPage from "@/pages/project-image-analysis";
import Calendars from "@/pages/calendars";

// ===== IMPORTACIONES DE COMPONENTES Y PROVIDERS =====
// Componente para proteger rutas que requieren autenticación
import { ProtectedRoute } from "./lib/protected-route";
// Layout principal de la aplicación
import MainLayout from "./layouts/main-layout";
// Providers para contextos globales
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider } from "./hooks/use-theme";
import { AppTourProvider } from "./hooks/use-app-tour";
import CopilotButton from "@/components/copilot/copilot-button";
import { Preloader } from "@/components/ui/preloader";

// ===== COMPONENTE PRINCIPAL DE LA APLICACIÓN =====
function App() {
  console.log("App component rendering...");

  return (
    // ===== PROVIDERS ANIDADOS =====
    // QueryClientProvider: Proporciona el cliente de React Query a toda la app
    <QueryClientProvider client={queryClient}>
      {/* ThemeProvider: Maneja el sistema de temas (claro/oscuro/sistema) */}
      <ThemeProvider defaultTheme="system">
        {/* AuthProvider: Maneja el estado de autenticación del usuario */}
        <AuthProvider>
          <AppTourProvider>
            {/* Modal de Preloader Cinemático */}
            <Preloader />
            {/* Container principal con altura mínima y color de fondo dinámico */}
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
              {/* ===== SISTEMA DE ROUTING ===== */}
              {/* Switch: Renderiza solo la primera ruta que coincida */}
              <Switch>
                {/* ===== RUTAS DE AUTENTICACIÓN ===== */}
                {/* Estas rutas no requieren autenticación previa */}
                {/* Página principal de login/autenticación */}
                <Route path="/auth" component={AuthPage} />
                {/* Página para crear nueva cuenta de usuario */}
                <Route path="/create-account" component={CreateAccount} />
                {/* Página para solicitar recuperación de contraseña */}
                <Route path="/forgot-password" component={ForgotPassword} />
                {/* Página para restablecer contraseña con token */}
                <Route path="/reset-password" component={ResetPassword} />
                {/* Página especial para crear el primer usuario administrador */}
                <Route path="/create-primary-user" component={CreatePrimaryUser} />
                <Route path="/auth/callback" component={AuthCallback} />

                {/* ===== RUTAS PROTEGIDAS ===== */}
                {/* Todas estas rutas requieren autenticación válida */}

                {/* Ruta raíz: Dashboard principal de la aplicación */}
                <Route path="/">
                  <ProtectedRoute>
                    <MainLayout>
                      <Dashboard />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de listado de todos los proyectos */}
                <Route path="/projects">
                  <ProtectedRoute>
                    <MainLayout>
                      <Projects />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de detalle específico de un proyecto */}
                {/* Recibe el ID del proyecto como parámetro de URL */}
                <Route path="/projects/:id">
                  {(params: { id: string } | undefined) => (
                    <ProtectedRoute>
                      <MainLayout>
                        <ProjectDetail id={params ? parseInt(params.id) : 0} />
                      </MainLayout>
                    </ProtectedRoute>
                  )}
                </Route>

                {/* Página de detalle de un cronograma específico dentro de un proyecto */}
                {/* Recibe tanto el ID del proyecto como el ID del cronograma */}
                <Route path="/projects/:projectId/schedule/:id">
                  {(params: { projectId: string; id: string } | undefined) => (
                    <ProtectedRoute>
                      <MainLayout>
                        <ScheduleDetail
                          id={params ? parseInt(params.id) : 0}
                        />
                      </MainLayout>
                    </ProtectedRoute>
                  )}
                </Route>

                {/* Página de análisis de imágenes para un proyecto específico */}
                {/* Permite analizar imágenes de marketing usando IA */}
                <Route path="/projects/:projectId/image-analysis">
                  {() => (
                    <ProtectedRoute>
                      <MainLayout>
                        <ProjectImageAnalysisPage />
                      </MainLayout>
                    </ProtectedRoute>
                  )}
                </Route>

                {/* Página del creador de calendarios de contenido */}
                {/* Herramienta principal para generar cronogramas con IA */}
                <Route path="/calendar-creator">
                  <ProtectedRoute>
                    <MainLayout>
                      <CalendarCreator />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de calendarios */}
                {/* Página de selección entre calendario rápido y avanzado */}
                <Route path="/calendars">
                  <ProtectedRoute>
                    <MainLayout>
                      <Calendars />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de calendario rápido */}
                {/* Version simplificada del creador de calendarios */}
                <Route path="/quick-calendar">
                  <ProtectedRoute>
                    <MainLayout>
                      <QuickCalendar />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>







                {/* Gestión de usuarios del sistema */}
                {/* Solo accesible para usuarios administradores */}
                <Route path="/users-management">
                  <ProtectedRoute>
                    <MainLayout>
                      <UserManagementPage />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de análisis y métricas */}
                {/* Dashboard con estadísticas de proyectos y rendimiento */}
                <Route path="/analytics">
                  <ProtectedRoute>
                    <MainLayout>
                      <Analytics />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de perfil de usuario */}
                {/* Configuración personal del usuario */}
                <Route path="/profile">
                  <ProtectedRoute>
                    <MainLayout>
                      <Profile />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* Página de configuración general del sistema */}
                <Route path="/settings">
                  <ProtectedRoute>
                    <MainLayout>
                      <SettingsPage />
                    </MainLayout>
                  </ProtectedRoute>
                </Route>

                {/* ===== RUTA POR DEFECTO ===== */}
                {/* Página 404 - Se muestra cuando ninguna ruta coincide */}
                <Route component={NotFound} />
              </Switch>

              {/* ===== COMPONENTES GLOBALES ===== */}
              {/* Botón del asistente AI - Disponible en todas las páginas */}
              <CopilotButton />
              {/* Sistema de notificaciones toast - Muestra mensajes flotantes */}
              <Toaster />
            </div>
          </AppTourProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Exportación por defecto del componente principal
export default App;
