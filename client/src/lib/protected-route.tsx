// ===== IMPORTACIONES PARA RUTAS PROTEGIDAS =====
// Hook de autenticación personalizado
import { useAuth } from "@/hooks/use-auth";
// Icono de carga de Lucide React
import { AlertTriangle } from "lucide-react";
// Componente de redirección de Wouter
import { Redirect } from "wouter";
// Tipo para elementos hijo de React
import { ReactNode } from "react";

// ===== COMPONENTE DE RUTA PROTEGIDA =====
/**
 * HOC (Higher Order Component) que protege rutas requiriendo autenticación
 * Verifica si el usuario está autenticado antes de mostrar el contenido
 * Si no está autenticado, redirige a la página de login
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  // ===== OBTENER ESTADO DE AUTENTICACIÓN =====
  // Extraer información de usuario y estado de carga del contexto de auth
  const { user, isLoading, error } = useAuth();
  
  // Log para debugging del estado de autenticación
  console.log("ProtectedRoute:", { user: user?.username, isLoading });

  // ===== MOSTRAR PANTALLA DE CARGA =====
  // Si aún se está verificando la autenticación, mostrar indicador de carga
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', // Layout flexbox
        justifyContent: 'center', // Centrar horizontalmente
        alignItems: 'center', // Centrar verticalmente
        height: '100vh', // Ocupar toda la altura de la pantalla
        color: 'var(--foreground)' // Usar color de tema
      }}>
        Loading... {/* Mensaje de carga */}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "24px",
          color: "var(--foreground)",
        }}
      >
        <div
          style={{
            maxWidth: "440px",
            textAlign: "center",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            background: "var(--card)",
          }}
        >
          <AlertTriangle style={{ width: "32px", height: "32px", margin: "0 auto 12px" }} />
          <h1 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "8px" }}>
            No pudimos abrir tu sesión
          </h1>
          <p style={{ color: "var(--muted-foreground)", margin: 0 }}>{error.message}</p>
        </div>
      </div>
    );
  }

  // ===== VERIFICAR AUTENTICACIÓN =====
  // Si no hay usuario autenticado, redirigir a página de login
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // ===== RENDERIZAR CONTENIDO PROTEGIDO =====
  // Si el usuario está autenticado, mostrar el contenido hijo
  return <>{children}</>;
}
