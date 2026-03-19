import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Calendar, ArrowRight } from "lucide-react";

export default function CreateScheduleSection() {
  return (
    <div className="grid gap-6">
      {/* Calendario Unificado */}
      <Card className="transition-all duration-300 hover:shadow-lg border-2 hover:border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-amber-100 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Calendarios de Contenido</h3>
              <p className="text-sm text-muted-foreground">
                Elige entre calendario rápido o avanzado para generar contenido optimizado
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-sm">
              <div className="font-medium">⚡ Opciones</div>
              <div className="text-muted-foreground">Rápido y Avanzado</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">🎯 Personalización</div>
              <div className="text-muted-foreground">Adaptable a tu proyecto</div>
            </div>
          </div>

          <Link href="/calendars" className="block">
            <Button className="w-full bg-gradient-to-r from-blue-600 to-primary/90 hover:from-blue-700 hover:to-amber-700 text-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              Ver Calendarios
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}