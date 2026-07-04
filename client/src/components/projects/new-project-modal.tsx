import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { FileText, Users, Megaphone, Palette, Target, MessageSquare, Package, ShoppingBag, Plus, Trash2, Facebook, Instagram, Twitter, Youtube, Linkedin, CalendarIcon, Sparkles, Quote, TrendingUp, Award, BarChart } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Definición de tipos para arquetipos
interface Archetype {
  name: string;
  profile: string;
}

// Definición de tipos para el detalle de cada formato de contenido
interface ContentTypeDetail {
  name: string;
  count: number;
}

// Definición de tipos para redes sociales
interface SocialNetwork {
  name: string;
  selected: boolean;
  contentTypes: string[];
  contentTypeDetails: ContentTypeDetail[];
  postsPerMonth: number;
}

// Definición de tipos para políticas de respuesta
interface ResponsePolicies {
  positive: string;
  negative: string;
}

// Esquema para productos iniciales
const initialProductSchema = z.object({
  name: z.string().min(1, "El nombre del producto es requerido"),
  description: z.string().optional(),
  file: z.any().optional(), // Para la imagen
});

// Create schema for the form
const projectSchema = z.object({
  name: z.string().min(1, "El nombre del proyecto es requerido"),
  client: z.string().min(1, "El nombre del cliente es requerido"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["active", "planning", "completed", "on_hold"]).default("planning"),
  initialProducts: z.array(initialProductSchema).optional(),
  analysisResults: z.object({
    communicationObjectives: z.string().optional(),
    buyerPersona: z.string().optional(),
    archetypes: z.array(
      z.object({
        name: z.string().optional(),
        profile: z.string().optional(),
      })
    ).optional(),
    socialNetworks: z.array(
      z.object({
        name: z.string(),
        selected: z.boolean().optional(),
        contentTypes: z.array(z.string()).optional(),
        contentTypeDetails: z.array(
          z.object({
            name: z.string(),
            count: z.number().int().min(0)
          })
        ).optional(),
        postsPerMonth: z.number().int().min(0).optional(),
      })
    ).optional(),
    marketingStrategies: z.string().optional(),
    brandCommunicationStyle: z.string().optional(),
    mission: z.string().optional(),
    vision: z.string().optional(),
    coreValues: z.string().optional(),
    responsePolicyPositive: z.string().optional(),
    responsePolicyNegative: z.string().optional(),

    // ===== NUEVOS CAMPOS PARA CALIDAD DE CONTENIDO =====

    // P0: Propuesta de Valor Única (UVP)
    uniqueValueProposition: z.string().optional(),

    // P0: Voice of Customer (Frases reales del cliente)
    customerQuotes: z.array(
      z.object({
        quote: z.string(),
        context: z.string().optional(), // Dónde se dijo (review, conversación, etc.)
      })
    ).optional(),
    customerObjections: z.string().optional(), // Objeciones frecuentes
    customerVocabulary: z.string().optional(), // Jerga del público

    // P0: Pilares de Contenido
    contentPillars: z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        percentage: z.number().int().min(0).max(100).optional(), // % del mix
        keywords: z.string().optional(), // Keywords relacionadas
      })
    ).optional(),

    // P1: Calendario Estacional
    seasonalCalendar: z.array(
      z.object({
        date: z.string(), // Fecha o rango
        eventName: z.string(),
        importance: z.enum(["high", "medium", "low"]).optional(),
        contentIdeas: z.string().optional(),
      })
    ).optional(),

    // P1: Análisis de Competencia Estructurado
    competitors: z.array(
      z.object({
        name: z.string(),
        strengths: z.string().optional(),
        weaknesses: z.string().optional(),
        contentTopics: z.string().optional(), // Qué temas cubren
        ourAdvantage: z.string().optional(), // Nuestra ventaja
      })
    ).optional(),
  }).optional()
});

