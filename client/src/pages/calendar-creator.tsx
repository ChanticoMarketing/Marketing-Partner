// ===== IMPORTACIONES PRINCIPALES =====
// React hooks para estado y efectos
import { useState, useEffect } from "react";
// Zod para validación de esquemas
import { z } from "zod";
// React Hook Form para manejo de formularios
import { useForm } from "react-hook-form";
// Resolver de Zod para React Hook Form
import { zodResolver } from "@hookform/resolvers/zod";
// TanStack Query para manejo de datos del servidor
import { useQuery, useMutation } from "@tanstack/react-query";
// Hook para notificaciones toast
import { useToast } from "@/hooks/use-toast";
// Utilidades para peticiones API y cliente de query
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
// Hook para navegación
import { useLocation } from "wouter";
// Componente personalizado para entrada de fechas
import { DateInput } from "@/components/ui/date-input";

// ===== IMPORTACIONES DE ICONOS =====
// Iconos de Lucide React para la interfaz
import {
  AlertCircle, // Icono de alerta
  ArrowDown, // Flecha hacia abajo
  ArrowRight, // Flecha hacia la derecha
  ArrowUp, // Flecha hacia arriba
  BarChart, // Icono de gráfico de barras
  Calendar as CalendarIcon2, // Icono de calendario (alias)
  CalendarIcon, // Icono de calendario
  Check, // Icono de check/confirmación
  Clock, // Icono de reloj
  Download, // Icono de descarga
  HelpCircle, // Icono de ayuda
  Info, // Icono de información
  Moon, // Icono de luna (modo oscuro)
  MoreHorizontal, // Icono de más opciones
  Plus, // Icono de suma/agregar
  Save, // Icono de guardar
  Settings2, // Icono de configuración
  Sparkles, // Icono de chispas (IA)
  Sun, // Icono de sol (modo claro)
  Sunset, // Icono de atardecer
  Trash, // Icono de basura/eliminar
  X, // Icono de cerrar
  Lightbulb // Icono de ideas
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

// Define interfaces
interface Project {
  id: number;
  name: string;
  client: string;
}

// Define supported platforms and content types
const PLATFORMS = [
  {
    id: 'instagram', name: 'Instagram', color: 'bg-pink-500',
    contentTypes: ['photo', 'carousel', 'reel', 'story']
  },
  {
    id: 'facebook', name: 'Facebook', color: 'bg-blue-600',
    contentTypes: ['photo', 'carousel', 'video', 'text', 'event']
  },
  {
    id: 'twitter', name: 'Twitter', color: 'bg-sky-500',
    contentTypes: ['text', 'photo', 'video']
  },
  {
    id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-700',
    contentTypes: ['text', 'photo', 'article', 'video']
  },
  {
    id: 'tiktok', name: 'TikTok', color: 'bg-neutral-800',
    contentTypes: ['video']
  },
  {
    id: 'youtube', name: 'YouTube', color: 'bg-red-600',
    contentTypes: ['video', 'short']
  },
  {
    id: 'pinterest', name: 'Pinterest', color: 'bg-red-500',
    contentTypes: ['pin', 'idea']
  },
];

// Mapa de emojis para tipos de contenido
const CONTENT_TYPE_EMOJIS: Record<string, string> = {
  photo: '📷',
  carousel: '📱',
  reel: '🎬',
  story: '⭐',
  video: '🎥',
  text: '📝',
  event: '📅',
  article: '📰',
  pin: '📌',
  idea: '💡',
  short: '⏱️',
};

const contentTypeSchema = z.object({
  type: z.string(),
  quantity: z.number().min(1).max(30)
});

const platformConfigSchema = z.object({
  platformId: z.string(),
  contentTypes: z.array(contentTypeSchema),
  customInstructions: z.string().optional(),
  followProjectSpecs: z.boolean().default(false)
});

const formSchema = z.object({
  projectId: z.string({
    required_error: "Por favor selecciona un proyecto",
  }),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  startDate: z.string({
    required_error: "Por favor selecciona una fecha de inicio",
  }),
  endDate: z.string({
    required_error: "Por favor selecciona una fecha de fin",
  }).optional(),
  periodType: z.enum(["quincenal", "mensual"]).default("quincenal"),
  specifications: z.string().optional(),
  additionalInstructions: z.string().optional(), // Nuevo campo de instrucciones adicionales
  aiModel: z.enum(["gemini-1.5-pro"]).default("gemini-1.5-pro"), // Forzamos siempre a usar Gemini
  advanced: z.object({
    includeCopyIn: z.boolean().default(true),
    includeCopyOut: z.boolean().default(true),
    includeHashtags: z.boolean().default(true),
    includeDesignInstructions: z.boolean().default(true),
  }),
  followSpecsDistribution: z.boolean().default(false),
  followSpecsContent: z.boolean().default(false),
  followSpecsPlatforms: z.boolean().default(false),
  postsDistribution: z.enum(["uniform", "frontloaded", "backloaded", "weekends", "weekdays"]).default("uniform"),
  platforms: z.array(platformConfigSchema).min(1, "Debes seleccionar al menos una plataforma")
});

type FormValues = z.infer<typeof formSchema>;

function StrategyContextCard({ projectId }: { projectId: string }) {
  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, analysis:analysis_results(*)")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return fromDb("projects", data);
    },
    enabled: !!projectId
  });

  if (!project) return null;

  const analysis = Array.isArray(project.analysis) ? project.analysis[0] ?? {} : project.analysis ?? {};
  const hasStrategy = analysis.mission || analysis.buyerPersona || analysis.brandTone;

  return (
    <Card className="bg-primary/5 border-primary/20 mt-4">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wide">
          <Sparkles className="h-4 w-4" />
          Contexto de Estrategia (Brand Brain)
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-3 px-4 pb-4">
        {hasStrategy ? (
          <>
            <div className="grid gap-1">
              <span className="font-bold text-[10px] uppercase text-primary/70 tracking-wider">Buyer Persona</span>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{analysis.buyerPersona || "No definido"}</p>
            </div>
            <div className="grid gap-1">
              <span className="font-bold text-[10px] uppercase text-primary/70 tracking-wider">Tono de Voz</span>
              <Badge variant="outline" className="w-fit border-primary/30 text-primary capitalize">{analysis.brandTone || "No definido"}</Badge>
            </div>
            <div className="grid gap-1">
              <span className="font-bold text-[10px] uppercase text-primary/70 tracking-wider">Misión</span>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-1">{analysis.mission || "No definida"}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-primary bg-primary/10 p-2 rounded">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <p className="text-xs">Faltan datos clave de estrategia. La IA generará contenido genérico sin personalidad.</p>
            </div>
            <a href={`/projects/${projectId}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              Completar Estrategia ahora <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CalendarCreator() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTab, setSelectedTab] = useState("general");

  // Estados para las preferencias avanzadas de distribución
  const [planificationType, setPlanificationType] = useState("auto");
  const [timezone, setTimezone] = useState("UTC-6");
  const [dayPriorities, setDayPriorities] = useState<Record<string, string>>({
    "L": "media",
    "M": "baja",
    "X": "media",
    "J": "baja",
    "V": "media",
    "S": "alta",
    "D": "alta"
  });
  const [publicationTimes, setPublicationTimes] = useState([
    { time: "12:00", days: "todos" },
    { time: "18:30", days: "L,X,V" },
    { time: "11:00", days: "S,D" }
  ]);
  // Convertir fechas iniciales de string a objetos Date
  const initialExcludedDates = ["15/05/2025", "24/05/2025", "01/06/2025"];
  const initialDateObjects = initialExcludedDates.map(dateStr => {
    const [day, month, year] = dateStr.split('/').map(num => parseInt(num, 10));
    return new Date(year, month - 1, day); // Mes es base 0 en JavaScript
  });

  const [excludedDates, setExcludedDates] = useState(initialExcludedDates);
  const [distributionType, setDistributionType] = useState("equilibrada");
  const [distributionIntensity, setDistributionIntensity] = useState(50);

  // Estados para las opciones específicas de planificación
  const [selectedDays, setSelectedDays] = useState<string[]>(["L", "X", "V"]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [newPublicationTime, setNewPublicationTime] = useState("12:00");
  const [newPublicationDays, setNewPublicationDays] = useState("todos");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExclusionDatePicker, setShowExclusionDatePicker] = useState(false);
  const [exclusionDates, setExclusionDates] = useState<Date[]>(initialDateObjects);

  interface ContentIdea {
    title: string;
    objective: string;
    rationale: string;
    platform: string;
  }

  // Estado para los bloques de tiempo seleccionados
  const [selectedTimeBlocks, setSelectedTimeBlocks] = useState<string[]>([
    "mediodia", "tarde", "tarde-noche"
  ]);

  // Estados para el flujo iterativo de conceptos
  const [showConceptsDialog, setShowConceptsDialog] = useState(false);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [concepts, setConcepts] = useState<ContentIdea[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]); // Guardamos titulos para identificar

  // Función para alternar la selección de un bloque de tiempo
  const toggleTimeBlock = (blockId: string) => {
    setSelectedTimeBlocks(prev => {
      if (prev.includes(blockId)) {
        // Si ya está seleccionado, lo quitamos
        return prev.filter(id => id !== blockId);
      } else {
        // Si no está seleccionado, lo añadimos
        return [...prev, blockId];
      }
    });
  };

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray<Project>("projects", data);
    },
  });

  // Create form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      specifications: "",
      additionalInstructions: "", // Valor por defecto para instrucciones adicionales
      periodType: "quincenal", // Por defecto usamos periodo quincenal
      aiModel: "gemini-1.5-pro", // Forzamos el uso de Gemini
      advanced: {
        includeCopyIn: true,
        includeCopyOut: true,
        includeHashtags: true,
        includeDesignInstructions: true,
      },
      followSpecsDistribution: false,
      followSpecsContent: false,
      followSpecsPlatforms: false,
      postsDistribution: "uniform",
      platforms: []
    }
  });

  // Initialize selected platforms when form values change
  useEffect(() => {
    const platforms = form.watch('platforms');
    setSelectedPlatforms(platforms.map(p => p.platformId));
  }, [form.watch('platforms')]);

  // Handle form submission

  const handleGenerateConcepts = async () => {
    const values = form.getValues();
    if (!values.projectId) {
      toast({ title: "Error", description: "Por favor selecciona un proyecto primero", variant: "destructive" });
      setSelectedTab("general");
      return;
    }

    try {
      setIsGeneratingConcepts(true);
      setShowConceptsDialog(true);
      setConcepts([]); // Clear previous

      const { data, error } = await supabase.functions.invoke('generate-concepts', {
        body: {
          projectId: parseInt(values.projectId),
          amount: 12,
          additionalInstructions: values.additionalInstructions
        }
      });

      if (error) throw new Error("Error generating concepts");

      setConcepts(data);
      // Select all by default
      setSelectedConcepts(data.map((c: any) => c.title));
      toast({ title: "Ideas generadas", description: "Revisa y selecciona los conceptos para el calendario." });

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron generar ideas", variant: "destructive" });
      setShowConceptsDialog(false);
    } finally {
      setIsGeneratingConcepts(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    console.log("Formulario enviado:", values);

    // Verificar plataformas manualmente solo si no está activo "Seguir especificaciones del proyecto"
    if (selectedPlatforms.length === 0 && !values.followSpecsPlatforms) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos una plataforma",
        variant: "destructive",
      });
      setSelectedTab("platforms");
      return;
    }

    const startDate = new Date(values.startDate);

    // Calcular automáticamente la fecha de fin según el periodo seleccionado
    const endDate = new Date(startDate);

    // Ajustar la fecha según el tipo de periodo seleccionado
    if (values.periodType === "mensual") {
      // Para un periodo mensual, agregamos 30 días desde la fecha de inicio
      endDate.setDate(startDate.getDate() + 30); // 31 días en total (día inicial + 30 días)
    } else {
      // Para un periodo quincenal, agregamos 14 días desde la fecha de inicio
      endDate.setDate(startDate.getDate() + 14); // 15 días en total (día inicial + 14 días)
    }

    // Actualizar el valor en el formulario para que sea visible para el usuario
    if (values.endDate) {
      form.setValue('endDate', endDate.toISOString().split('T')[0], { shouldValidate: true });
    }

    toast({
      title: `Periodo ${values.periodType}`,
      description: `Se generará un calendario desde ${startDate.toLocaleDateString()} hasta ${endDate.toLocaleDateString()}`,
    });

    try {
      setIsGenerating(true);

      // Invoke edge function to create schedule
      const { data, error } = await supabase.functions.invoke('generate-schedule', {
        body: {
          ...values,
          projectId: parseInt(values.projectId),
          endDate: values.endDate || endDate.toISOString().split('T')[0],
          isAdvanced: true
        }
      });

      if (error) {
        throw new Error('Error al crear el calendario');
      }

      // Invalidate schedules cache to refresh lists
      queryClient.invalidateQueries({ queryKey: ["projects", values.projectId, "schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "recent"] });

      // Show success message
      toast({
        title: "¡Calendario creado!",
        description: `Se ha creado el calendario "${data.name}" con éxito.`,
      });

      // Redirect to schedule detail page
      // Usamos setLocation de Wouter en lugar de window.location para evitar DOMException
      setLocation(`/schedules/${data.id}`);

    } catch (error: any) {
      console.error('Error creating schedule:', error);

      // Extraer mensaje de error detallado si está disponible
      let errorMessage = "Ocurrió un error al crear el calendario. Por favor, inténtalo de nuevo.";

      if (error.response) {
        const responseData = error.response.data;

        // Comprobar si tenemos un mensaje específico del servidor
        if (responseData && responseData.message) {
          errorMessage = responseData.message;
        }

        // Manejo especial basado en códigos de estado
        if (error.response.status === 503) {
          errorMessage = "Servicio de IA temporalmente no disponible. Por favor intenta nuevamente en unos minutos.";
        } else if (error.response.status === 429) {
          errorMessage = "Hemos alcanzado el límite de generaciones. Por favor espera unos minutos antes de intentar crear otro calendario.";
        } else if (error.response.status === 401) {
          errorMessage = "Error en la configuración del servicio de IA. Por favor contacta al administrador.";
        }
      } else if (error instanceof Error) {
        // Si es un error estándar de JavaScript, usar su mensaje
        errorMessage = error.message;
      }

      toast({
        title: "Error al generar calendario",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle platform selection
  const handleTogglePlatform = (platformId: string) => {
    // Si está activado "Seguir especificaciones del proyecto", no permitimos cambios
    if (form.watch('followSpecsPlatforms')) {
      toast({
        title: "Acción bloqueada",
        description: "No puedes modificar las plataformas mientras 'Seguir especificaciones del proyecto' esté activado.",
        variant: "destructive",
      });
      return;
    }

    const platforms = form.getValues('platforms');

    if (selectedPlatforms.includes(platformId)) {
      // Remove platform
      const updatedPlatforms = platforms.filter(p => p.platformId !== platformId);
      form.setValue('platforms', updatedPlatforms, { shouldValidate: true });
    } else {
      // Add platform with default content types
      const platform = PLATFORMS.find(p => p.id === platformId);
      const defaultContentTypes = platform?.contentTypes.map(type => ({
        type,
        quantity: 0 // Comenzamos con 0 para permitir que el usuario decida qué tipos quiere incluir
      })) || [];

      form.setValue('platforms', [
        ...platforms,
        {
          platformId,
          contentTypes: defaultContentTypes,
          customInstructions: "",
          followProjectSpecs: false
        }
      ], { shouldValidate: true });
    }
  };

  // Handle content type quantity change
  const handleContentTypeQuantityChange = (platformId: string, contentType: string, quantity: number) => {
    // Si está activado "Seguir especificaciones del proyecto", no permitimos cambios
    if (form.watch('followSpecsContent')) {
      toast({
        title: "Acción bloqueada",
        description: "No puedes modificar el contenido mientras 'Seguir especificaciones del proyecto' esté activado.",
        variant: "destructive",
      });
      return;
    }

    const platforms = form.getValues('platforms');
    const platformIndex = platforms.findIndex(p => p.platformId === platformId);

    if (platformIndex === -1) return;

    const platform = platforms[platformIndex];
    const contentTypeIndex = platform.contentTypes.findIndex(ct => ct.type === contentType);

    if (contentTypeIndex === -1) return;

    // Update quantity
    const updatedPlatforms = [...platforms];
    updatedPlatforms[platformIndex] = {
      ...platform,
      contentTypes: [
        ...platform.contentTypes.slice(0, contentTypeIndex),
        {
          ...platform.contentTypes[contentTypeIndex],
          quantity
        },
        ...platform.contentTypes.slice(contentTypeIndex + 1)
      ]
    };

    form.setValue('platforms', updatedPlatforms, { shouldValidate: true });
  };

  // Manejadores para opciones avanzadas de distribución
  const handlePlanificationTypeChange = (value: string) => {
    setPlanificationType(value);
    // Actualizar el valor en el formulario si es necesario
    toast({
      title: "Tipo de planificación cambiado",
      description: `Se ha seleccionado: ${value}`,
    });
  };

  const handleTimezoneChange = (value: string) => {
    setTimezone(value);
    toast({
      description: `Zona horaria cambiada a: ${value}`,
    });
  };

  const handleDayPriorityChange = (day: string, priority: string) => {
    setDayPriorities(prev => ({
      ...prev,
      [day]: priority
    }));
    // Mostrar feedback visual
    toast({
      description: `Prioridad de ${day} cambiada a: ${priority}`,
    });
  };

  const handleAddPublicationTime = () => {
    // Añadir hora y días seleccionados
    if (newPublicationTime) {
      const newTime = { time: newPublicationTime, days: newPublicationDays };
      setPublicationTimes(prev => [...prev, newTime]);
      toast({
        description: "Horario de publicación añadido",
      });
      // Reiniciar valores por defecto
      setNewPublicationTime("12:00");
      setNewPublicationDays("todos");
    }
  };

  const handleRemovePublicationTime = (index: number) => {
    setPublicationTimes(prev => prev.filter((_, i) => i !== index));
    toast({
      description: "Horario de publicación eliminado",
    });
  };

  // Manejador para controlar la visibilidad del selector de fechas de exclusión

  const handleAddExcludedDate = () => {
    // Alternar visibilidad del calendario
    setShowExclusionDatePicker(!showExclusionDatePicker);

    // Mostrar mensaje de ayuda cuando se abre el selector
    if (!showExclusionDatePicker) {
      toast({
        description: "Selecciona una o varias fechas para excluir del calendario",
      });
    }
  };

  const handleRemoveExcludedDate = (index: number) => {
    // Remover del array de strings
    const newExcludedDates = [...excludedDates];
    const removedDate = newExcludedDates.splice(index, 1)[0];
    setExcludedDates(newExcludedDates);

    // También debemos remover del array de objetos Date
    // Convertimos la fecha de string a Date para poder encontrarla
    const dateParts = removedDate.split('/').map(part => parseInt(part, 10));
    const dateToRemove = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);

    // Filtramos las fechas y mantenemos todas excepto la que queremos eliminar
    setExclusionDates(prevDates =>
      prevDates.filter(date =>
        !(date.getDate() === dateToRemove.getDate() &&
          date.getMonth() === dateToRemove.getMonth() &&
          date.getFullYear() === dateToRemove.getFullYear())
      )
    );

    toast({
      description: "Fecha eliminada de exclusiones",
    });
  };

  const handleDistributionTypeChange = (value: string) => {
    setDistributionType(value);
    toast({
      description: `Tipo de distribución cambiado a: ${value}`,
    });
  };

  const handleDistributionIntensityChange = (value: number[]) => {
    setDistributionIntensity(value[0]);
    // Actualizar el valor en el formulario
    toast({
      description: `Intensidad de distribución: ${value[0]}%`,
    });
  };

  return (
    <div className="container mx-auto py-10">
      <div className="bg-card border-border rounded-xl border-border/50 overflow-hidden relative">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -mr-20 -mt-20 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -ml-20 -mb-20 blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shadow-md">
                <CalendarIcon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
                  Creación <span className="text-primary">Avanzada</span>
                </h1>
                <p className="text-muted-foreground tracking-wide mt-1">
                  Configura un calendario detallado con opciones personalizadas para cada plataforma.
                </p>
              </div>
            </div>
            <Badge variant="outline" id="period-badge" className="px-4 py-1.5 bg-primary/10 border-primary/30 text-primary uppercase tracking-wider font-bold">
              Quincenal
            </Badge>
          </div>
        </div>

        <div className="p-6 relative z-10">
          <Form {...form}>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault(); // Evitar envío predeterminado del formulario
              return false; // No hacer nada, ya que el botón tiene su propio manejador
            }}>
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 mb-8 bg-muted/30 border border-border p-1 rounded-lg h-auto">
                  <TabsTrigger value="general" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground py-2.5 uppercase tracking-wide text-xs font-bold transition-all">
                    General
                  </TabsTrigger>
                  <TabsTrigger value="distribution" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground py-2.5 uppercase tracking-wide text-xs font-bold transition-all">
                    Distribución
                  </TabsTrigger>
                  <TabsTrigger value="platforms" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground py-2.5 uppercase tracking-wide text-xs font-bold transition-all">
                    Plataformas
                  </TabsTrigger>
                  <TabsTrigger value="content" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground py-2.5 uppercase tracking-wide text-xs font-bold transition-all">
                    Contenido
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground py-2.5 uppercase tracking-wide text-xs font-bold transition-all">
                    Avanzado
                  </TabsTrigger>
                </TabsList>

                {/* Tab: General */}
                <TabsContent value="general" className="space-y-6 p-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs">Seleccionar Proyecto</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              disabled={projectsLoading}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 bg-muted/50 border-border text-foreground hover:border-primary/50 focus:ring-primary/50 transition-all duration-200">
                                  <SelectValue placeholder="Elige un proyecto" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-black/90 border-border text-foreground backdrop-blur-xl">
                                {projects?.map((project: Project) => (
                                  <SelectItem
                                    key={project.id}
                                    value={project.id.toString()}
                                    className="focus:bg-primary/20 focus:text-primary text-muted-foreground cursor-pointer"
                                  >
                                    {project.name} - {project.client}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs">Nombre del Calendario</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: Calendario Mensual Q2"
                                className="h-11 bg-muted/50 border-border text-foreground placeholder:text-gray-600 focus:border-primary/50 focus:ring-primary/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="periodType"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs">Tipo de Periodo</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);

                                // Actualizar el texto de la badge en la cabecera
                                const badgeElement = document.getElementById('period-badge');
                                if (badgeElement) {
                                  badgeElement.textContent = value === "mensual" ? "Mensual" : "Quincenal";
                                }

                                // Mostrar notificación
                                toast({
                                  description: `Tipo de periodo cambiado a: ${value === "mensual" ? "Mensual (31 días)" : "Quincenal (15 días)"}`,
                                });
                              }}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 bg-muted/50 border-border text-foreground hover:border-primary/50 focus:ring-primary/50 transition-all duration-200">
                                  <SelectValue placeholder="Selecciona el tipo de periodo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-black/90 border-border text-foreground backdrop-blur-xl">
                                <SelectItem value="quincenal" className="focus:bg-primary/20 focus:text-primary text-muted-foreground cursor-pointer">Quincenal (15 días)</SelectItem>
                                <SelectItem value="mensual" className="focus:bg-primary/20 focus:text-primary text-muted-foreground cursor-pointer">Mensual (31 días)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs text-muted-foreground">
                              El tipo de periodo determina la duración del calendario generado.
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs">Fecha de Inicio</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Seleccionar fecha"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs">Fecha de Fin (opcional)</FormLabel>
                              <FormControl>
                                <DateInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Seleccionar fecha"
                                />
                              </FormControl>
                              <FormDescription className="text-xs flex items-center gap-1.5 text-primary/70 font-medium">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Automático según periodo.
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="specifications"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs">Especificaciones Generales</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe las características generales del calendario, temas principales, etc."
                                  className="min-h-[220px] bg-muted/50 border-border text-foreground placeholder:text-gray-600 focus:border-primary/50 focus:ring-primary/50 transition-all duration-200 resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                Las instrucciones específicas para cada red social se pueden configurar en la pestaña "Contenido".
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        {/* Strategy Context Card */}
                        {form.watch('projectId') && (
                          <StrategyContextCard projectId={form.watch('projectId')} />
                        )}

                        {/* Campo para instrucciones adicionales a la IA */}
                        <FormField
                          control={form.control}
                          name="additionalInstructions"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-primary font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Instrucciones adicionales para la IA
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Instrucciones específicas para ajustar el tono, estilo o estructura de las publicaciones generadas por la IA"
                                  className="min-h-[150px] bg-muted/50 border-border text-foreground placeholder:text-gray-600 focus:border-primary/50 focus:ring-primary/50 transition-all duration-200 resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                <Info className="h-4 w-4 text-primary" />
                                Estas instrucciones ayudarán a la IA a generar contenido más personalizado.
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Distribution */}
                <TabsContent value="distribution" className="space-y-6 p-1">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3v18h18" />
                              <path d="M18 17V9" />
                              <path d="M13 17V5" />
                              <path d="M8 17v-3" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold uppercase tracking-wide text-foreground">Distribución de Publicaciones</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="follow-specs-distribution"
                            checked={form.watch('followSpecsDistribution')}
                            onCheckedChange={(checked) => {
                              // Actualizamos el valor en el formulario
                              form.setValue('followSpecsDistribution', !!checked, { shouldValidate: true });

                              // Mostrar notificación
                              toast({
                                description: `${checked ? "Seguirá" : "No seguirá"} las especificaciones del proyecto para la distribución`,
                              });
                            }}
                            className="h-4 w-4 rounded-sm cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border bg-muted/30"
                          />
                          <Label
                            htmlFor="follow-specs-distribution"
                            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                          >
                            Seguir especificaciones del proyecto
                          </Label>
                        </div>
                      </div>

                      {/* Aquí agregamos una nota informativa cuando está activado "Seguir especificaciones" */}
                      {form.watch('followSpecsDistribution') && (
                        <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
                          <p className="text-sm text-primary">
                            <strong>Importante:</strong> Las opciones de distribución se configurarán automáticamente según las especificaciones del proyecto. Cualquier ajuste manual será ignorado.
                          </p>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="postsDistribution"
                        render={({ field }) => (
                          <FormItem className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                              <div
                                className={`relative rounded-xl border p-4 transition-all duration-300 ${!form.watch('followSpecsDistribution') ? 'cursor-pointer hover:border-primary/50 group' : 'cursor-not-allowed opacity-50'}
                                  ${field.value === 'uniform'
                                    ? 'bg-primary/10 border-primary shadow-md'
                                    : 'bg-card border-border border-border/50'
                                  }`}
                                onClick={() => !form.watch('followSpecsDistribution') && field.onChange('uniform')}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  <div className="h-12 w-32 bg-muted/30 rounded-md overflow-hidden relative border border-border/50">
                                    <div className="flex absolute inset-0 items-end pb-1 px-1 gap-0.5">
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className={`font-bold uppercase tracking-wider text-xs ${field.value === 'uniform' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>Uniforme</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Distribución equitativa</p>
                                  </div>
                                </div>
                                {field.value === 'uniform' && (
                                  <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              <div
                                className={`relative rounded-xl border p-4 transition-all duration-300 ${!form.watch('followSpecsDistribution') ? 'cursor-pointer hover:border-primary/50 group' : 'cursor-not-allowed opacity-50'}
                                  ${field.value === 'frontloaded'
                                    ? 'bg-primary/10 border-primary shadow-md'
                                    : 'bg-card border-border border-border/50'
                                  }`}
                                onClick={() => !form.watch('followSpecsDistribution') && field.onChange('frontloaded')}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  <div className="h-12 w-32 bg-muted/30 rounded-md overflow-hidden relative border border-border/50">
                                    <div className="flex absolute inset-0 items-end pb-1 px-1 gap-0.5">
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[50%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[30%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[20%] bg-primary/80 rounded-sm"></div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className={`font-bold uppercase tracking-wider text-xs ${field.value === 'frontloaded' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>Mayor al inicio</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Concentración inicial</p>
                                  </div>
                                </div>
                                {field.value === 'frontloaded' && (
                                  <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              <div
                                className={`relative rounded-xl border p-4 transition-all duration-300 ${!form.watch('followSpecsDistribution') ? 'cursor-pointer hover:border-primary/50 group' : 'cursor-not-allowed opacity-50'}
                                  ${field.value === 'backloaded'
                                    ? 'bg-primary/10 border-primary shadow-md'
                                    : 'bg-card border-border border-border/50'
                                  }`}
                                onClick={() => !form.watch('followSpecsDistribution') && field.onChange('backloaded')}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  <div className="h-12 w-32 bg-muted/30 rounded-md overflow-hidden relative border border-border/50">
                                    <div className="flex absolute inset-0 items-end pb-1 px-1 gap-0.5">
                                      <div className="flex-1 h-[20%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[30%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[40%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[50%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className={`font-bold uppercase tracking-wider text-xs ${field.value === 'backloaded' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>Mayor al final</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Concentración final</p>
                                  </div>
                                </div>
                                {field.value === 'backloaded' && (
                                  <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              <div
                                className={`relative rounded-xl border p-4 transition-all duration-300 ${!form.watch('followSpecsDistribution') ? 'cursor-pointer hover:border-primary/50 group' : 'cursor-not-allowed opacity-50'}
                                  ${field.value === 'weekends'
                                    ? 'bg-primary/10 border-primary shadow-md'
                                    : 'bg-card border-border border-border/50'
                                  }`}
                                onClick={() => !form.watch('followSpecsDistribution') && field.onChange('weekends')}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  <div className="h-12 w-32 bg-muted/30 rounded-md overflow-hidden relative border border-border/50">
                                    <div className="flex absolute inset-0 items-end pb-1 px-1 gap-0.5">
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className={`font-bold uppercase tracking-wider text-xs ${field.value === 'weekends' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>Fines de semana</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Sábados y domingos</p>
                                  </div>
                                </div>
                                {field.value === 'weekends' && (
                                  <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              <div
                                className={`relative rounded-xl border p-4 transition-all duration-300 ${!form.watch('followSpecsDistribution') ? 'cursor-pointer hover:border-primary/50 group' : 'cursor-not-allowed opacity-50'}
                                  ${field.value === 'weekdays'
                                    ? 'bg-primary/10 border-primary shadow-md'
                                    : 'bg-card border-border border-border/50'
                                  }`}
                                onClick={() => !form.watch('followSpecsDistribution') && field.onChange('weekdays')}
                              >
                                <div className="flex flex-col items-center gap-3">
                                  <div className="h-12 w-32 bg-muted/30 rounded-md overflow-hidden relative border border-border/50">
                                    <div className="flex absolute inset-0 items-end pb-1 px-1 gap-0.5">
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[60%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                      <div className="flex-1 h-[25%] bg-primary/80 rounded-sm"></div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className={`font-bold uppercase tracking-wider text-xs ${field.value === 'weekdays' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>Días laborables</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Lunes a viernes</p>
                                  </div>
                                </div>
                                {field.value === 'weekdays' && (
                                  <div className="absolute top-2 right-2 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Para mantener compatibilidad con el formulario */}
                            <div className="hidden">
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="uniform">Uniforme</SelectItem>
                                  <SelectItem value="frontloaded">Mayor al inicio</SelectItem>
                                  <SelectItem value="backloaded">Mayor al final</SelectItem>
                                  <SelectItem value="weekends">Fines de semana</SelectItem>
                                  <SelectItem value="weekdays">Días laborables</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-4">
                              <Alert className="bg-primary/5 border-primary/20">
                                <AlertCircle className="h-4 w-4 text-primary" />
                                <AlertTitle className="text-primary font-bold uppercase tracking-wide text-xs">Distribución de publicaciones</AlertTitle>
                                <AlertDescription className="text-muted-foreground text-xs mt-1">
                                  Esta configuración determina cómo se distribuirán las publicaciones durante el periodo especificado. Escoge el patrón que mejor se adapte a tu estrategia de contenido.
                                </AlertDescription>
                              </Alert>

                              {/* Vista previa del calendario */}
                              <div className="bg-card border-border border border-border/50 rounded-xl p-6">
                                <h4 className="font-bold uppercase tracking-wider text-xs mb-4 flex items-center gap-2 text-foreground">
                                  <CalendarIcon className="h-4 w-4 text-primary" />
                                  Simulación de distribución
                                </h4>

                                <div className="grid grid-cols-7 gap-1 mb-2">
                                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
                                    <div
                                      key={i}
                                      className="text-center text-[10px] font-bold uppercase tracking-wider py-1 text-muted-foreground"
                                    >
                                      {day}
                                    </div>
                                  ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                  {/* Simulación de 4 semanas (28 días) */}
                                  {Array.from({ length: 28 }).map((_, i) => {
                                    const dayIndex = i;
                                    const weekDay = i % 7; // 0=L, 1=M, ..., 6=D
                                    const weekNumber = Math.floor(i / 7); // 0, 1, 2, 3
                                    const isWeekend = weekDay >= 5; // Si es sábado o domingo

                                    // Determinamos si hay publicación según el patrón
                                    let hasPost = false;
                                    let postSize = 'small'; // small, medium, large

                                    // Distribución Uniforme - un post cada 3-4 días aproximadamente
                                    if (field.value === 'uniform') {
                                      // Aproximadamente 8 posts en el mes (2 por semana)
                                      hasPost = [1, 4, 8, 11, 15, 18, 22, 25].includes(dayIndex);
                                      postSize = 'medium';
                                    }
                                    // Mayor al inicio - concentración al principio del mes
                                    else if (field.value === 'frontloaded') {
                                      if (weekNumber === 0) {
                                        // 4 posts en primera semana
                                        hasPost = [0, 2, 4, 6].includes(dayIndex);
                                        postSize = 'large';
                                      } else if (weekNumber === 1) {
                                        // 2 posts en segunda semana
                                        hasPost = [8, 11].includes(dayIndex);
                                        postSize = 'medium';
                                      } else if (weekNumber === 2 || weekNumber === 3) {
                                        // 1 post por semana restante
                                        hasPost = dayIndex === 16 || dayIndex === 23;
                                        postSize = 'small';
                                      }
                                    }
                                    // Mayor al final - concentración al final del mes
                                    else if (field.value === 'backloaded') {
                                      if (weekNumber === 3) {
                                        // 4 posts en última semana
                                        hasPost = [21, 23, 25, 27].includes(dayIndex);
                                        postSize = 'large';
                                      } else if (weekNumber === 2) {
                                        // 2 posts en penúltima semana
                                        hasPost = [15, 18].includes(dayIndex);
                                        postSize = 'medium';
                                      } else if (weekNumber === 0 || weekNumber === 1) {
                                        // 1 post por semana al inicio
                                        hasPost = dayIndex === 2 || dayIndex === 9;
                                        postSize = 'small';
                                      }
                                    }
                                    // Fines de semana - concentración en sábados y domingos
                                    else if (field.value === 'weekends') {
                                      if (isWeekend) {
                                        // Todos los fines de semana
                                        hasPost = true;
                                        postSize = 'large';
                                      } else {
                                        // Algunos días entre semana
                                        hasPost = [2, 10, 16, 24].includes(dayIndex);
                                        postSize = 'small';
                                      }
                                    }
                                    // Días laborables - concentración de lunes a viernes
                                    else if (field.value === 'weekdays') {
                                      if (!isWeekend) {
                                        // Días laborables seleccionados
                                        hasPost = [0, 3, 7, 11, 14, 17, 21, 24].includes(dayIndex);
                                        postSize = 'large';
                                      } else {
                                        // Algunos fines de semana
                                        hasPost = [5, 19].includes(dayIndex);
                                        postSize = 'small';
                                      }
                                    }

                                    // Estilos según si hay publicación y tamaño
                                    let borderColor = '';
                                    let bgColor = '';
                                    let dotColor = '';
                                    let sizeClass = '';

                                    if (hasPost) {
                                      if (postSize === 'small') {
                                        bgColor = 'bg-primary/10';
                                        borderColor = 'border-primary/20';
                                        dotColor = 'bg-primary/60';
                                        sizeClass = 'w-1.5 h-1.5';
                                      } else if (postSize === 'medium') {
                                        bgColor = 'bg-primary/20';
                                        borderColor = 'border-primary/30';
                                        dotColor = 'bg-primary/80';
                                        sizeClass = 'w-2 h-2';
                                      } else { // large
                                        bgColor = 'bg-primary/30';
                                        borderColor = 'border-primary/40';
                                        dotColor = 'bg-primary';
                                        sizeClass = 'w-2.5 h-2.5';
                                      }
                                    } else {
                                      bgColor = isWeekend ? 'bg-muted' : 'bg-transparent';
                                      borderColor = 'border-border/50';
                                    }

                                    return (
                                      <div
                                        key={i}
                                        className={`relative h-10 border rounded-md ${bgColor} ${borderColor} transition-colors flex items-center justify-center`}
                                      >
                                        <span className={`text-xs font-medium ${hasPost ? 'text-foreground' : 'text-gray-600'}`}>
                                          {dayIndex + 1}
                                        </span>

                                        {hasPost && (
                                          <div className={`absolute bottom-1 ${sizeClass} rounded-full ${dotColor} shadow-md`} />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    Publicaciones simuladas: <span className="text-foreground">{field.value === 'uniform' ? '8' :
                                      field.value === 'frontloaded' || field.value === 'backloaded' ? '8' :
                                        field.value === 'weekends' ? '12' : '10'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-primary shadow-md" />
                                      <span className="text-xs text-muted-foreground">Publicación</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Opciones avanzadas de distribución */}
                              <div className={`bg-card border-border border border-border/50 rounded-xl p-6 ${form.watch('followSpecsDistribution') ? 'opacity-60 pointer-events-none' : ''}`}>
                                <h4 className="font-bold uppercase tracking-wider text-xs mb-6 flex items-center gap-2 text-foreground">
                                  <Settings2 className="h-4 w-4 text-primary" />
                                  Preferencias de distribución avanzadas
                                </h4>

                                <div className="space-y-5">
                                  {/* Días de publicación */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Publicar en estos días
                                      </h5>
                                      <div className="relative group">
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                        <div className="absolute right-0 w-64 p-2 mt-2 text-xs bg-black/90 text-muted-foreground rounded-md shadow-lg border border-border hidden group-hover:block z-50 backdrop-blur-xl">
                                          Marca los días en que deseas publicar. Las publicaciones se distribuirán entre los días seleccionados.
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                      {[
                                        { id: "L", label: "Lunes" },
                                        { id: "M", label: "Martes" },
                                        { id: "X", label: "Miércoles" },
                                        { id: "J", label: "Jueves" },
                                        { id: "V", label: "Viernes" },
                                        { id: "S", label: "Sábado" },
                                        { id: "D", label: "Domingo" }
                                      ].map((day) => (
                                        <div key={day.id} className="flex items-center space-x-2 bg-muted/30 border border-border/50 rounded px-2 py-1.5 hover:border-primary/30 transition-colors">
                                          <Checkbox
                                            id={`day-${day.id}`}
                                            checked={selectedDays.includes(day.id)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                const newSelectedDays = [...selectedDays, day.id];
                                                setSelectedDays(newSelectedDays);
                                                console.log("Días seleccionados:", newSelectedDays);
                                              } else {
                                                const newSelectedDays = selectedDays.filter(d => d !== day.id);
                                                setSelectedDays(newSelectedDays);
                                                console.log("Días seleccionados:", newSelectedDays);
                                              }
                                            }}
                                            className="h-4 w-4 rounded-sm cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border"
                                          />
                                          <Label
                                            htmlFor={`day-${day.id}`}
                                            className="text-sm font-medium text-muted-foreground cursor-pointer"
                                          >
                                            {day.label}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>

                                    {selectedDays.length === 0 && (
                                      <div className="flex items-center text-xs text-primary mt-2 bg-primary/10 border border-primary/20 rounded-md p-2">
                                        <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                                        <span>Selecciona al menos un día para publicar</span>
                                      </div>
                                    )}

                                    {selectedDays.length > 0 && (
                                      <div className="mt-3 bg-muted/30 border border-border/50 rounded-md p-3">
                                        <div className="text-xs text-muted-foreground flex items-center mb-2 uppercase tracking-wider font-bold">
                                          <CalendarIcon className="h-3.5 w-3.5 mr-1.5 text-primary" />
                                          <span>Vista previa de distribución:</span>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1">
                                          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
                                            <div
                                              key={day}
                                              className={`text-center py-1 text-[10px] font-bold rounded-sm transition-colors ${selectedDays.includes(day)
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : 'bg-muted text-gray-600 border border-border/50'
                                                }`}
                                            >
                                              {day}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Sección de zona horaria */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Zona horaria para publicaciones
                                      </h5>
                                    </div>

                                    <Select
                                      value={timezone}
                                      onValueChange={handleTimezoneChange}
                                      defaultValue="UTC-6"
                                    >
                                      <SelectTrigger className="w-full h-9 text-xs bg-card border-border border-border text-foreground focus:ring-primary/50">
                                        <SelectValue placeholder="Selecciona zona horaria" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-card border-border border-border text-foreground">
                                        <SelectItem value="UTC-8" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC-8 (Pacífico EE.UU.)</SelectItem>
                                        <SelectItem value="UTC-7" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC-7 (Montaña EE.UU.)</SelectItem>
                                        <SelectItem value="UTC-6" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC-6 (México/Centro EE.UU.)</SelectItem>
                                        <SelectItem value="UTC-5" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC-5 (Colombia/Este EE.UU.)</SelectItem>
                                        <SelectItem value="UTC-3" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC-3 (Argentina/Brasil)</SelectItem>
                                        <SelectItem value="UTC+0" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC+0 (Reino Unido)</SelectItem>
                                        <SelectItem value="UTC+1" className="text-xs hover:bg-primary/20 focus:bg-primary/20 focus:text-foreground">UTC+1 (España/Europa Central)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Bloques horarios para publicaciones */}
                                  <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Bloques horarios para publicar
                                      </h5>
                                      <div className="relative group">
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                        <div className="absolute right-0 w-64 p-2 mt-2 text-xs bg-black/90 text-muted-foreground rounded-md shadow-lg border border-border hidden group-hover:block z-50 backdrop-blur-xl">
                                          Selecciona los bloques de horas en los que prefieres publicar. Las publicaciones se distribuirán dentro de estos horarios.
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      {[
                                        { id: "manana", label: "Mañana", hours: "6-9h", icon: "☀️" },
                                        { id: "media-manana", label: "Media mañana", hours: "9-12h", icon: "🌤️" },
                                        { id: "mediodia", label: "Mediodía", hours: "12-15h", icon: "☀️" },
                                        { id: "tarde", label: "Tarde", hours: "15-18h", icon: "🌇" },
                                        { id: "tarde-noche", label: "Tarde-noche", hours: "18-21h", icon: "🌆" },
                                        { id: "noche", label: "Noche", hours: "21-24h", icon: "🌙" }
                                      ].map((block) => {
                                        // Obtener el estado de selección del estado local
                                        const isSelected = selectedTimeBlocks.includes(block.id);

                                        return (
                                          <div
                                            key={block.id}
                                            className={`
                                              flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all duration-300
                                              border 
                                              ${isSelected
                                                ? 'bg-primary/10 border-primary shadow-md'
                                                : 'bg-card border-border border-border/50 hover:border-primary/30 hover:bg-muted'
                                              }
                                            `}
                                            onClick={() => {
                                              // Actualizar el estado de selección
                                              toggleTimeBlock(block.id);
                                              console.log(`Toggled ${block.id}`);
                                            }}
                                          >
                                            <div className={`
                                              h-9 w-9 rounded-md flex items-center justify-center text-xl transition-colors
                                              ${isSelected
                                                ? 'bg-primary/20 text-foreground'
                                                : 'bg-muted/30 text-muted-foreground'
                                              }
                                            `}>
                                              {block.icon}
                                            </div>
                                            <div className="flex-grow">
                                              <div className={`text-sm font-bold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {block.label}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {block.hours}
                                              </div>
                                            </div>
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={(checked) => {
                                                // Actualizar el estado de selección cuando se cambia el checkbox
                                                toggleTimeBlock(block.id);
                                                console.log(`Toggled checkbox for ${block.id}: ${checked}`);
                                              }}
                                              className="h-4 w-4 cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border bg-muted/30"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="flex items-center justify-between bg-primary/5 rounded-md p-3 border border-primary/10">
                                      <div className="flex items-start gap-2">
                                        <Clock className="h-4 w-4 text-primary mt-0.5" />
                                        <div>
                                          <div className="text-sm font-bold text-primary uppercase tracking-wide">Distribución inteligente</div>
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            La IA distribuirá publicaciones en los horarios seleccionados para maximizar engagement
                                          </div>
                                        </div>
                                      </div>
                                      <Switch
                                        checked={true}
                                        onCheckedChange={(checked) => {
                                          console.log(`Distribución inteligente: ${checked ? 'activada' : 'desactivada'}`);
                                        }}
                                        className="data-[state=checked]:bg-primary cursor-pointer border-border"
                                      />
                                    </div>
                                  </div>

                                  {/* Días de mayor actividad */}
                                  <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Días de mayor actividad
                                      </h5>
                                      <div className="relative group">
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                        <div className="absolute right-0 w-64 p-2 mt-2 text-xs bg-black/90 text-muted-foreground rounded-md shadow-lg border border-border hidden group-hover:block z-50 backdrop-blur-xl">
                                          Marca los días más importantes para tu audiencia. Se publicará con mayor frecuencia en estos días.
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-2">
                                      {[
                                        { id: "L", label: "Lunes", fullName: "Lunes" },
                                        { id: "M", label: "Martes", fullName: "Martes" },
                                        { id: "X", label: "Miércoles", fullName: "Miércoles" },
                                        { id: "J", label: "Jueves", fullName: "Jueves" },
                                        { id: "V", label: "Viernes", fullName: "Viernes" },
                                        { id: "S", label: "Sábado", fullName: "Sábado" },
                                        { id: "D", label: "Domingo", fullName: "Domingo" }
                                      ].map((day) => {
                                        // En una implementación real, esto estaría conectado al estado
                                        const priority = dayPriorities[day.id] || "ninguna";

                                        return (
                                          <div key={day.id} className="relative">
                                            <div
                                              className={`
                                                flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all duration-300
                                                ${priority === "alta"
                                                  ? "bg-primary/20 border border-primary shadow-md"
                                                  : priority === "media"
                                                    ? "bg-primary/10 border border-primary/50"
                                                    : priority === "baja"
                                                      ? "bg-muted border border-border"
                                                      : "bg-card border-border border border-border/50 hover:border-primary/30"
                                                }
                                              `}
                                              onClick={() => {
                                                // Rotación de prioridades: ninguna -> baja -> media -> alta -> ninguna
                                                const nextPriority =
                                                  priority === "ninguna" ? "baja" :
                                                    priority === "baja" ? "media" :
                                                      priority === "media" ? "alta" : "ninguna";

                                                // En una implementación real, llamar a la función de manejo
                                                handleDayPriorityChange(day.id, nextPriority);
                                              }}
                                            >
                                              <div className={`
                                                w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors
                                                ${priority === "alta"
                                                  ? "bg-primary text-primary-foreground shadow-md"
                                                  : priority === "media"
                                                    ? "bg-primary/60 text-foreground"
                                                    : priority === "baja"
                                                      ? "bg-muted/80 text-muted-foreground"
                                                      : "bg-muted/30 text-gray-600"
                                                }
                                              `}>
                                                {day.label[0]}
                                              </div>
                                              <span className={`text-[10px] font-bold uppercase tracking-wider ${priority !== "ninguna" ? 'text-foreground' : 'text-muted-foreground'}`}>{day.fullName}</span>

                                              {priority !== "ninguna" && (
                                                <div className="absolute -top-1 -right-1 rounded-full border border-black/50 shadow-sm">
                                                  <div className={`
                                                    w-4 h-4 rounded-full flex items-center justify-center
                                                    ${priority === "alta"
                                                      ? "bg-primary text-primary-foreground"
                                                      : priority === "media"
                                                        ? "bg-primary/80 text-foreground"
                                                        : "bg-gray-500 text-foreground"
                                                    }
                                                  `}>
                                                    {priority === "alta" && <ArrowUp className="h-2 w-2" />}
                                                    {priority === "media" && <MoreHorizontal className="h-2 w-2" />}
                                                    {priority === "baja" && <ArrowDown className="h-2 w-2" />}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-6 uppercase tracking-wider font-medium">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-primary shadow-md"></div>
                                        <span>Prioridad alta</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                                        <span>Prioridad media</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-white/20"></div>
                                        <span>Prioridad baja</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Fechas de exclusión */}
                                  <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Fechas de exclusión
                                      </h5>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs bg-card border-border border-border text-foreground hover:bg-primary/20 hover:border-primary/50 hover:text-primary transition-all"
                                        onClick={handleAddExcludedDate}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Añadir fecha
                                      </Button>
                                    </div>

                                    <div className="flex flex-col space-y-4">
                                      {/* Control de calendario para fechas de exclusión */}
                                      {showExclusionDatePicker && (
                                        <div className="p-3 bg-card border-border rounded-md border border-border shadow-xl backdrop-blur-xl">
                                          <Calendar
                                            mode="multiple"
                                            selected={exclusionDates}
                                            onSelect={(dates) => {
                                              // Verificamos que dates no sea null o undefined
                                              const newSelectedDates = dates || [];

                                              // Corregir el error off-by-one en cada fecha seleccionada
                                              const adjustedDates = newSelectedDates.map(date => {
                                                const newDate = new Date(date);
                                                newDate.setHours(12); // Establecer hora del día para evitar problemas de zona horaria
                                                return newDate;
                                              });

                                              setExclusionDates(adjustedDates);

                                              // Convertir las fechas seleccionadas a formato de cadena
                                              const formattedDates = adjustedDates.map(date =>
                                                format(date, "dd/MM/yyyy", { locale: es })
                                              );

                                              // Actualizar el estado de fechas excluidas
                                              setExcludedDates(formattedDates);

                                              // Mostrar confirmación al usuario
                                              if (newSelectedDates.length > 0) {
                                                toast({
                                                  description: `${newSelectedDates.length} fechas seleccionadas para exclusión`,
                                                });
                                              }
                                            }}
                                            className="rounded-md border border-border text-foreground"
                                            locale={es}
                                          />
                                        </div>
                                      )}

                                      {/* Lista de fechas excluidas */}
                                      <div className="flex flex-wrap gap-2">
                                        {excludedDates.map((date, index) => (
                                          <Badge
                                            key={index}
                                            variant="outline"
                                            className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1.5 hover:bg-red-500/20 transition-colors"
                                          >
                                            {date}
                                            <X
                                              className="h-3 w-3 cursor-pointer hover:text-red-300"
                                              onClick={() => handleRemoveExcludedDate(index)}
                                            />
                                          </Badge>
                                        ))}
                                        {excludedDates.length === 0 && (
                                          <p className="text-xs text-muted-foreground italic">
                                            No hay fechas excluidas. Haga clic en "Añadir fecha" para seleccionar días que desea evitar.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">
                                      No se programarán publicaciones en las fechas marcadas como exclusión.
                                    </p>
                                  </div>

                                  {/* Sección de vista previa */}
                                  <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Vista previa de distribución
                                      </h5>
                                      <div className="relative group">
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                        <div className="absolute right-0 w-64 p-2 mt-2 text-xs bg-black/90 text-muted-foreground rounded-md shadow-lg border border-border hidden group-hover:block z-50 backdrop-blur-xl">
                                          Esta vista previa muestra cómo se distribuirán las publicaciones según tus preferencias de días y horarios.
                                        </div>
                                      </div>
                                    </div>

                                    <div className="bg-card border-border rounded-md p-4 border border-border">
                                      {(() => {
                                        // Esta función se ejecuta en cada renderizado para calcular las variables del calendario
                                        const startDateStr = form.watch('startDate');
                                        const periodType = form.watch('periodType');
                                        const numDays = periodType === "mensual" ? 31 : 15;

                                        // Variables locales para los datos del calendario
                                        let calendarDays: Array<{ date: Date, dayOfMonth: number, dayOfWeek: number }> = [];
                                        let startDate = new Date();
                                        let endDate = new Date();
                                        let formattedStartDate = "Fecha no seleccionada";
                                        let formattedEndDate = "";

                                        // Verificar si hay una fecha de inicio válida
                                        if (startDateStr && isValid(new Date(startDateStr))) {
                                          try {
                                            startDate = new Date(startDateStr);
                                            formattedStartDate = format(startDate, "d 'de' MMMM", { locale: es });

                                            // Calcular la fecha de fin según el tipo de periodo
                                            endDate = new Date(startDate);
                                            endDate.setDate(startDate.getDate() + numDays - 1);
                                            formattedEndDate = format(endDate, "d 'de' MMMM", { locale: es });

                                            // Generar los días del calendario (limitado a un máximo razonable)
                                            const maxDays = Math.min(numDays, 40); // Limitamos a 40 días como seguridad
                                            for (let i = 0; i < maxDays; i++) {
                                              const day = new Date(startDate);
                                              day.setDate(startDate.getDate() + i);

                                              calendarDays.push({
                                                date: day,
                                                dayOfMonth: day.getDate(),
                                                dayOfWeek: day.getDay() === 0 ? 6 : day.getDay() - 1
                                              });
                                            }
                                          } catch (e) {
                                            console.error("Error generando calendario:", e);
                                          }
                                        }

                                        // Calcular el desplazamiento inicial para el primer día
                                        const initialOffset = calendarDays.length > 0 ? calendarDays[0].dayOfWeek : 0;

                                        return (
                                          <>
                                            <div className="text-xs text-muted-foreground flex items-center justify-between mb-3 uppercase tracking-wider font-bold">
                                              <div className="flex items-center gap-1.5">
                                                <CalendarIcon2 className="h-3.5 w-3.5 text-primary" />
                                                <span>Simulación calendario {form.watch('periodType') === "mensual" ? 'mensual (31 días)' : 'quincenal (15 días)'}</span>
                                              </div>
                                              <div className="font-medium text-foreground">
                                                {formattedStartDate} - {formattedEndDate}
                                              </div>
                                            </div>

                                            {/* Calendario simulado de días según periodo */}
                                            <div className="overflow-hidden rounded-md border border-border mb-3">
                                              {/* Encabezados de los días */}
                                              <div className="grid grid-cols-7 bg-black/60 border-b border-border">
                                                {["L", "M", "X", "J", "V", "S", "D"].map(day => (
                                                  <div key={day} className="text-center text-[10px] font-bold py-1.5 text-primary uppercase tracking-widest">
                                                    {day}
                                                  </div>
                                                ))}
                                              </div>

                                              {/* Celdas del calendario */}
                                              <div className="grid grid-cols-7 divide-x divide-y divide-white/5">
                                                {/* Celdas vacías para el desplazamiento inicial */}
                                                {Array.from({ length: initialOffset }).map((_, i) => (
                                                  <div
                                                    key={`empty-${i}`}
                                                    className="relative h-16 p-1 bg-muted/50"
                                                  />
                                                ))}

                                                {/* Celdas con días del calendario */}
                                                {calendarDays.map((calendarDay: { date: Date, dayOfMonth: number, dayOfWeek: number }, i: number) => {
                                                  const dayIndex = calendarDay.dayOfWeek;
                                                  const day = ["L", "M", "X", "J", "V", "S", "D"][dayIndex];
                                                  const priority = dayPriorities[day] || "ninguna";
                                                  const hasPosts = priority !== "ninguna";
                                                  const posts = priority === "alta" ? 2 : priority === "media" ? 1 : priority === "baja" ? 1 : 0;

                                                  // Verificar si es una fecha excluida
                                                  const formattedDay = format(calendarDay.date, "dd/MM/yyyy", { locale: es });
                                                  const isExcluded = excludedDates.includes(formattedDay);

                                                  return (
                                                    <div
                                                      key={`day-${i}`}
                                                      className={`
                                                        relative h-16 p-1 transition-colors
                                                        ${i === 0 ? "bg-primary/10 border border-primary/30" : ""}
                                                        ${hasPosts && !isExcluded ? "bg-muted/30" : "bg-muted/50"}
                                                        ${isExcluded ? "bg-red-500/10" : ""}
                                                      `}
                                                    >
                                                      <div className={`text-[10px] font-bold mb-2 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                                                        {calendarDay.dayOfMonth}
                                                        {i === 0 && <span className="ml-1 bg-primary/20 text-primary px-1 py-0.5 rounded text-[8px] uppercase tracking-wider border border-primary/30">Inicio</span>}
                                                      </div>

                                                      {/* Indicador de publicaciones */}
                                                      {posts > 0 && !isExcluded && (
                                                        <div className="absolute bottom-1 right-1 left-1">
                                                          <div className="flex flex-wrap gap-1 justify-end">
                                                            {Array.from({ length: posts }).map((_, j) => {
                                                              const platforms = ["instagram", "facebook", "twitter", "linkedin"];
                                                              const platform = platforms[Math.floor(Math.random() * platforms.length)];
                                                              const color =
                                                                platform === "instagram" ? "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.6)]" :
                                                                  platform === "facebook" ? "bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.6)]" :
                                                                    platform === "linkedin" ? "bg-blue-700 shadow-[0_0_6px_rgba(29,78,216,0.6)]" :
                                                                      "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)]";

                                                              return (
                                                                <div
                                                                  key={`post-${i}-${j}`}
                                                                  className={`w-2 h-2 rounded-full ${color}`}
                                                                  title={`Publicación en ${platform}`}
                                                                />
                                                              );
                                                            })}
                                                          </div>
                                                        </div>
                                                      )}

                                                      {/* Indicador de fecha excluida */}
                                                      {isExcluded && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                          <X className="h-8 w-8 text-red-500 dark:text-red-400" />
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}

                                                {/* Celdas vacías para completar la última semana */}
                                                {(() => {
                                                  const lastDayIndex = calendarDays.length > 0 ? calendarDays[calendarDays.length - 1].dayOfWeek : 0;
                                                  const remainingCells = 6 - lastDayIndex; // 6 es el índice del domingo

                                                  return Array.from({ length: remainingCells }).map((_, i) => (
                                                    <div
                                                      key={`remaining-${i}`}
                                                      className="relative h-16 p-1 bg-muted/50"
                                                    />
                                                  ));
                                                })()}
                                              </div>
                                            </div>
                                          </>
                                        );
                                      })()}

                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.6)]"></div>
                                            <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Instagram</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.6)]"></div>
                                            <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Facebook</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)]"></div>
                                            <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Twitter</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-blue-700 shadow-[0_0_6px_rgba(29,78,216,0.6)]"></div>
                                            <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">LinkedIn</span>
                                          </div>
                                        </div>
                                        <div>
                                          <span className="text-foreground font-bold uppercase tracking-wider">
                                            Total: {(() => {
                                              try {
                                                // Cálculo simplificado de publicaciones totales basado en días de la semana
                                                const startDateStr = form.watch('startDate');
                                                const periodType = form.watch('periodType');

                                                if (!startDateStr || !isValid(new Date(startDateStr))) {
                                                  return 0;
                                                }

                                                const numDays = periodType === "mensual" ? 31 : 15;
                                                let totalPosts = 0;
                                                const startDate = new Date(startDateStr);

                                                // Calculamos el total de publicaciones según los días de la semana seleccionados
                                                for (let i = 0; i < numDays; i++) {
                                                  const currentDate = new Date(startDate);
                                                  currentDate.setDate(startDate.getDate() + i);

                                                  // Convertimos el día de la semana al formato que usamos (L, M, X, J, V, S, D)
                                                  const weekdayNum = currentDate.getDay(); // 0 = domingo, 1 = lunes, ...
                                                  const weekdayIdx = weekdayNum === 0 ? 6 : weekdayNum - 1; // Convertir a 0 = lunes, 6 = domingo
                                                  const dayName = ["L", "M", "X", "J", "V", "S", "D"][weekdayIdx];

                                                  // Verificamos si es una fecha excluida
                                                  const formattedDay = format(currentDate, "dd/MM/yyyy", { locale: es });
                                                  const isExcluded = excludedDates.includes(formattedDay);

                                                  // Si el día tiene prioridad y no está excluido, agregamos publicaciones
                                                  if (!isExcluded && dayPriorities[dayName] && dayPriorities[dayName] !== "ninguna") {
                                                    totalPosts += dayPriorities[dayName] === "alta" ? 2 : 1;
                                                  }
                                                }

                                                return totalPosts;
                                              } catch (e) {
                                                console.error("Error calculando publicaciones:", e);
                                                return 0;
                                              }
                                            })()} publicaciones
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-md p-3 border border-primary/20 bg-primary/5">
                                      <div className="flex items-start">
                                        <AlertCircle className="h-4 w-4 text-primary mr-2 mt-0.5" />
                                        <div>
                                          <h6 className="text-sm font-bold text-primary uppercase tracking-wider">Distribución inteligente</h6>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            La IA analizará los mejores momentos para publicar en cada plataforma y distribuirá el contenido de manera óptima según las preferencias que has indicado.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Platforms */}
                <TabsContent value="platforms" className="space-y-6 p-1">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-primary/20 text-primary shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                        </svg>
                      </span>
                      <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Plataformas</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="follow-specs-platforms"
                        checked={form.watch('followSpecsPlatforms')}
                        onCheckedChange={(checked) => {
                          // Actualizamos el valor en el formulario
                          form.setValue('followSpecsPlatforms', !!checked, { shouldValidate: true });

                          // Mostrar notificación
                          toast({
                            description: `${checked ? "Seguirá" : "No seguirá"} las especificaciones del proyecto para las plataformas`,
                          });
                        }}
                        className="h-4 w-4 rounded-sm cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border bg-muted/30"
                      />
                      <Label
                        htmlFor="follow-specs-platforms"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Seguir especificaciones del proyecto
                      </Label>
                    </div>
                  </div>

                  {/* Mensaje informativo cuando está activado "Seguir especificaciones" */}
                  {form.watch('followSpecsPlatforms') && (
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4">
                      <p className="text-sm text-primary">
                        <strong className="uppercase tracking-wider">Importante:</strong> Las plataformas y su configuración se determinarán automáticamente según las especificaciones del proyecto. Se ignorarán las selecciones manuales.
                      </p>
                    </div>
                  )}

                  <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 ${form.watch('followSpecsPlatforms') ? 'opacity-60 pointer-events-none' : ''}`}>
                    {PLATFORMS.map((platform) => (
                      <div
                        key={platform.id}
                        onClick={() => handleTogglePlatform(platform.id)}
                        className={`
                          relative rounded-xl border p-4 flex flex-col items-center justify-center gap-2 
                          transition-all duration-300 cursor-pointer overflow-hidden
                          ${selectedPlatforms.includes(platform.id)
                            ? `bg-primary/10 border-primary shadow-md`
                            : `bg-card border-border border-border/50 hover:border-primary/30 hover:bg-muted`
                          }
                        `}
                      >
                        {/* Gradiente de fondo para efecto visual */}
                        <div className={`absolute inset-0 opacity-10 ${selectedPlatforms.includes(platform.id) ? 'opacity-20' : ''}`}>
                          <div className={`absolute inset-0 ${platform.color} opacity-10 blur-xl`}></div>
                        </div>

                        {/* Ícono y contenido */}
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <div className={`w-14 h-14 rounded-xl ${platform.color} flex items-center justify-center text-foreground shadow-md transform transition-transform duration-300 ${selectedPlatforms.includes(platform.id) ? 'scale-105 shadow-md' : ''}`}>
                            <span className="text-xl font-semibold">{platform.name.substring(0, 1)}</span>
                          </div>
                          <div className="text-center mt-1">
                            <p className="font-bold text-foreground text-sm uppercase tracking-wider">{platform.name}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <Badge variant="outline" className={`bg-opacity-20 text-[10px] px-2 py-0.5 uppercase tracking-wider ${selectedPlatforms.includes(platform.id) ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}>
                                {platform.contentTypes.length} {platform.contentTypes.length === 1 ? 'formato' : 'formatos'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Indicador de selección */}
                        {selectedPlatforms.includes(platform.id) && (
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-bl-lg rounded-tr-lg p-1 drop-shadow-md shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {selectedPlatforms.length === 0 && (
                    <Alert variant="destructive" className="mt-4 bg-red-500/10 text-red-400 border-red-500/20">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="font-bold uppercase tracking-wider">No hay plataformas seleccionadas</AlertTitle>
                      <AlertDescription className="text-xs">
                        Selecciona al menos una plataforma para crear el calendario.
                      </AlertDescription>
                    </Alert>
                  )}

                  {selectedPlatforms.length > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                      <Info className="h-4 w-4 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Ajusta el contenido de cada plataforma en la pestaña "Contenido".
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Content */}
                <TabsContent value="content" className="space-y-6 p-1">
                  {selectedPlatforms.length === 0 ? (
                    <Alert variant="default" className="mt-4 bg-muted text-muted-foreground border-border">
                      <Info className="h-4 w-4" />
                      <AlertTitle className="font-bold uppercase tracking-wider text-foreground">Configuración pendiente</AlertTitle>
                      <AlertDescription className="text-xs">
                        Primero selecciona las plataformas que deseas incluir en la pestaña "Plataformas".
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-primary/20 text-primary shadow-md">
                            <Sparkles className="h-5 w-5" />
                          </span>
                          <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Configuración de contenido por plataforma</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="follow-specs-content"
                            checked={form.watch('followSpecsContent')}
                            onCheckedChange={(checked) => {
                              // Actualizamos el valor en el formulario
                              form.setValue('followSpecsContent', !!checked, { shouldValidate: true });

                              // Mostrar notificación
                              toast({
                                description: `${checked ? "Seguirá" : "No seguirá"} las especificaciones del proyecto para el contenido`,
                              });
                            }}
                            className="h-4 w-4 rounded-sm cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border bg-muted/30"
                          />
                          <Label
                            htmlFor="follow-specs-content"
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Seguir especificaciones del proyecto
                          </Label>
                        </div>
                      </div>

                      {/* Mensaje informativo cuando está activado "Seguir especificaciones" */}
                      {form.watch('followSpecsContent') && (
                        <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4">
                          <p className="text-sm text-primary">
                            <strong className="uppercase tracking-wider">Importante:</strong> El contenido se generará automáticamente según las especificaciones del proyecto. Los ajustes manuales de cantidades y tipos serán ignorados.
                          </p>
                        </div>
                      )}

                      <Accordion type="multiple" className={`space-y-4 ${form.watch('followSpecsContent') ? 'opacity-60 pointer-events-none' : ''}`}>
                        {selectedPlatforms.map((platformId) => {
                          const platform = PLATFORMS.find(p => p.id === platformId);
                          const platformConfig = form.getValues('platforms').find(p => p.platformId === platformId);

                          if (!platform || !platformConfig) return null;

                          return (
                            <AccordionItem
                              key={platformId}
                              value={platformId}
                              className="border overflow-hidden rounded-lg border-border bg-card border-border"
                            >
                              <AccordionTrigger className={`px-4 py-3 hover:no-underline hover:bg-muted group`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg ${platform.color} flex items-center justify-center text-foreground shadow-md`}>
                                    {platform.name.substring(0, 1)}
                                  </div>
                                  <div className="text-left">
                                    <p className="font-bold text-foreground uppercase tracking-wider">{platform.name}</p>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                      {platformConfig.contentTypes.reduce((acc, ct) => acc + ct.quantity, 0)} publicaciones configuradas
                                    </p>
                                  </div>
                                </div>
                              </AccordionTrigger>

                              <AccordionContent className="px-4 pb-4 pt-2">
                                <div className="space-y-6">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Tipos de contenido</h4>
                                      <Badge
                                        variant="outline"
                                        className={`
                                          ${platformConfig.contentTypes.reduce((acc, ct) => acc + ct.quantity, 0) === 0
                                            ? "bg-muted text-muted-foreground border-border"
                                            : "bg-primary/10 text-primary border-primary/30"
                                          }
                                        `}
                                      >
                                        Cantidad total: {platformConfig.contentTypes.reduce((acc, ct) => acc + ct.quantity, 0)}
                                      </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {platformConfig.contentTypes.map((contentType) => (
                                        <div
                                          key={`${platformId}-${contentType.type}`}
                                          className="border rounded-lg p-3 space-y-2 bg-card border-border border-border hover:border-primary/30 transition-all shadow-md"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/20 text-primary">
                                                <span>{CONTENT_TYPE_EMOJIS[contentType.type]}</span>
                                              </div>
                                              <span className="text-sm font-bold capitalize text-foreground">{contentType.type}</span>
                                            </div>
                                            <Badge
                                              variant="outline"
                                              className={`px-1.5 ${contentType.quantity === 0
                                                ? "bg-muted border-border text-gray-600"
                                                : "bg-primary/20 border-primary/30 text-primary"
                                                }`}
                                            >
                                              {contentType.quantity}
                                            </Badge>
                                          </div>

                                          <div className="flex items-center gap-2 pt-1">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className={`h-8 w-8 rounded-lg ${form.watch('followSpecsContent') ? 'opacity-50 cursor-not-allowed' : 'bg-card border-border border-border hover:border-primary/30'}`}
                                              onClick={() => handleContentTypeQuantityChange(
                                                platformId,
                                                contentType.type,
                                                Math.max(0, contentType.quantity - 1)
                                              )}
                                              disabled={form.watch('followSpecsContent')}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                                              </svg>
                                            </Button>

                                            <div className="flex-1">
                                              <input
                                                type="range"
                                                min="0"
                                                max="30"
                                                value={contentType.quantity}
                                                onChange={(e) => handleContentTypeQuantityChange(
                                                  platformId,
                                                  contentType.type,
                                                  parseInt(e.target.value)
                                                )}
                                                className={`w-full h-2 rounded-lg appearance-none ${form.watch('followSpecsContent') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} bg-muted/30 accent-primary`}
                                                disabled={form.watch('followSpecsContent')}
                                              />
                                            </div>

                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className={`h-8 w-8 rounded-lg ${form.watch('followSpecsContent') ? 'opacity-50 cursor-not-allowed' : 'bg-card border-border border-border hover:border-primary/30'}`}
                                              onClick={() => handleContentTypeQuantityChange(
                                                platformId,
                                                contentType.type,
                                                Math.min(30, contentType.quantity + 1)
                                              )}
                                              disabled={form.watch('followSpecsContent')}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                                              </svg>
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <Separator className="bg-muted/80" />

                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="text-sm font-bold flex items-center gap-2 text-foreground uppercase tracking-wider">
                                        <span className={`h-4 w-4 rounded-full ${platform.color}`}></span>
                                        Instrucciones personalizadas para {platform.name}
                                      </h4>

                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          id={`follow-specs-${platformId}`}
                                          checked={platformConfig.followProjectSpecs || false}
                                          onCheckedChange={(checked) => {
                                            const platforms = form.getValues('platforms');
                                            const platformIndex = platforms.findIndex(p => p.platformId === platformId);

                                            if (platformIndex === -1) return;

                                            const updatedPlatforms = [...platforms];
                                            updatedPlatforms[platformIndex] = {
                                              ...platforms[platformIndex],
                                              followProjectSpecs: !!checked
                                            };

                                            form.setValue('platforms', updatedPlatforms, { shouldValidate: true });

                                            // Mostrar notificación
                                            toast({
                                              description: `${checked ? "Seguirá" : "No seguirá"} las especificaciones del proyecto para ${platform.name}`,
                                            });
                                          }}
                                          className="h-4 w-4 rounded-sm cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary border-border bg-muted/30"
                                        />
                                        <Label
                                          htmlFor={`follow-specs-${platformId}`}
                                          className="text-xs font-medium text-muted-foreground"
                                        >
                                          Seguir especificaciones del proyecto
                                        </Label>
                                      </div>
                                    </div>

                                    <div className="relative">
                                      <Textarea
                                        placeholder={`Instrucciones específicas para ${platform.name}. (Ej: tono de voz, requerimientos especiales, información de la estrategia, etc.)`}
                                        className="min-h-[120px] pr-10 border rounded-lg shadow-md transition-all bg-muted/50 border-border text-foreground placeholder:text-gray-600 focus:border-primary/50 resize-none"
                                        value={platformConfig.customInstructions || ''}
                                        onChange={(e) => {
                                          const platforms = form.getValues('platforms');
                                          const platformIndex = platforms.findIndex(p => p.platformId === platformId);

                                          if (platformIndex === -1) return;

                                          const updatedPlatforms = [...platforms];
                                          updatedPlatforms[platformIndex] = {
                                            ...platforms[platformIndex],
                                            customInstructions: e.target.value
                                          };

                                          form.setValue('platforms', updatedPlatforms, { shouldValidate: true });
                                        }}
                                      />
                                      <div className="absolute right-3 top-3 opacity-50 dark:opacity-30">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M12 20h9"></path>
                                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                        </svg>
                                      </div>
                                    </div>

                                    <Alert className="bg-primary/5 border-primary/20 py-2">
                                      <Info className="h-4 w-4 text-primary" />
                                      <AlertDescription className="text-xs text-muted-foreground">
                                        Estas instrucciones serán utilizadas por la IA para generar contenido específico para esta plataforma.
                                      </AlertDescription>
                                    </Alert>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Advanced */}
                <TabsContent value="advanced" className="space-y-6 p-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                      {/* La sección de selección de modelo de IA ha sido eliminada */}

                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium dark:text-foreground">Elementos de contenido</h3>
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="advanced.includeCopyIn"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20 bg-white dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:hover:border-[#65cef5]/40">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-slate-500 rounded transition-all"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium dark:text-foreground flex items-center gap-1">
                                  Incluir Copy In
                                  {field.value && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">Activo</span>}
                                </FormLabel>
                                <FormDescription className="text-xs dark:text-slate-400">
                                  Texto integrado dentro del diseño de la publicación
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="advanced.includeCopyOut"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20 bg-white dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:hover:border-[#65cef5]/40">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-slate-500 rounded transition-all"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium dark:text-foreground flex items-center gap-1">
                                  Incluir Copy Out
                                  {field.value && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">Activo</span>}
                                </FormLabel>
                                <FormDescription className="text-xs dark:text-slate-400">
                                  Texto para la descripción de la publicación
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="advanced.includeHashtags"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20 bg-white dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:hover:border-[#65cef5]/40">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-slate-500 rounded transition-all"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium dark:text-foreground flex items-center gap-1">
                                  Incluir Hashtags
                                  {field.value && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">Activo</span>}
                                </FormLabel>
                                <FormDescription className="text-xs dark:text-slate-400">
                                  Generar hashtags relevantes para cada publicación
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="advanced.includeDesignInstructions"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20 bg-white dark:bg-[#1e293b] dark:border-[#3e4a6d] dark:hover:border-[#65cef5]/40">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-slate-500 rounded transition-all"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium dark:text-foreground flex items-center gap-1">
                                  Incluir Instrucciones de Diseño
                                  {field.value && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">Activo</span>}
                                </FormLabel>
                                <FormDescription className="text-xs dark:text-slate-400">
                                  Generar indicaciones para el departamento de diseño
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Sugerencias</h3>
                      </div>

                      <ScrollArea className="h-[calc(100%-3rem)] pr-4">
                        <div className="space-y-4">
                          <Alert className="bg-primary/5 border-primary/20">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-primary font-bold uppercase tracking-wider">Mantén tus instrucciones claras</AlertTitle>
                            <AlertDescription className="text-muted-foreground text-xs">
                              Las instrucciones específicas para cada plataforma generarán mejor contenido. Sé detallado en tus requerimientos.
                            </AlertDescription>
                          </Alert>

                          <Alert className="bg-primary/5 border-primary/20">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-primary font-bold uppercase tracking-wider">Proporciona contexto</AlertTitle>
                            <AlertDescription className="text-muted-foreground text-xs">
                              Incluye información sobre tu marca, audiencia y objetivos en las instrucciones para obtener resultados más relevantes.
                            </AlertDescription>
                          </Alert>

                          <Alert className="bg-primary/5 border-primary/20">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-primary font-bold uppercase tracking-wider">Balancea los tipos de contenido</AlertTitle>
                            <AlertDescription className="text-muted-foreground text-xs">
                              Distribuye tus publicaciones entre diferentes formatos para mantener tu feed dinámico y atractivo.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between items-center border-t border-border p-6 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="bg-card border-border border-border text-foreground hover:bg-muted hover:text-primary transition-all"
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateConcepts}
                  disabled={isGenerating || isGeneratingConcepts}
                  className="mr-3 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Explorar Ideas (Paso 1)
                </Button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    // Función simplificada de envío
                    const values = form.getValues();

                    // Validaciones básicas
                    if (!values.projectId || !values.name || !values.startDate) {
                      toast({
                        title: "Error",
                        description: "Por favor completa todos los campos obligatorios",
                        variant: "destructive",
                      });
                      setSelectedTab("general");
                      return;
                    }

                    // Enviar formulario
                    onSubmit(values);
                  }}
                  className="rounded-md px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-bold uppercase tracking-wider flex items-center justify-center gap-2 h-10 shadow-md hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generando calendario...
                    </>
                  ) : (
                    <>
                      Crear Calendario <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </Form>

          {/* Dialogo de Conceptos */}
          <Dialog open={showConceptsDialog} onOpenChange={setShowConceptsDialog}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-neutral-900 border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Brainstorming: Ideas de Contenido
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Selecciona los conceptos que quieres desarrollar en el calendario. La IA generará el contenido completo basándose en tu selección.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {isGeneratingConcepts && concepts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground animate-pulse">Analizando estrategia y generando conceptos...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {concepts.map((concept, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if (selectedConcepts.includes(concept.title)) {
                            setSelectedConcepts(prev => prev.filter(t => t !== concept.title));
                          } else {
                            setSelectedConcepts(prev => [...prev, concept.title]);
                          }
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group ${selectedConcepts.includes(concept.title)
                          ? 'bg-primary/10 border-primary shadow-md'
                          : 'bg-muted/30 border-border/50 hover:border-border'
                          }`}
                      >
                        <div className="absolute top-3 right-3">
                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${selectedConcepts.includes(concept.title)
                            ? 'bg-primary border-primary'
                            : 'border-gray-500 group-hover:border-white'
                            }`}>
                            {selectedConcepts.includes(concept.title) && <Check className="h-3.5 w-3.5 text-black" />}
                          </div>
                        </div>

                        <h4 className="font-bold text-base pr-8 mb-2 text-foreground group-hover:text-primary transition-colors">{concept.title}</h4>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/80">{concept.platform}</Badge>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{concept.objective}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2 mt-2">
                            <span className="text-primary/60 font-bold uppercase text-[10px] block mb-1">Por qué funciona:</span>
                            {concept.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-border/50 pt-4 gap-2 sm:justify-between">
                <div className="text-xs text-muted-foreground flex items-center">
                  {selectedConcepts.length} ideas seleccionadas
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" type="button" onClick={() => setShowConceptsDialog(false)}>Cancelar</Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowConceptsDialog(false);
                      const currentInstructions = form.getValues('additionalInstructions') || "";
                      const conceptsText = selectedConcepts.length > 0
                        ? `\n\nDESARROLLA ESTOS TEMAS ESPECÍFICOS SELECCIONADOS POR EL USUARIO:\n${concepts
                          .filter(c => selectedConcepts.includes(c.title))
                          .map((c, i) => `${i + 1}. TÍTULO: "${c.title}"\n   OBJETIVO: ${c.objective}\n   JUSTIFICACIÓN: ${c.rationale}`)
                          .join('\n\n')
                        }`
                        : "";

                      form.setValue('additionalInstructions', currentInstructions + conceptsText);
                      toast({ title: "Conceptos aplicados", description: "Ahora puedes generar el calendario completo." });
                    }}
                    disabled={selectedConcepts.length === 0 || isGeneratingConcepts}
                  >
                    Confirmar selección
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </div >
  );
}
