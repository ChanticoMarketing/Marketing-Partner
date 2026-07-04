import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Clock, ArrowLeft, Sparkles, Zap, CheckCircle2, LayoutTemplate, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const quickCalendarSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  duration: z.string().min(1, "Selecciona una duración"),
  startDate: z.date({
    required_error: "Selecciona una fecha de inicio",
  }),
  specifications: z.string().optional(),
});

type QuickCalendarFormData = z.infer<typeof quickCalendarSchema>;

const durationOptions = [
  { value: "7", label: "1 semana (7 días)", desc: "Ideal para campañas cortas" },
  { value: "14", label: "2 semanas (14 días)", desc: "Sprint quincenal estándar" },
  { value: "30", label: "1 mes (30 días)", desc: "Planificación mensual completa" },
];

export default function QuickCalendar() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<QuickCalendarFormData>({
    resolver: zodResolver(quickCalendarSchema),
    defaultValues: {
      duration: "14",
      startDate: new Date(),
      specifications: "",
    },
  });

  const { data: projects } = useQuery<any[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray("projects", data);
    },
    staleTime: 30000,
  });

  const generateScheduleMutation = useMutation({
    mutationFn: async (data: QuickCalendarFormData) => {
      if (!projects || projects.length === 0) {
        throw new Error("No hay proyectos disponibles");
      }

      const selectedProject = projects.find((p: any) => p.id.toString() === data.projectId);
      if (!selectedProject) {
        throw new Error("Proyecto no encontrado");
      }

      const requestData = {
        projectId: parseInt(data.projectId),
        startDate: format(data.startDate, "yyyy-MM-dd"),
        specifications: data.specifications || `Cronograma rápido y simple`,
        periodType: parseInt(data.duration) > 15 ? "mensual" : "quincenal",
        durationDays: parseInt(data.duration),
        additionalInstructions: `Este es un calendario RÁPIDO y simple. IMPORTANTE: NO uses cantidad fija de publicaciones. Debes ADAPTARTE completamente a las especificaciones del proyecto y sus redes sociales configuradas. Si el proyecto define frecuencias mensuales (ej: 20 publicaciones/mes), calcula proporcionalmente para el período de ${data.duration} días. Mantén el contenido directo y efectivo pero respeta siempre las características específicas de cada proyecto.`,
      };

      const { data: result, error: invokeError } = await supabase.functions.invoke('generate-schedule', {
        body: requestData
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Error al generar el cronograma");
      }

      return result;
    },
    onSuccess: (schedule) => {
      toast({
        title: "¡Cronograma generado exitosamente!",
        description: `Se creó "${schedule.name}" con ${schedule.entries?.length || 0} entradas`,
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setLocation(`/schedules/${schedule.id}`);
    },
    onError: (error: any) => {
      console.error("Error generating schedule:", error);
      toast({
        title: "Error al generar cronograma",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: QuickCalendarFormData) => {
    setIsGenerating(true);
    try {
      await generateScheduleMutation.mutateAsync(data);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="container mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="mb-2 hover:bg-white/50 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-gradient">Calendario Rápido</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Genera cronogramas optimizados por IA en segundos. Ideal para sprints y campañas ágiles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Formulario Principal */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="glass-card border-0 shadow-premium overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Configuración del Sprint
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Proyecto */}
                      <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">Proyecto</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 input-premium">
                                  <SelectValue placeholder="Selecciona un proyecto" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {projects && projects.length > 0 ? (
                                  projects.map((project: any) => (
                                    <SelectItem key={project.id} value={project.id.toString()}>
                                      {project.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-projects" disabled>
                                    No hay proyectos disponibles
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Duración */}
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">Duración</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 input-premium">
                                  <SelectValue placeholder="Selecciona duración" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {durationOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className="font-medium">{option.label}</span>
                                    <span className="ml-2 text-muted-foreground text-xs hidden sm:inline">
                                      - {option.desc}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Fecha de inicio */}
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-base font-medium">Fecha de Inicio</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 w-full pl-3 text-left font-normal input-premium",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP", { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className="rounded-md border shadow-lg"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Especificaciones adicionales */}
                    <FormField
                      control={form.control}
                      name="specifications"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">Instrucciones Específicas (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ej: Enfocarse en la promoción de verano, usar tono energético, incluir llamadas a la acción claras..."
                              className="min-h-[120px] resize-none input-premium text-base"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Botón de envío */}
                    <Button
                      type="submit"
                      className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <div className="flex items-center gap-3">
                          <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Generando tu cronograma con IA...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Rocket className="h-5 w-5 animate-pulse" />
                          <span>Generar Calendario Ahora</span>
                        </div>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Informativo */}
          <div className="lg:col-span-4 space-y-6">
            {/* Feature Cards */}
            <div className="grid gap-4">
              <Card className="glass-card border-0 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Ultrarrápido</h3>
                    <p className="text-sm text-muted-foreground">Generación completa en menos de 2 minutos.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">IA Avanzada</h3>
                    <p className="text-sm text-muted-foreground">Contenido optimizado por Gemini 3 Pro.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <LayoutTemplate className="h-5 w-5 text-primary/90 dark:text-primary/80" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Estructurado</h3>
                    <p className="text-sm text-muted-foreground">Formato listo para publicar y compartir.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparison Card */}
            <Card className="glass-card border-0 shadow-premium bg-gradient-to-br from-slate-900 to-slate-800 text-foreground">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ¿Por qué usar Quick Mode?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300 text-sm">
                  Perfecto cuando necesitas resultados inmediatos sin configuraciones complejas. La IA tomará decisiones inteligentes basadas en tu proyecto.
                </p>
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-slate-400 mb-2">¿Necesitas más control?</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLocation("/calendar-creator")}
                    className="w-full bg-muted/80 hover:bg-white/20 text-foreground border-0"
                  >
                    Ir al Modo Avanzado
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}