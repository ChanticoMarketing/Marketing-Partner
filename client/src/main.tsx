// ===== IMPORTACIONES PRINCIPALES =====
// React DOM: Para renderizar la aplicación en el navegador
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
// Componente principal de la aplicación
import App from "./App";
// Estilos globales de la aplicación
import "./index.css";
import { installClientErrorLogger } from "./lib/client-logs";

// ===== DEBUG Y VERIFICACIÓN =====
// Confirmar que el script se está ejecutando correctamente
console.log("Rocketflow application loading...");
installClientErrorLogger();

// ===== RENDERIZADO DE LA APLICACIÓN =====
// Buscar el elemento HTML donde se montará React
const rootElement = document.getElementById("root");

if (rootElement) {
  console.log("Root element found, rendering React app...");

  // Crear root de React 18 y renderizar la aplicación
  createRoot(rootElement).render(
    // StrictMode: Modo estricto de React para detectar problemas
    <StrictMode>
      {/* Componente principal de la aplicación */}
      <App />
    </StrictMode>
  );

  console.log("React app rendered successfully");
} else {
  // Error crítico si no se encuentra el elemento root
  console.error("Root element not found!");
}
