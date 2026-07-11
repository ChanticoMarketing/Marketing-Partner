// ===== IMPORTACIONES DEL LAYOUT PRINCIPAL =====
// React: Hooks para estado y efectos
import { ReactNode, useState, useEffect } from "react";
// Componentes de la interfaz de usuario
import { Button } from "@/components/ui/button";
// Componente de la barra lateral
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// ===== TIPOS DE PROPS =====
// Propiedades que acepta el componente MainLayout
interface MainLayoutProps {
  children: ReactNode; // Contenido que se renderizará dentro del layout
}

// ===== COMPONENTE LAYOUT PRINCIPAL =====
// Layout base que envuelve todas las páginas de la aplicación
export default function MainLayout({ children }: MainLayoutProps) {
  // ===== ESTADOS DEL COMPONENTE =====
  // Estado para controlar si la sidebar está abierta en móvil
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Estado para detectar si se ha hecho scroll
  const [scrolled, setScrolled] = useState(false);

  // ===== FUNCIÓN PARA ALTERNAR SIDEBAR =====
  // Función que cambia el estado de la sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // ===== EFECTO PARA DETECTAR SCROLL =====
  // Detecta el scroll para aplicar efectos visuales sutiles
  useEffect(() => {
    // Función que maneja el evento de scroll
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true); // Activar estado de scroll si se ha desplazado más de 10px
      } else {
        setScrolled(false); // Desactivar estado de scroll
      }
    };

    // Agrega el evento al elemento main con scroll
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll);
      // Cleanup: remover el listener cuando el componente se desmonte
      return () => mainElement.removeEventListener('scroll', handleScroll);
    }
  }, []); // Array vacío significa que solo se ejecuta una vez

  // ===== RENDERIZADO DEL LAYOUT =====
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* ===== SIDEBAR =====*/}
      {/* Barra lateral - oculta en móvil a menos que se active */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ===== ÁREA PRINCIPAL =====*/}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-background">
        {/* Integración del Header Global */}
        <Header onMenuClick={toggleSidebar} />

        {/* Contenido principal con mejoras visuales */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 transition-all duration-300 min-h-0 hide-scrollbar">

          {/* ===== CONTENEDOR DEL CONTENIDO =====*/}
          {/* Contenedor principal con transiciones y efectos de scroll */}
          <div
            className={`w-full max-w-7xl mx-auto transition-all duration-300 fade-in-effect ${scrolled ? 'pt-2' : 'pt-3' // Ajustar padding según el estado de scroll
              }`}
          >
            {/* Renderizar el contenido hijo pasado al layout */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