// Lista predefinida de redes sociales y sus tipos de contenido
const socialNetworksOptions = [
  {
    name: "Facebook",
    icon: <Facebook className="h-4 w-4 mr-2" />,
    contentTypes: ["Publicaciones de texto", "Imágenes", "Videos", "Historias", "Transmisiones en vivo", "Eventos", "Grupos"]
  },
  {
    name: "Instagram",
    icon: <Instagram className="h-4 w-4 mr-2" />,
    contentTypes: ["Publicaciones en Feed", "Stories", "Reels", "IGTV", "Transmisiones en vivo", "Guías"]
  },
  {
    name: "Twitter",
    icon: <Twitter className="h-4 w-4 mr-2" />,
    contentTypes: ["Tweets", "Hilos", "Espacios", "Momentos", "Encuestas"]
  },
  {
    name: "YouTube",
    icon: <Youtube className="h-4 w-4 mr-2" />,
    contentTypes: ["Videos largos", "Shorts", "Transmisiones en vivo", "Comunidad", "Playlists"]
  },
  {
    name: "LinkedIn",
    icon: <Linkedin className="h-4 w-4 mr-2" />,
    contentTypes: ["Publicaciones de texto", "Artículos", "Documentos", "Videos", "Eventos", "Encuestas"]
  },
  {
    name: "TikTok",
    icon: <Megaphone className="h-4 w-4 mr-2" />,
    contentTypes: ["Videos cortos", "Transmisiones en vivo", "Duetos", "Stitch", "Efectos"]
  }
];

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState<string>("general");

  // Initialize form
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      client: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "planning",
      initialProducts: [],
      analysisResults: {
        communicationObjectives: "",
        buyerPersona: "",
        archetypes: [{ name: "", profile: "" }],
        socialNetworks: socialNetworksOptions.map(network => ({
          name: network.name,
          selected: false,
          contentTypes: [],
          contentTypeDetails: network.contentTypes.map(type => ({
            name: type,
            count: 0
          })),
          postsPerMonth: 0
        })),
        marketingStrategies: "",
        brandCommunicationStyle: "",
        mission: "",
        vision: "",
        coreValues: "",
        responsePolicyPositive: "",
        responsePolicyNegative: "",
        // Nuevos campos para calidad de contenido
        uniqueValueProposition: "",
        customerQuotes: [],
        customerObjections: "",
        customerVocabulary: "",
        contentPillars: [{ name: "", description: "", percentage: 0, keywords: "" }],
        seasonalCalendar: [],
        competitors: [{ name: "", strengths: "", weaknesses: "", contentTopics: "", ourAdvantage: "" }],
      }
    }
  });

  // Setup field arrays for arquetipos
  const archetypesFieldArray = useFieldArray({
    control: form.control,
    name: "analysisResults.archetypes"
  });

  // Setup field arrays for initial products
  const productsFieldArray = useFieldArray({
    control: form.control,
    name: "initialProducts"
  });

  // Setup field arrays for customer quotes (VoC)
  const customerQuotesFieldArray = useFieldArray({
    control: form.control,
    name: "analysisResults.customerQuotes"
  });

  // Setup field arrays for content pillars
  const contentPillarsFieldArray = useFieldArray({
    control: form.control,
    name: "analysisResults.contentPillars"
  });

  // Setup field arrays for seasonal calendar
  const seasonalCalendarFieldArray = useFieldArray({
    control: form.control,
    name: "analysisResults.seasonalCalendar"
  });

  // Setup field arrays for competitors
  const competitorsFieldArray = useFieldArray({
    control: form.control,
    name: "analysisResults.competitors"
  });

  // State for managing file inputs in each product form
  const [productFiles, setProductFiles] = useState<Record<number, File | null>>({});

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (values: z.infer<typeof projectSchema>) => {
      // Format dates if provided
      const formattedValues = {
        ...values,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        // Remove the file objects from products since they'll be uploaded separately
        initialProducts: values.initialProducts ? values.initialProducts.map(product => ({
          ...product,
          file: undefined
        })) : undefined
      };

      const projectData = await dbQuery("projects").insertSingle({
        name: values.name,
        client: values.client,
        description: values.description,
        startDate: values.startDate,
        endDate: values.endDate,
        status: values.status,
      });

      // Si el proyecto se creó exitosamente y hay productos con imágenes, subir las imágenes
      if (projectData && projectData.id && values.initialProducts?.length) {
        const projectId = projectData.id;

        // Crear los productos uno por uno con sus imágenes
        for (let i = 0; i < values.initialProducts.length; i++) {
          const product = values.initialProducts[i];
          const file = productFiles[i];
          let imageUrl: string | null = null;

          // Subir imagen a Storage si existe
          if (file) {
            const filePath = `${projectId}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(filePath, file, { upsert: true });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);
              imageUrl = urlData.publicUrl;
            }
          }

          if (product.name) {
            const productData: Record<string, any> = {
              name: product.name,
              project_id: projectId,
            };
            if (product.description) productData.description = product.description;
            if (imageUrl) productData.image_url = imageUrl;

            await supabase
              .from('products')
              .insert(productData);
          }
        }
      }

      return projectData;
    },
    onSuccess: () => {
      toast({
        title: "Proyecto creado",
        description: "Tu nuevo proyecto ha sido creado exitosamente",
      });
      // Invalidate projects query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Reset form and close modal
      form.reset();
      setProductFiles({});
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error al crear proyecto",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (values: z.infer<typeof projectSchema>) => {
    createProjectMutation.mutate(values);
  };

  // Clean form data and close modal
  const handleClose = () => {
    if (!createProjectMutation.isPending) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Crear Nuevo Proyecto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1 h-auto p-1 mb-4">
                <TabsTrigger value="general" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'general' ? 'active' : 'inactive'}>
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">General</span>
                </TabsTrigger>
                <TabsTrigger value="objetivos" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'objetivos' ? 'active' : 'inactive'}>
                  <Target className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Objetivos</span>
                </TabsTrigger>
                <TabsTrigger value="personas" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'personas' ? 'active' : 'inactive'}>
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Persona</span>
                </TabsTrigger>
                <TabsTrigger value="diferenciacion" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'diferenciacion' ? 'active' : 'inactive'}>
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">UVP</span>
                </TabsTrigger>
                <TabsTrigger value="voc" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'voc' ? 'active' : 'inactive'}>
                  <Quote className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">VoC</span>
                </TabsTrigger>
                <TabsTrigger value="pilares" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'pilares' ? 'active' : 'inactive'}>
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Pilares</span>
                </TabsTrigger>
                <TabsTrigger value="competencia" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'competencia' ? 'active' : 'inactive'}>
                  <BarChart className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Competencia</span>
                </TabsTrigger>
                <TabsTrigger value="estrategias" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'estrategias' ? 'active' : 'inactive'}>
                  <Megaphone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Estrategias</span>
                </TabsTrigger>
                <TabsTrigger value="comunicacion" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'comunicacion' ? 'active' : 'inactive'}>
                  <Palette className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Comunicación</span>
                </TabsTrigger>
                <TabsTrigger value="mision" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'mision' ? 'active' : 'inactive'}>
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">MVV</span>
                </TabsTrigger>
                <TabsTrigger value="calendario" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'calendario' ? 'active' : 'inactive'}>
                  <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Fechas</span>
                </TabsTrigger>
                <TabsTrigger value="productos" className="flex flex-col items-center gap-1 h-auto py-2 px-1 min-h-[60px]" data-state={selectedTab === 'productos' ? 'active' : 'inactive'}>
                  <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-tight text-center">Productos</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: General Information */}
              <TabsContent value="general" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Información General</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Proyecto</FormLabel>
                        <FormControl>
                          <Input placeholder="Ingresa el nombre del proyecto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Cliente</FormLabel>
                        <FormControl>
                          <Input placeholder="Ingresa el nombre del cliente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ingresa la descripción del proyecto"
                            rows={3}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Fecha de Inicio</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP", { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                disabled={(date) =>
                                  date < new Date("1900-01-01")
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Fecha de Finalización</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP", { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                disabled={(date) =>
                                  date < new Date("1900-01-01")
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona el estado del proyecto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planning">Planeación</SelectItem>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="on_hold">En Pausa</SelectItem>
                            <SelectItem value="completed">Completado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 2: Objetivos generales de comunicación */}
              <TabsContent value="objetivos" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">1. Objetivos generales de comunicación</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="analysisResults.communicationObjectives"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objetivos generales de comunicación</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Define los objetivos generales de comunicación para este proyecto"
                            rows={6}
                            {...field}
                            value={field.value || ""}
                            className="min-h-[200px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 3: Buyer Persona/Arquetipos */}
              <TabsContent value="personas" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">2. Buyer Persona, Arquetipos y perfiles de consumidores</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="analysisResults.buyerPersona"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción General del Buyer Persona</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe la visión general del buyer persona objetivo"
                            rows={4}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4 border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-md font-medium">Arquetipos</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => archetypesFieldArray.append({ name: "", profile: "" })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Arquetipo</span>
                      </Button>
                    </div>

                    <FormDescription>
                      Agrega aquí los diferentes arquetipos de consumidores, con su nombre y descripción del perfil.
                    </FormDescription>

                    {archetypesFieldArray.fields.map((field, index) => (
                      <Card key={field.id} className="mb-4">
                        <CardHeader className="py-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-medium">Arquetipo {index + 1}</CardTitle>
                            {archetypesFieldArray.fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => archetypesFieldArray.remove(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="py-0 space-y-3">
                          <FormField
                            control={form.control}
                            name={`analysisResults.archetypes.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre del Arquetipo</FormLabel>
                                <FormControl>
                                  <Input placeholder="ej. Madre Protectora, Héroe, etc." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`analysisResults.archetypes.${index}.profile`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Perfil</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Describe este perfil de consumidor"
                                    rows={3}
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Propuesta de Valor Única (UVP) */}
              <TabsContent value="diferenciacion" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Propuesta de Valor Única (UVP)</h2>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Define qué hace diferente a tu marca. Esto es fundamental para generar contenido que destaque y no sea genérico.
                  </p>

                  <FormField
                    control={form.control}
                    name="analysisResults.uniqueValueProposition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>¿Qué hace única a esta marca?</FormLabel>
                        <FormDescription>
                          Describe el problema que resuelves, cómo lo resuelves de forma diferente, y el beneficio tangible para el cliente.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Ejemplo: Somos la única marca de café artesanal en México que entrega en menos de 2 horas tueste fresco del día, garantizando el mejor sabor sin intermediarios."
                            rows={6}
                            {...field}
                            value={field.value || ""}
                            className="min-h-[150px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 5: Voice of Customer (VoC) */}
              <TabsContent value="voc" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Voz del Cliente (VoC)</h2>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Captura frases reales de tus clientes para que el contenido resuene con su lenguaje auténtico.
                  </p>

                  {/* Customer Quotes Dynamic Array */}
                  <div className="space-y-4 border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-md font-medium">Frases de Clientes</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => customerQuotesFieldArray.append({ quote: "", context: "" })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Frase</span>
                      </Button>
                    </div>

                    <FormDescription>
                      Agrega frases literales de testimonios, reviews, conversaciones de ventas, etc.
                    </FormDescription>

                    {customerQuotesFieldArray.fields.map((field, index) => (
                      <Card key={field.id} className="mb-2">
                        <CardContent className="py-3 space-y-3">
                          <div className="flex justify-between items-start">
                            <FormField
                              control={form.control}
                              name={`analysisResults.customerQuotes.${index}.quote`}
                              render={({ field }) => (
                                <FormItem className="flex-1 mr-2">
                                  <FormLabel>Frase del cliente</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder='"Me encanta que siempre llega a tiempo y el sabor es increíble"'
                                      rows={2}
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 mt-6"
                              onClick={() => customerQuotesFieldArray.remove(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                          <FormField
                            control={form.control}
                            name={`analysisResults.customerQuotes.${index}.context`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contexto (opcional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ej: Review en Google, Conversación WhatsApp, Testimonio video"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Customer Objections */}
                  <FormField
                    control={form.control}
                    name="analysisResults.customerObjections"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objeciones Frecuentes</FormLabel>
                        <FormDescription>
                          ¿Qué dudas o objeciones tienen los clientes antes de comprar? Esto ayuda a crear contenido que las resuelva.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Ej: Es muy caro, ¿sí funciona?, No sé si es para mí, Ya probé otras marcas..."
                            rows={3}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Customer Vocabulary */}
                  <FormField
                    control={form.control}
                    name="analysisResults.customerVocabulary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vocabulario / Jerga del Público</FormLabel>
                        <FormDescription>
                          Palabras, frases o expresiones que usa tu audiencia. Esto hace que el contenido suene natural.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Ej: chido, vale la pena, me ahorra un montón, súper fácil..."
                            rows={2}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 6: Pilares de Contenido */}
              <TabsContent value="pilares" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Pilares de Contenido</h2>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Define los temas principales en los que la marca construirá autoridad. Estos pilares guían la estrategia de contenido.
                  </p>

                  <div className="space-y-4 border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-md font-medium">Pilares Temáticos</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => contentPillarsFieldArray.append({ name: "", description: "", percentage: 0, keywords: "" })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Pilar</span>
                      </Button>
                    </div>

                    {contentPillarsFieldArray.fields.map((field, index) => (
                      <Card key={field.id} className="mb-2">
                        <CardHeader className="py-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-medium">Pilar {index + 1}</CardTitle>
                            {contentPillarsFieldArray.fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => contentPillarsFieldArray.remove(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="py-0 space-y-3">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`analysisResults.contentPillars.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre del Pilar</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ej: Educación, Entretenimiento, Inspiración" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`analysisResults.contentPillars.${index}.percentage`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>% del Mix de Contenido</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      placeholder="30"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name={`analysisResults.contentPillars.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Descripción / Subtemas</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Describe qué incluye este pilar y los subtemas que abarca"
                                    rows={2}
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`analysisResults.contentPillars.${index}.keywords`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Keywords Relacionadas</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ej: tutoriales, cómo hacer, tips, aprende"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 7: Análisis de Competencia */}
              <TabsContent value="competencia" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Análisis de Competencia</h2>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Conoce a tus competidores para crear contenido diferenciado y posicionarte estratégicamente.
                  </p>

                  <div className="space-y-4 border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-md font-medium">Competidores</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => competitorsFieldArray.append({ name: "", strengths: "", weaknesses: "", contentTopics: "", ourAdvantage: "" })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Competidor</span>
                      </Button>
                    </div>

                    {competitorsFieldArray.fields.map((field, index) => (
                      <Card key={field.id} className="mb-2">
                        <CardHeader className="py-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-medium">Competidor {index + 1}</CardTitle>
                            {competitorsFieldArray.fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => competitorsFieldArray.remove(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="py-0 space-y-3">
                          <FormField
                            control={form.control}
                            name={`analysisResults.competitors.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre del Competidor</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nombre de la marca/empresa" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`analysisResults.competitors.${index}.strengths`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Fortalezas</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="¿Qué hacen bien?"
                                      rows={2}
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`analysisResults.competitors.${index}.weaknesses`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Debilidades</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="¿Dónde fallan?"
                                      rows={2}
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name={`analysisResults.competitors.${index}.contentTopics`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Temas que Cubren en Redes</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ej: tutoriales, descuentos, lifestyle..."
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`analysisResults.competitors.${index}.ourAdvantage`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nuestra Ventaja vs Este Competidor</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="¿Por qué elegirnos sobre ellos?"
                                    rows={2}
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 8: Estrategias de marketing */}
              <TabsContent value="estrategias" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">3. Estrategias de marketing de contenido y medios digitales</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="analysisResults.marketingStrategies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estrategias de marketing de contenido</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Define las estrategias de marketing de contenido"
                            rows={4}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4 border rounded-md p-4">
                    <h3 className="text-md font-medium">Redes Sociales y Tipos de Contenido</h3>
                    <FormDescription>
                      Selecciona las redes sociales que utilizarás en este proyecto y los tipos de contenido para cada una.
                    </FormDescription>

                    <div className="space-y-6">
                      {socialNetworksOptions.map((network, networkIndex) => (
                        <div key={network.name} className="space-y-3 p-3 border rounded-md">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <FormField
                                control={form.control}
                                name={`analysisResults.socialNetworks.${networkIndex}.selected`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="flex items-center">
                                      {network.icon}
                                      <FormLabel className="font-medium">{network.name}</FormLabel>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name={`analysisResults.socialNetworks.${networkIndex}.postsPerMonth`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                  <FormLabel className="text-sm whitespace-nowrap">
                                    Total publicaciones:
                                  </FormLabel>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="h-8 px-3">
                                      <span className="text-lg font-semibold">{field.value || 0}</span>
                                    </Badge>
                                    <FormDescription className="text-xs mt-0 ml-1">
                                      (actualización automática)
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="pl-6">
                            <FormField
                              control={form.control}
                              name={`analysisResults.socialNetworks.${networkIndex}.contentTypes`}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="grid grid-cols-2 gap-4">
                                    {network.contentTypes.map((contentType, contentTypeIndex) => (
                                      <div key={contentType} className="border rounded-md p-2">
                                        <FormItem className="flex flex-row items-start space-x-2 space-y-0 mb-2">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(contentType)}
                                              onCheckedChange={(checked) => {
                                                const currentValue = field.value || [];
                                                if (checked) {
                                                  field.onChange([...currentValue, contentType]);
                                                } else {
                                                  field.onChange(currentValue.filter(v => v !== contentType));
                                                }
                                              }}
                                              disabled={!form.watch(`analysisResults.socialNetworks.${networkIndex}.selected`)}
                                            />
                                          </FormControl>
                                          <FormLabel className="text-sm font-medium">
                                            {contentType}
                                          </FormLabel>
                                        </FormItem>

                                        {field.value?.includes(contentType) && (
                                          <FormField
                                            control={form.control}
                                            name={`analysisResults.socialNetworks.${networkIndex}.contentTypeDetails.${contentTypeIndex}.count`}
                                            render={({ field: countField }) => (
                                              <FormItem className="flex flex-row items-center gap-2 space-y-0 mt-2">
                                                <FormLabel className="text-xs whitespace-nowrap">
                                                  Cantidad:
                                                </FormLabel>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    className="w-16 h-7 text-sm"
                                                    disabled={!form.watch(`analysisResults.socialNetworks.${networkIndex}.selected`)}
                                                    {...countField}
                                                    onChange={(e) => {
                                                      const value = parseInt(e.target.value);
                                                      countField.onChange(isNaN(value) ? 0 : value);

                                                      // Calcula el total de publicaciones para esta red social
                                                      const contentTypeDetails = form.getValues(`analysisResults.socialNetworks.${networkIndex}.contentTypeDetails`) || [];
                                                      const total = Array.isArray(contentTypeDetails)
                                                        ? contentTypeDetails.reduce((sum, detail) => sum + (detail?.count || 0), 0)
                                                        : 0;

                                                      // Actualiza el total
                                                      form.setValue(`analysisResults.socialNetworks.${networkIndex}.postsPerMonth`, total);
                                                    }}
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 5: Líneas y estilo de comunicación */}
              <TabsContent value="comunicacion" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">4. Líneas y estilo de comunicación de la marca</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="analysisResults.brandCommunicationStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Líneas y estilo de comunicación de la marca</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe las líneas de comunicación y el estilo que debe mantener la marca"
                            rows={6}
                            {...field}
                            value={field.value || ""}
                            className="min-h-[200px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 6: Misión, visión y valores */}
              <TabsContent value="mision" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">5. Misión, visión y valores</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="analysisResults.mission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Misión</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Define la misión de la marca o empresa"
                            rows={3}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="analysisResults.vision"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visión</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Define la visión de la marca o empresa"
                            rows={3}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="analysisResults.coreValues"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valores</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Lista los valores fundamentales de la marca"
                            rows={3}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 7: Políticas de respuesta */}
              <TabsContent value="politicas" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">6. Políticas de respuesta positiva y negativa</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="analysisResults.responsePolicyPositive"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Política de respuesta positiva</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Define las políticas para manejar respuestas positivas en redes sociales y otros canales"
                            rows={4}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="analysisResults.responsePolicyNegative"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Política de respuesta negativa</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Define las políticas para manejar respuestas negativas o críticas en redes sociales y otros canales"
                            rows={4}
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab: Calendario Estacional */}
              <TabsContent value="calendario" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Calendario Estacional</h2>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Define las fechas importantes para la marca: temporadas altas, eventos de industria, fechas comerciales. Esto permite crear contenido contextualizado.
                  </p>

                  <div className="space-y-4 border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-md font-medium">Fechas Clave</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => seasonalCalendarFieldArray.append({ date: "", eventName: "", importance: "medium", contentIdeas: "" })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Fecha</span>
                      </Button>
                    </div>

                    <FormDescription>
                      Agrega fechas comerciales, temporadas altas, eventos de industria, aniversarios, etc.
                    </FormDescription>

                    {seasonalCalendarFieldArray.fields.map((field, index) => (
                      <Card key={field.id} className="mb-2">
                        <CardContent className="py-3 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="grid gap-4 sm:grid-cols-3 flex-1 mr-2">
                              <FormField
                                control={form.control}
                                name={`analysisResults.seasonalCalendar.${index}.date`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Fecha o Rango</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Ej: 14 Feb, Nov-Dic, Julio"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`analysisResults.seasonalCalendar.${index}.eventName`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nombre del Evento</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Ej: Día del Amor, Black Friday"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`analysisResults.seasonalCalendar.${index}.importance`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Importancia</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecciona" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="high">🔴 Alta</SelectItem>
                                        <SelectItem value="medium">🟡 Media</SelectItem>
                                        <SelectItem value="low">🟢 Baja</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 mt-6"
                              onClick={() => seasonalCalendarFieldArray.remove(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                          <FormField
                            control={form.control}
                            name={`analysisResults.seasonalCalendar.${index}.contentIdeas`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ideas de Contenido (opcional)</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="¿Qué tipo de contenido funcionaría para esta fecha?"
                                    rows={2}
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Productos */}
              <TabsContent value="productos" className="space-y-4 pt-2">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">7. Productos</h2>
                  <Separator />

                  <div className="space-y-4 border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-md font-medium">Productos Iniciales</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => productsFieldArray.append({
                          name: "",
                          description: ""
                        })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar Producto</span>
                      </Button>
                    </div>

                    <FormDescription>
                      Agrega los productos iniciales relacionados con este proyecto.
                    </FormDescription>

                    {productsFieldArray.fields.map((field, index) => (
                      <Card key={field.id} className="mb-4">
                        <CardHeader className="py-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-medium">Producto {index + 1}</CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                productsFieldArray.remove(index);
                                setProductFiles(prev => {
                                  const newFiles = { ...prev };
                                  delete newFiles[index];
                                  return newFiles;
                                });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="py-0 space-y-3">
                          <FormField
                            control={form.control}
                            name={`initialProducts.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre del Producto</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nombre del producto" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`initialProducts.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Descripción</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Descripción del producto"
                                    rows={3}
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Los campos de SKU y precio se han eliminado ya que no son necesarios para el contexto de la IA */}

                          <FormItem>
                            <FormLabel>Imagen del Producto</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setProductFiles(prev => ({
                                    ...prev,
                                    [index]: file
                                  }));
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Sube una imagen para este producto. La imagen se guardará cuando se cree el proyecto.
                            </FormDescription>
                          </FormItem>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex items-center justify-between gap-3 pt-4 border-t mt-6">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>{selectedTab === "general" ? "1" : selectedTab === "objetivos" ? "2" : selectedTab === "personas" ? "3" : selectedTab === "estrategias" ? "4" : selectedTab === "comunicacion" ? "5" : selectedTab === "mision" ? "6" : selectedTab === "politicas" ? "7" : "8"}</span>
                <span>/</span>
                <span>8</span>
              </div>
              <div className="flex items-center gap-3">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? "Creando..." : "Crear Proyecto"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}