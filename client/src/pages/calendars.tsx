import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CalendarPlus, Calendar, ArrowRight, Rocket } from "lucide-react";

export default function Calendars() {
  return (
    <div className="space-y-8 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shadow-md">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-primary">/</span> CALENDARIOS
          </h1>
          <p className="text-muted-foreground tracking-wide">
            Sistemas de planificación y cronogramas de misión
          </p>
        </div>
      </div>

      {/* Calendar Options */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Calendario Rápido */}
        <div className="bg-card border-border border-border group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          <div className="p-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-md group-hover:scale-110 transition-transform duration-300">
                <Clock className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-2 text-foreground tracking-wide">CALENDARIO RÁPIDO</h3>
                <p className="text-sm text-muted-foreground">
                  Generación de cronogramas tácticos de corto alcance.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6 border-t border-border pt-6">
              <div className="text-sm">
                <div className="font-bold text-primary text-[10px] uppercase tracking-wider mb-1">Tiempo estimado</div>
                <div className="text-muted-foreground font-mono">1-2 MINUTOS</div>
              </div>
              <div className="text-sm">
                <div className="font-bold text-primary text-[10px] uppercase tracking-wider mb-1">Complejidad</div>
                <div className="text-muted-foreground font-mono">BÁSICA</div>
              </div>
            </div>

            <div className="mb-8 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-3">Capacidades:</div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full"></span>Configuración automática</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full"></span>Plantillas prediseñadas</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full"></span>Despliegue inmediato</li>
              </ul>
            </div>

            <Link href="/quick-calendar" className="block">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider uppercase shadow-md transition-all duration-300 group-hover:translate-y-[-2px]">
                <span className="flex items-center justify-center gap-2">
                  INICIAR SISTEMA
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Calendario Avanzado */}
        <div className="bg-card border-border border-border group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          <div className="p-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-md group-hover:scale-110 transition-transform duration-300">
                <CalendarPlus className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-2 text-foreground tracking-wide">CALENDARIO AVANZADO</h3>
                <p className="text-sm text-muted-foreground">
                  Control total de parámetros de misión y distribución estratégica.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6 border-t border-border pt-6">
              <div className="text-sm">
                <div className="font-bold text-primary text-[10px] uppercase tracking-wider mb-1">Tiempo estimado</div>
                <div className="text-muted-foreground font-mono">5-10 MINUTOS</div>
              </div>
              <div className="text-sm">
                <div className="font-bold text-primary text-[10px] uppercase tracking-wider mb-1">Complejidad</div>
                <div className="text-muted-foreground font-mono">AVANZADA</div>
              </div>
            </div>

            <div className="mb-8 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-3">Capacidades:</div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full"></span>Control multiplataforma</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full"></span>Distribución inteligente</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-primary rounded-full"></span>Parámetros técnicos</li>
              </ul>
            </div>

            <Link href="/calendar-creator" className="block">
              <Button className="w-full bg-transparent border border-primary text-primary hover:bg-primary/10 font-bold tracking-wider uppercase shadow-md transition-all duration-300">
                <span className="flex items-center justify-center gap-2">
                  CONFIGURAR SISTEMA
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-card border-border rounded-xl p-8 border border-border/50">
        <div className="flex items-start gap-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border">
            <Rocket className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-6 text-foreground uppercase tracking-wider">Protocolo de Selección</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="font-bold text-primary mb-3 flex items-center gap-2 uppercase text-xs tracking-wider">
                  <Clock className="h-4 w-4" />
                  Ruta Rápida
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-600 rounded-full"></span>Resultados inmediatos</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-600 rounded-full"></span>Misiones simples</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-600 rounded-full"></span>Pruebas de concepto</li>
                  </ul>
                </div>
              </div>
              <div>
                <div className="font-bold text-primary mb-3 flex items-center gap-2 uppercase text-xs tracking-wider">
                  <CalendarPlus className="h-4 w-4" />
                  Ruta Avanzada
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-600 rounded-full"></span>Control total de misión</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-600 rounded-full"></span>Campañas complejas</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-600 rounded-full"></span>Especificaciones técnicas</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}