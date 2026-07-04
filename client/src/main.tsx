// ===== IMPORTACIONES PRINCIPALES =====
// React DOM: Para renderizar la aplicación en el navegador
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
// Componente principal de la aplicación
import App from "./App";
// Estilos globales de la aplicación
import "./index.css";
// Provider para tours guiados (importado aquí para configuración global)
import { AppTourProvider } from "./hooks/use-app-tour";

// ===== DEBUG Y VERIFICACIÓN =====
// Confirmar que el script se está ejecutando correctamente
console.log("Rocketflow application loading...");

// ===== RENDERIZADO DE LA APLICACIÓN =====
// Buscar el elemento HTML donde se montará React
const rootElement = document.getElementById("root");

if (rootElement) {
  console.log("Root element found, rendering React app...");

  // Crear root de React 18 y renderizar la aplicación
  createRoot(rootElement).render(
    // StrictMode: Modo estricto de React para detectar problemas
    <StrictMode>
      {/* AppTourProvider adicional aquí para configuración global */}
      <AppTourProvider>
        {/* Componente principal de la aplicación */}
        <App />
      </AppTourProvider>
    </StrictMode>
  );

  console.log("React app rendered successfully");
} else {
  // Error crítico si no se encuentra el elemento root
  console.error("Root element not found!");
}
