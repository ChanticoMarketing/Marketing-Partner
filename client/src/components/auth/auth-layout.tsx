import { ReactNode } from "react";
import { Link } from "wouter";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Zona de Marca (Mobile: Header, Desktop: Panel Izquierdo) */}
      <div className="md:w-[45%] lg:w-[40%] bg-[#151312] flex flex-col justify-between p-6 md:p-12 lg:p-16 relative overflow-hidden">
        {/* Decorative background element (Isotipo with low opacity) */}
        <div 
          className="absolute -bottom-32 -left-32 w-[600px] h-[600px] opacity-10 pointer-events-none"
          style={{
            backgroundImage: "url('/chantia-isotype-dark.png')",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />

        {/* Logo and Mobile Header */}
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
              <img 
                src="/chantia-isotype-dark.png" 
                alt="Chantia Isotipo" 
                className="h-full w-full object-cover scale-[1.3]" 
              />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-heading font-bold tracking-tight text-[#F7F2E9] truncate">Chantia</h1>
            </div>
          </Link>
        </div>

        {/* Desktop Brand Messaging */}
        <div className="hidden md:flex flex-col gap-6 relative z-10 mt-auto">
          <h2 className="text-4xl lg:text-5xl font-heading font-bold text-[#F7F2E9] leading-tight tracking-tight">
            Haz que el marketing avance.
          </h2>
          <p className="text-[#D5D3CF] text-lg max-w-md font-sans font-light leading-relaxed">
            El lugar donde estrategia, creatividad y ejecución se convierten en trabajo coordinado. Menos fricción. Más movimiento.
          </p>
        </div>
      </div>

      {/* Zona Funcional (Panel Derecho) */}
      <div className="flex-1 bg-[#F7F2E9] dark:bg-[#151312] flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md mx-auto z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          {children}
        </div>
      </div>
    </div>
  );
}
