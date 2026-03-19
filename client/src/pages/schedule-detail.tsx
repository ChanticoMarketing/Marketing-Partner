import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useEffect } from "react";
import { Schedule, ScheduleEntry } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Components
import { Loader2, Share2, Download, Copy, Clipboard, Calendar, Clock, ImageIcon, Save, MessageSquare, Edit, AlertCircle, CheckCircle, RefreshCw, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Interfaz para los comentarios de revisión
interface ReviewComments {
  generalComments: string;
  entryComments: Record<number, string>;
}

export default function ScheduleDetail({ id }: { id: number }) {
  const { toast } = useToast();
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<number | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState<string>("");
  const [isSavingComments, setIsSavingComments] = useState(false);
  
  // Estados para el modo de revisión
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewComments, setReviewComments] = useState<ReviewComments>({
    generalComments: "",
    entryComments: {}
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  // Estados para la selección de áreas a modificar
  const [selectedAreas, setSelectedAreas] = useState({
    titles: false,
    descriptions: false,
    content: false,
    copyIn: false,
    copyOut: false,
    designInstructions: false,
    platforms: false,
    hashtags: false
  });
  
  // Estados para las instrucciones específicas de cada área
  const [specificInstructions, setSpecificInstructions] = useState({
    titles: "",
    descriptions: "",
    content: "",
    copyIn: "",
    copyOut: "",
    designInstructions: "",
    platforms: "",
    hashtags: ""
  });
  
  // Fetch schedule data
  const { data: schedule, isLoading, error, refetch } = useQuery<Schedule & { entries: ScheduleEntry[] }>({
    queryKey: [`/api/schedules/${id}`],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Los datos siempre se consideran obsoletos
    // Aseguramos que se carguen los datos cada vez que se monta el componente
  });
  
  // Efecto para inicializar las instrucciones adicionales cuando se cargan los datos
  useEffect(() => {
    if (schedule) {
      setAdditionalInstructions(schedule.additionalInstructions || "");
    }
  }, [schedule]);
  
  // Función para generar placeholder dinámico según las áreas seleccionadas
  const getPlaceholderForSelectedAreas = () => {
    const selectedKeys = Object.keys(selectedAreas).filter(key => selectedAreas[key as keyof typeof selectedAreas]);
    const placeholders: Record<string, string> = {
      titles: "Haz los títulos más llamativos y dinámicos",
      descriptions: "Utiliza descripciones más persuasivas y emotivas",
      content: "Agrega más detalles y beneficios específicos",
      copyIn: "Simplifica el texto integrado para mayor impacto",
      copyOut: "Incluye más emojis en el texto descripción",
      designInstructions: "Especifica colores más vibrantes y modernos",
      platforms: "Adapta mejor a Instagram y Facebook",
      hashtags: "Agrega hashtags de temporada y trending"
    };
    
    if (selectedKeys.length === 0) return "Agrega instrucciones específicas...";
    if (selectedKeys.length === 1) return placeholders[selectedKeys[0]];
    
    return `Para ${selectedKeys.slice(0, -1).join(", ")} y ${selectedKeys.slice(-1)}: combina las mejoras necesarias`;
  };

  // Función para verificar si hay instrucciones válidas para regenerar
  const hasValidInstructions = () => {
    // Verificar si hay instrucciones generales
    if (additionalInstructions.trim()) return true;
    
    // Verificar si hay instrucciones específicas en alguna área seleccionada
    const hasSpecificInstructions = Object.entries(selectedAreas).some(([area, selected]) => {
      return selected && specificInstructions[area as keyof typeof specificInstructions]?.trim();
    });
    
    return hasSpecificInstructions;
  };
  
  // Mutation para generar imagen
  const generateImageMutation = useMutation({
    mutationFn: async (entryId: number) => {
      setIsGeneratingImage(entryId);
      const response = await apiRequest("POST", `/api/schedule-entries/${entryId}/generate-image`, {});
      return response.json();
    },
    onSuccess: (data) => {
      // Actualiza la caché para reflejar la nueva imagen
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${id}`] });
      
      toast({
        title: "Imagen generada",
        description: "La imagen de referencia ha sido generada correctamente",
      });
      
      setImageDialogOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Error al generar imagen",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGeneratingImage(null);
    }
  });

  // Formatear fecha
  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  };

  // Copiar texto al portapapeles
  const copyToClipboard = (text: string | null, description: string) => {
    if (!text) {
      toast({
        title: "Error al copiar",
        description: "No hay texto para copiar",
        variant: "destructive"
      });
      return;
    }
    navigator.clipboard.writeText(text);
    toast({
      title: "Texto copiado",
      description: `${description} copiado al portapapeles`,
    });
  };

  // Descargar la imagen
  const downloadImage = (url: string, title: string) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(err => {
        toast({
          title: "Error al descargar",
          description: "No se pudo descargar la imagen",
          variant: "destructive"
        });
      });
  };
  
  // Manejar la generación o visualización de la imagen
  const handleImageAction = (entry: ScheduleEntry) => {
    setSelectedEntry(entry);
    if (!entry.referenceImageUrl) {
      generateImageMutation.mutate(entry.id);
    } else {
      setImageDialogOpen(true);
    }
  };
  
  // Regenerar una imagen existente
  const handleRegenerateImage = () => {
    if (selectedEntry) {
      generateImageMutation.mutate(selectedEntry.id);
    }
  };
  
  // Mutation para guardar comentarios
  const updateCommentsMutation = useMutation({
    mutationFn: async ({ entryId, comments }: { entryId: number, comments: string }) => {
      const response = await apiRequest("PATCH", `/api/schedule-entries/${entryId}/comments`, { comments });
      return response.json();
    },
    onSuccess: () => {
      // Actualiza la caché para reflejar los nuevos comentarios
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${id}`] });
      
      toast({
        title: "Comentarios guardados",
        description: "Los comentarios se han guardado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al guardar comentarios",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSavingComments(false);
    }
  });
  
  // Actualizar comentarios
  const handleSaveComments = () => {
    if (!selectedEntry) {
      toast({
        title: "Error",
        description: "No hay entrada seleccionada para guardar comentarios",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Guardando comentarios para la entrada:", selectedEntry.id, "texto:", commentText);
    setIsSavingComments(true);
    updateCommentsMutation.mutate({
      entryId: selectedEntry.id,
      comments: commentText
    });
  };
  
  // Función para determinar el formato según la plataforma
  const getFormatByPlatform = (platform: string | null): string => {
    if (!platform) return 'Formato estándar';
    const formats: Record<string, string> = {
      'Instagram': 'Carrusel/Reels • 9:16 o 1:1',
      'Facebook': 'Imagen/Video • 16:9 o 1:1',
      'Twitter': 'Imagen/GIF • 16:9',
      'LinkedIn': 'Imagen/Artículo • 16:9 o 1:1',
      'TikTok': 'Video • 9:16 vertical',
      'YouTube': 'Video • 16:9 horizontal',
      'Pinterest': 'Pin • 2:3 vertical',
      'WhatsApp': 'Imagen/Video • 1:1 o 9:16'
    };
    
    return formats[platform] || 'Formato estándar';
  };
  
  // Funciones para el modo de revisión
  const handleEnterReviewMode = () => {
    // Inicializa el estado con los comentarios existentes
    if (schedule) {
      const initialEntryComments: Record<number, string> = {};
      schedule.entries.forEach(entry => {
        if (entry.comments) {
          initialEntryComments[entry.id] = entry.comments;
        }
      });
      
      setReviewComments({
        generalComments: schedule.additionalInstructions || "",
        entryComments: initialEntryComments
      });
    }
    setIsReviewMode(true);
  };
  
  const handleExitReviewMode = () => {
    setIsReviewMode(false);
  };
  
  const handleGeneralCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReviewComments(prev => ({
      ...prev,
      generalComments: e.target.value
    }));
  };
  
  const handleEntryCommentChange = (entryId: number, comment: string) => {
    setReviewComments(prev => ({
      ...prev,
      entryComments: {
        ...prev.entryComments,
        [entryId]: comment
      }
    }));
  };
  
  // Mutation para guardar comentarios en modo de revisión
  const submitReviewMutation = useMutation({
    mutationFn: async (data: { generalComments: string, entryComments: Record<number, string> }) => {
      // Primero actualizamos las instrucciones adicionales del cronograma
      const scheduleResponse = await apiRequest("PATCH", `/api/schedules/${id}/additional-instructions`, { 
        additionalInstructions: data.generalComments 
      });
      
      // Luego actualizamos los comentarios de cada entrada
      const entryPromises = Object.entries(data.entryComments).map(([entryId, comments]) => {
        return apiRequest("PATCH", `/api/schedule-entries/${entryId}/comments`, { comments });
      });
      
      await Promise.all(entryPromises);
      
      return scheduleResponse.json();
    },
    onSuccess: () => {
      // Actualiza la caché para reflejar los nuevos comentarios
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${id}`] });
      
      toast({
        title: "Revisión guardada",
        description: "Los comentarios de revisión se han guardado correctamente",
      });
      
      // Salir del modo de revisión
      setIsReviewMode(false);
    },
    onError: (error) => {
      toast({
        title: "Error al guardar revisión",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmittingReview(false);
    }
  });
  
  // Estado para las instrucciones adicionales
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("");
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  
  // Mutation para guardar instrucciones adicionales
  const saveInstructionsMutation = useMutation({
    mutationFn: async (instructions: string) => {
      const response = await apiRequest("PATCH", `/api/schedules/${id}/additional-instructions`, {
        additionalInstructions: instructions
      });
      return response.json();
    },
    onSuccess: () => {
      // Actualiza la caché para reflejar las nuevas instrucciones
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${id}`] });
      
      toast({
        title: "Instrucciones guardadas",
        description: "Las instrucciones adicionales para la IA se han guardado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al guardar instrucciones",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSavingInstructions(false);
    }
  });
  
  // Manejador para guardar instrucciones adicionales
  const handleSaveAdditionalInstructions = () => {
    setIsSavingInstructions(true);
    saveInstructionsMutation.mutate(additionalInstructions);
  };
  
  // Estado para la regeneración
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Mutation para regenerar el cronograma con las instrucciones adicionales
  const regenerateScheduleMutation = useMutation({
    mutationFn: async () => {
      // Enviamos una solicitud para regenerar el cronograma con las áreas seleccionadas e instrucciones específicas
      const response = await apiRequest("POST", `/api/schedules/${id}/regenerate`, {
        additionalInstructions,
        selectedAreas: Object.values(selectedAreas).some(Boolean) ? selectedAreas : null,
        specificInstructions: Object.values(selectedAreas).some(Boolean) ? specificInstructions : null
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Forzar actualización inmediata de los datos
      queryClient.setQueryData([`/api/schedules/${id}`], data);
      
      // Invalidar y refrescar todas las queries relacionadas
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/recent"] });
      
      // Forzar re-fetch inmediato para asegurar datos actualizados
      refetch();
      
      toast({
        title: "Cronograma regenerado",
        description: "El contenido se ha regenerado correctamente con las instrucciones proporcionadas",
      });
      
      // Salir del modo de revisión y limpiar selecciones
      setIsReviewMode(false);
      setSelectedAreas({
        titles: false,
        descriptions: false,
        content: false,
        copyIn: false,
        copyOut: false,
        designInstructions: false,
        platforms: false,
        hashtags: false
      });
      setSpecificInstructions({
        titles: "",
        descriptions: "",
        content: "",
        copyIn: "",
        copyOut: "",
        designInstructions: "",
        platforms: "",
        hashtags: ""
      });
    },
    onError: (error) => {
      toast({
        title: "Error al regenerar cronograma",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRegenerating(false);
    }
  });
  
  const handleSubmitReview = () => {
    setIsSubmittingReview(true);
    submitReviewMutation.mutate(reviewComments);
  };
  
  // Manejador para regenerar el cronograma
  const handleRegenerateSchedule = () => {
    // Confirmar con el usuario antes de regenerar
    if (window.confirm("¿Estás seguro de regenerar todo el cronograma? Este proceso reemplazará todas las entradas actuales con contenido nuevo basado en las instrucciones adicionales proporcionadas.")) {
      setIsRegenerating(true);
      regenerateScheduleMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="h-[80vh] w-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="h-[50vh] w-full flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-medium">Error al cargar el cronograma</h2>
        <p className="text-muted-foreground">
          No se pudo cargar la información del cronograma. Intente nuevamente más tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{schedule.name}</h1>
          <p className="text-muted-foreground mt-1">
            Fecha de inicio: {formatDate(schedule.startDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-lg gap-1 transition-all duration-200 shadow-sm hover:shadow border-amber-200 hover:border-primary/30 bg-primary/10 text-primary/90 hover:bg-primary/20 interactive-element dark:border-primary/90/30 dark:bg-primary/10 dark:text-amber-300 dark:hover:bg-primary/20"
            onClick={handleEnterReviewMode}
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            Revisar y Comentar
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.open(`/api/schedules/${id}/download?format=excel`, '_blank')}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.open(`/api/schedules/${id}/download?format=pdf`, '_blank')}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      </div>
      
      {/* Panel de instrucciones adicionales para la IA */}
      <Card className="shadow-sm border border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Sparkles className="h-5 w-5 text-primary/90 dark:text-primary/80" />
            Instrucciones adicionales para la IA
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300/80">
            Añade instrucciones específicas para guiar a la IA en la regeneración del contenido. Estas instrucciones se utilizarán cuando solicites regenerar el cronograma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Cuadros de selección para especificar qué modificar */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Selecciona qué elementos del cronograma deseas modificar:
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.titles}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, titles: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Títulos</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.descriptions}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, descriptions: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Descripciones</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.content}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, content: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Contenido</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.copyIn}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, copyIn: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Texto Integrado</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.copyOut}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, copyOut: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Texto Descripción</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.designInstructions}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, designInstructions: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Instrucciones de Diseño</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.platforms}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, platforms: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Plataformas</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.hashtags}
                    onChange={(e) => setSelectedAreas(prev => ({ ...prev, hashtags: e.target.checked }))}
                    className="rounded border-primary/30 text-primary/90 focus:ring-primary"
                  />
                  <span className="text-sm text-amber-700 dark:text-amber-300">Hashtags</span>
                </label>
              </div>
            </div>
            
            {/* Textareas específicos que aparecen cuando se selecciona cada área */}
            {selectedAreas.titles && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Títulos:
                </h4>
                <Textarea
                  value={specificInstructions.titles}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, titles: e.target.value }))}
                  placeholder="Ejemplo: 'Haz los títulos más llamativos y dinámicos', 'Incluye palabras de acción', 'Usa números cuando sea posible'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.descriptions && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Descripciones:
                </h4>
                <Textarea
                  value={specificInstructions.descriptions}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, descriptions: e.target.value }))}
                  placeholder="Ejemplo: 'Utiliza descripciones más persuasivas y emotivas', 'Enfócate en los beneficios', 'Sé más directo'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.content && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Contenido:
                </h4>
                <Textarea
                  value={specificInstructions.content}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Ejemplo: 'Agrega más detalles y beneficios específicos', 'Incluye testimonios', 'Más datos técnicos'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.copyIn && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Texto Integrado:
                </h4>
                <Textarea
                  value={specificInstructions.copyIn}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, copyIn: e.target.value }))}
                  placeholder="Ejemplo: 'Simplifica el texto integrado para mayor impacto', 'Usa frases más cortas', 'Más directo al grano'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.copyOut && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Texto Descripción:
                </h4>
                <Textarea
                  value={specificInstructions.copyOut}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, copyOut: e.target.value }))}
                  placeholder="Ejemplo: 'Incluye más emojis en el texto descripción', 'Haz preguntas para generar engagement', 'Más llamadas a la acción'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.designInstructions && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Instrucciones de Diseño:
                </h4>
                <Textarea
                  value={specificInstructions.designInstructions}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, designInstructions: e.target.value }))}
                  placeholder="Ejemplo: 'Especifica colores más vibrantes y modernos', 'Usa tipografías más llamativas', 'Añade elementos gráficos específicos'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.platforms && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Plataformas:
                </h4>
                <Textarea
                  value={specificInstructions.platforms}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, platforms: e.target.value }))}
                  placeholder="Ejemplo: 'Adapta mejor a Instagram y Facebook', 'Más contenido para LinkedIn', 'Enfoque en TikTok'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {selectedAreas.hashtags && (
              <div className="space-y-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Instrucciones específicas para Hashtags:
                </h4>
                <Textarea
                  value={specificInstructions.hashtags}
                  onChange={(e) => setSpecificInstructions(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="Ejemplo: 'Agrega hashtags de temporada y trending', 'Incluye más hashtags de nicho', 'Menos hashtags pero más específicos'..."
                  className="min-h-[80px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
                />
              </div>
            )}
            
            {/* Textarea general para instrucciones del cronograma completo */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Instrucciones generales para todo el cronograma:
              </h4>
              <Textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="Ejemplo: 'Utiliza un tono más formal', 'Incluye más emojis', 'Enfócate en los beneficios del producto', 'Agrega más hashtags relacionados con la temporada'..."
                className="min-h-[100px] border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground"
              />
            </div>
            <div className="flex justify-between">
              <Button 
                onClick={handleRegenerateSchedule}
                disabled={isRegenerating || !hasValidInstructions()}
                variant="outline"
                className="bg-amber-200 border-primary/30 text-amber-800 hover:bg-amber-300 hover:text-amber-900 dark:bg-amber-800/40 dark:border-amber-700/50 dark:text-amber-200 dark:hover:bg-amber-700/60"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Regenerar Cronograma
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleSaveAdditionalInstructions}
                disabled={isSavingInstructions || (schedule && additionalInstructions === (schedule.additionalInstructions || ''))}
                className="bg-primary/90 text-foreground hover:bg-amber-700 dark:bg-primary/90 dark:text-foreground dark:hover:bg-amber-700"
              >
                {isSavingInstructions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1.5" />
                    Guardar Instrucciones
                  </>
                )}
              </Button>
            </div>
            <div className="text-xs text-primary/90 dark:text-primary/80 space-y-1 mt-2">
              <p className="flex items-center">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Estas instrucciones serán utilizadas como guía para la IA cuando se regenere el cronograma.
              </p>
              {!additionalInstructions.trim() && (
                <p className="flex items-center text-red-500 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  Debes agregar instrucciones para poder regenerar el cronograma.
                </p>
              )}
              {additionalInstructions.trim().length > 0 && (
                <p className="flex items-center text-amber-700 dark:text-amber-300 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  ¡Importante! Al regenerar el cronograma, se reemplazarán todas las entradas actuales con nuevas basadas en estas instrucciones.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />
      
      {/* Modo de revisión */}
      {isReviewMode && (
        <div className="my-8 space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-100">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-1.5 rounded-full bg-amber-100 text-primary/90 dark:bg-amber-900/50 dark:text-amber-300">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">Modo de Revisión</h3>
                <p className="text-sm text-amber-700 dark:text-amber-200/80">
                  Puedes agregar comentarios generales o específicos para cada publicación. Estos comentarios serán utilizados para mejorar el cronograma.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Comentarios generales */}
              <div>
                <label htmlFor="general-comments" className="block text-sm font-medium text-amber-800 dark:text-amber-300 mb-1.5">
                  Comentarios Generales
                </label>
                <Textarea 
                  id="general-comments"
                  placeholder="Añade cualquier comentario general sobre el cronograma..."
                  value={reviewComments.generalComments}
                  onChange={handleGeneralCommentsChange}
                  rows={4}
                  className="w-full resize-none border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground dark:focus:border-primary/90 dark:focus:ring-primary/90"
                />
              </div>
              
              {/* Comentarios específicos para cada entrada */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Edit className="h-4 w-4" />
                  Comentarios Específicos por Publicación
                </h4>
                
                <Accordion type="single" collapsible className="w-full">
                  {schedule.entries.map((entry) => (
                    <AccordionItem 
                      key={entry.id} 
                      value={`entry-${entry.id}`}
                      className="border-amber-200 dark:border-amber-800/40"
                    >
                      <AccordionTrigger 
                        id={`entry-${entry.id}`} 
                        className="text-sm text-amber-800 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-left">
                          <span className="font-medium">{entry.title}</span>
                          <span className="text-xs opacity-80">{entry.platform} • {formatDate(entry.postDate)} • {entry.postTime}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Textarea 
                          id={`entry-${entry.id}-textarea`}
                          placeholder={`Comentarios para "${entry.title}"...`}
                          value={reviewComments.entryComments[entry.id] || ''}
                          onChange={(e) => handleEntryCommentChange(entry.id, e.target.value)}
                          rows={3}
                          className="w-full resize-none mt-2 border-primary/30 focus:border-primary focus:ring-primary dark:border-amber-800/50 dark:bg-[#1e293b] dark:text-foreground dark:focus:border-primary/90 dark:focus:ring-primary/90"
                        />
                        <div className="mt-2 text-xs text-amber-700 dark:text-primary/80/80">
                          <p>Puedes comentar sobre el título, texto, horario o cualquier otro aspecto de esta publicación.</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
            
            {/* Sección de regeneración */}
            <div className="bg-amber-100/80 border border-amber-200 rounded-md p-4 mt-6 dark:bg-amber-900/30 dark:border-amber-700/50">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                <RefreshCw className="h-4 w-4" />
                Regeneración de Contenido
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-200/80 mb-3">
                Puedes regenerar todo el contenido del cronograma utilizando las instrucciones adicionales como guía para el asistente de IA.
                Este proceso reemplazará todas las entradas actuales.
              </p>
              <Button 
                variant="outline" 
                onClick={handleRegenerateSchedule}
                disabled={isRegenerating || !reviewComments.generalComments.trim()}
                className="bg-amber-200 border-primary/30 text-amber-800 hover:bg-amber-300 hover:text-amber-900 dark:bg-amber-800/40 dark:border-amber-700/50 dark:text-amber-200 dark:hover:bg-amber-700/60"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Regenerar Cronograma
                  </>
                )}
              </Button>
              {!reviewComments.generalComments.trim() && (
                <p className="text-xs text-primary/90 dark:text-primary/80 mt-2">
                  Debes agregar instrucciones generales para poder regenerar el cronograma.
                </p>
              )}
            </div>

            {/* Botones de acción */}
            <div className="mt-5 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={handleExitReviewMode}
                className="border-primary/30 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800/40 dark:text-amber-300 dark:hover:bg-amber-900/30"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="bg-primary/90 text-foreground hover:bg-amber-700 dark:bg-primary/90 dark:text-foreground dark:hover:bg-amber-700"
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Enviar Comentarios
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Lista de entradas */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Entradas ({schedule.entries.length})</CardTitle>
              <CardDescription>
                Lista de publicaciones programadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {schedule.entries.map((entry) => (
                    <Card 
                      key={entry.id}
                      className={`cursor-pointer transition-all ${selectedEntry?.id === entry.id ? 'border-primary' : ''}`}
                      onClick={() => {
                        setSelectedEntry(entry);
                        // Inicializar el campo de comentarios cuando se selecciona una entrada
                        setCommentText(entry.comments || '');
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-sm">{entry.title}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                <Share2 className="w-3 h-3 mr-1" />
                                {entry.platform}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(entry.postDate)}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {entry.postTime}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded-sm">
                                {getFormatByPlatform(entry.platform)}
                              </span>
                            </div>
                          </div>
                          {entry.referenceImageUrl && (
                            <img 
                              src={entry.referenceImageUrl} 
                              alt={entry.title}
                              className="w-14 h-14 object-cover rounded-md"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Detalle de entrada seleccionada */}
        <div className="md:col-span-2">
          {selectedEntry ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedEntry.title}</CardTitle>
                    <CardDescription>
                      {selectedEntry.platform} • {formatDate(selectedEntry.postDate)} • {selectedEntry.postTime}
                    </CardDescription>
                  </div>
                  {selectedEntry.referenceImageUrl && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadImage(selectedEntry.referenceImageUrl!, selectedEntry.title)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Imagen
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">Formato de Publicación</h3>
                      <Badge variant="outline">{getFormatByPlatform(selectedEntry.platform)}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">Texto en Diseño</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(selectedEntry.copyIn, "Texto en diseño")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap">{selectedEntry.copyIn}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">Texto Descripción</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(selectedEntry.copyOut, "Texto descripción")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap">{selectedEntry.copyOut}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">Instrucciones de Diseño</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(selectedEntry.designInstructions, "Instrucciones de diseño")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap">{selectedEntry.designInstructions}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">Hashtags</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(selectedEntry.hashtags, "Hashtags")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap">{selectedEntry.hashtags}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Imagen Referencia</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={isGeneratingImage === selectedEntry.id}
                      onClick={handleRegenerateImage}
                    >
                      {isGeneratingImage === selectedEntry.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Generando...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          <span>Regenerar Imagen</span>
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {selectedEntry.referenceImageUrl ? (
                    <div className="w-full flex justify-center">
                      <img 
                        src={selectedEntry.referenceImageUrl} 
                        alt={selectedEntry.title}
                        className="max-h-[300px] object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center justify-center bg-muted/30 border border-dashed rounded-lg h-[200px]">
                      <p className="text-muted-foreground mb-4">No hay imagen de referencia disponible</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isGeneratingImage === selectedEntry.id}
                        onClick={handleRegenerateImage}
                      >
                        {isGeneratingImage === selectedEntry.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Generando...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-4 w-4" />
                            <span>Generar Imagen</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {selectedEntry.referenceImagePrompt && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-1">Prompt Generación</h4>
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <p className="whitespace-pre-wrap">{selectedEntry.referenceImagePrompt}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Sección de comentarios */}
                <div className="mt-8 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Comentarios
                    </h3>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        console.log("Botón de guardar comentarios clickeado");
                        if (selectedEntry) {
                          console.log("Guardando comentarios para la entrada:", selectedEntry.id);
                          setIsSavingComments(true);
                          updateCommentsMutation.mutate({
                            entryId: selectedEntry.id,
                            comments: commentText
                          });
                        }
                      }}
                      disabled={isSavingComments}
                      className="gap-2"
                    >
                      {isSavingComments ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Guardar</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea 
                    placeholder="Añadir comentarios sobre esta publicación (notas internas, observaciones, cambios pendientes, etc.)"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center bg-muted rounded-lg p-6">
              <Clipboard className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium">Seleccione una entrada</h3>
              <p className="text-muted-foreground text-center mt-2">
                Haga clic en una entrada del cronograma para ver sus detalles completos
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Diálogo para mostrar imagen a pantalla completa */}
      {selectedEntry && (
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedEntry.title}</DialogTitle>
            </DialogHeader>
            
            {selectedEntry.referenceImageUrl ? (
              <div className="flex flex-col items-center">
                <img 
                  src={selectedEntry.referenceImageUrl}
                  alt={selectedEntry.title}
                  className="max-h-[500px] object-contain rounded-lg"
                />
                <div className="mt-4 w-full">
                  <h4 className="text-sm font-medium mb-1">Prompt de Generación</h4>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="whitespace-pre-wrap">{selectedEntry.referenceImagePrompt}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-center text-muted-foreground mb-4">
                  No hay imagen disponible para esta entrada.
                </p>
              </div>
            )}
            
            <DialogFooter className="gap-2">
              {selectedEntry.referenceImageUrl && (
                <Button 
                  onClick={() => downloadImage(selectedEntry.referenceImageUrl!, selectedEntry.title)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Imagen
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => setImageDialogOpen(false)}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}