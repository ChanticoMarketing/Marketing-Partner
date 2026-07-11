import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, Target, Users, MessageCircle, Shield, Lightbulb, Sparkles, Quote, TrendingUp, BarChart, CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ProjectDocuments from "@/components/projects/project-documents";
import { type BrandBrainCardKey } from "@/lib/brand-brain-cards";
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

interface ProjectAnalysisProps {
  project: any;
  canEdit: boolean;
}

function CardSources({
  cardKey,
  isEditing,
  onOpen,
}: {
  cardKey: BrandBrainCardKey;
  isEditing: boolean;
  onOpen: (card: BrandBrainCardKey) => void;
}) {
  if (!isEditing) return null;

  return (
    <div className="border-t px-6 py-4">
      <Button type="button" size="sm" variant="outline" onClick={() => onOpen(cardKey)}>
        <Plus className="mr-2 h-4 w-4" />
        Documentos de apoyo
      </Button>
    </div>
  );
}

// Extended Analysis schema including all fields from DB schema
const analysisSchema = z.object({
  // Identity
  mission: z.string().optional(),
  vision: z.string().optional(),
  coreValues: z.string().optional(),

  // Target
  buyerPersona: z.string().optional(),
  targetAudience: z.string().optional(),

  // Strategy
  objectives: z.string().optional(),
  marketingStrategies: z.string().optional(),

  // Communication
  brandTone: z.string().optional(),
  brandCommunicationStyle: z.string().optional(),
  keywords: z.string().optional(),

  // Policies
  responsePolicyPositive: z.string().optional(),
  responsePolicyNegative: z.string().optional(),

  // ===== NEW: Content Quality Fields =====
  uniqueValueProposition: z.string().optional(),
  customerQuotes: z.array(z.object({
    quote: z.string(),
    context: z.string().optional()
  })).optional(),
  customerObjections: z.string().optional(),
  customerVocabulary: z.string().optional(),

  // Use arrays for structured editing instead of strings
  contentThemes: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    percentage: z.number().optional(),
    keywords: z.string().optional()
  })).optional(),

  competitorAnalysis: z.array(z.object({
    name: z.string(),
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    contentTopics: z.string().optional(),
    ourAdvantage: z.string().optional()
  })).optional(),

  seasonalCalendar: z.array(z.object({
    date: z.string(),
    eventName: z.string(),
    importance: z.enum(["high", "medium", "low"]).optional(),
    contentIdeas: z.string().optional()
  })).optional(),
});

export default function ProjectAnalysis({ project, canEdit }: ProjectAnalysisProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("brand");
  const [documentCard, setDocumentCard] = useState<BrandBrainCardKey | "unclassified" | null>(null);

  // Get analysis data from project
  const analysisData = project?.analysis || {};

  // Initialize form with project analysis data
  const form = useForm<z.infer<typeof analysisSchema>>({
    resolver: zodResolver(analysisSchema),
    defaultValues: {
      mission: analysisData.mission || "",
      vision: analysisData.vision || "",
      coreValues: analysisData.coreValues || "",
      buyerPersona: analysisData.buyerPersona || "",
      targetAudience: analysisData.targetAudience || "",
      objectives: analysisData.objectives || "",
      marketingStrategies: analysisData.marketingStrategies || "",
      brandTone: analysisData.brandTone || "",
      brandCommunicationStyle: analysisData.brandCommunicationStyle || "",
      keywords: analysisData.keywords || "",
      responsePolicyPositive: analysisData.responsePolicyPositive || "",
      responsePolicyNegative: analysisData.responsePolicyNegative || "",

      // New fields defaults
      uniqueValueProposition: analysisData.uniqueValueProposition || "",
      customerObjections: analysisData.customerObjections || "",
      customerVocabulary: analysisData.customerVocabulary || "",

      // Array fields - checking if they are arrays (from JSONB) or need default []
      contentThemes: Array.isArray(analysisData.contentThemes) ? analysisData.contentThemes : [],
      competitorAnalysis: Array.isArray(analysisData.competitorAnalysis) ? analysisData.competitorAnalysis : [],
      customerQuotes: Array.isArray(analysisData.customerQuotes) ? analysisData.customerQuotes : [],
      seasonalCalendar: Array.isArray(analysisData.seasonalCalendar) ? analysisData.seasonalCalendar : [],
    }
  });

  // Field Arrays for dynamic lists
  const quotesFieldArray = useFieldArray({
    control: form.control,
    name: "customerQuotes"
  });

  const pillarsFieldArray = useFieldArray({
    control: form.control,
    name: "contentThemes"
  });

  const competitorsFieldArray = useFieldArray({
    control: form.control,
    name: "competitorAnalysis"
  });

  const calendarFieldArray = useFieldArray({
    control: form.control,
    name: "seasonalCalendar"
  });

  // Update analysis mutation
  const updateAnalysisMutation = useMutation({
    mutationFn: async (values: z.infer<typeof analysisSchema>) => {
      const payload = { ...values, projectId: project.id };
      // Check if analysis exists, then update or insert
      const { data: existing } = await supabase
        .from("analysis_results")
        .select("id")
        .eq("project_id", project.id)
        .maybeSingle();
      if (existing) {
        return dbQuery("analysis_results").updateSingle(payload, { projectId: project.id });
      }
      return dbQuery("analysis_results").insertSingle(payload);
    },
    onSuccess: () => {
      toast({
        title: "Estrategia Actualizada",
        description: "El cerebro de la marca ha sido actualizado correctamente.",
      });
      // Invalidate project query to refresh data
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error actualizando estrategia",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (values: z.infer<typeof analysisSchema>) => {
    updateAnalysisMutation.mutate(values);
  };

  const hasAnalysis = analysisData && Object.keys(analysisData).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold gradient-text-amber">Cerebro de la Marca</h2>
          <p className="text-muted-foreground text-sm">Lo esencial de la marca, el cliente y la guía para la IA.</p>
        </div>
        {canEdit && !isEditing && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
            <span>Editar Cerebro</span>
          </Button>
        )}
        {canEdit && isEditing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={form.handleSubmit(onSubmit)}
              disabled={updateAnalysisMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {updateAnalysisMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* ponytail: group the existing cards without changing their data contract. */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto bg-muted/20 p-1 mb-4">
              <TabsTrigger value="brand" className="flex flex-col py-2 gap-1 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Shield className="h-4 w-4" />
                <span className="text-[10px] sm:text-xs">Marca</span>
              </TabsTrigger>
              <TabsTrigger value="customer" className="flex flex-col py-2 gap-1 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Users className="h-4 w-4" />
                <span className="text-[10px] sm:text-xs">Cliente</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="flex flex-col py-2 gap-1 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <TrendingUp className="h-4 w-4" />
                <span className="text-[10px] sm:text-xs">Contenido</span>
              </TabsTrigger>
              <TabsTrigger value="context" className="flex flex-col py-2 gap-1 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <BarChart className="h-4 w-4" />
                <span className="text-[10px] sm:text-xs">Contexto</span>
              </TabsTrigger>
            </TabsList>

            {/* IDENTITY TAB */}
            <TabsContent value="brand" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Misión y Visión</CardTitle>
                    <CardDescription>El propósito fundamental de la marca</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <>
                        <FormField
                          control={form.control}
                          name="mission"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Misión</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Qué hace la empresa y para quién" className="min-h-[100px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="vision"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Visión</FormLabel>
                              <FormControl>
                                <Textarea placeholder="A dónde quiere llegar la empresa a futuro" className="min-h-[100px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <div>
                          <h4 className="font-semibold text-sm text-primary mb-1">Misión</h4>
                          <p className="text-sm border-l-2 border-primary/30 pl-3">{analysisData.mission || "No definida"}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-primary mb-1">Visión</h4>
                          <p className="text-sm border-l-2 border-primary/30 pl-3">{analysisData.vision || "No definida"}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                  <CardSources cardKey="identity-purpose" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Valores Centrales</CardTitle>
                    <CardDescription>Principios que guían el comportamiento</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="coreValues"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Listado de valores (ej: Transparencia, Calidad, Innovación)" className="min-h-[250px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-2">
                        {analysisData.coreValues ? (
                          analysisData.coreValues.split(/[\n,]+/).map((val: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <Shield className="h-3 w-3 text-primary" />
                              <span className="text-sm">{val.trim()}</span>
                            </div>
                          ))
                        ) : <p className="text-sm text-muted-foreground">No definidos</p>}
                      </div>
                    )}
                  </CardContent>
                  <CardSources cardKey="identity-values" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>
              </div>
            </TabsContent>

            {/* AUDIENCE TAB */}
            <TabsContent value="customer" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Buyer Persona</CardTitle>
                    <CardDescription>Perfil detallado del cliente ideal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="buyerPersona"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Descripción detallada: Datos demográficos, dolores, motivaciones, objeciones..." className="min-h-[300px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap text-sm">{analysisData.buyerPersona || "No definido"}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardSources cardKey="audience-persona" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Audiencia General</CardTitle>
                    <CardDescription>Segmentos de mercado objetivo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="targetAudience"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Segmentos generales a los que se dirige la marca" className="min-h-[300px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{analysisData.targetAudience || "No definida"}</p>
                    )}
                  </CardContent>
                  <CardSources cardKey="audience-general" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>
              </div>
            </TabsContent>

            {/* VOC TAB (New) */}
            <TabsContent value="customer" id="brand-brain-customer-voc" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Voz del Cliente (VoC)</CardTitle>
                    <CardDescription>Lo que dicen tus clientes reales</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold">Frases Literales & Quotes</h4>
                      {isEditing && (
                        <Button type="button" size="sm" variant="outline" onClick={() => quotesFieldArray.append({ quote: "", context: "" })}>
                          <Plus className="h-3 w-3 mr-1" /> Agregar
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        {quotesFieldArray.fields.map((field, index) => (
                          <Card key={field.id} className="p-3 bg-muted/20">
                            <div className="grid gap-2">
                              <FormField
                                control={form.control}
                                name={`customerQuotes.${index}.quote`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Textarea placeholder="Ej: 'Me ahorra 3 horas al día...'" className="min-h-[60px]" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <div className="flex gap-2 items-center">
                                <FormField
                                  control={form.control}
                                  name={`customerQuotes.${index}.context`}
                                  render={({ field }) => (
                                    <FormItem className="flex-1">
                                      <FormControl>
                                        <Input placeholder="Contexto (ej: Review en G2)" className="h-8 text-xs" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => quotesFieldArray.remove(index)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                        {quotesFieldArray.fields.length === 0 && <p className="text-sm text-muted-foreground italic">No hay frases registradas.</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {analysisData.customerQuotes && Array.isArray(analysisData.customerQuotes) && analysisData.customerQuotes.length > 0 ? (
                          analysisData.customerQuotes.map((q: any, i: number) => (
                            <div key={i} className="bg-muted/30 p-2 rounded text-sm italic border-l-2 border-primary">
                              "{q.quote}" <br />
                              <span className="text-xs not-italic text-muted-foreground">- {q.context || "Cliente"}</span>
                            </div>
                          ))
                        ) : <p className="text-sm text-muted-foreground">No hay frases registradas.</p>}
                      </div>
                    )}
                  </CardContent>
                  <CardSources cardKey="voice-customer" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Vocabulario y Objeciones</CardTitle>
                    <CardDescription>Cómo hablan y qué les preocupa</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isEditing ? (
                      <>
                        <FormField
                          control={form.control}
                          name="customerObjections"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Objeciones Frecuentes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Miedo al precio / Curva de aprendizaje / etc." className="min-h-[100px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customerVocabulary"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vocabulario del Nicho</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Palabras clave, jerga, tecnicismos usados por ellos." className="min-h-[100px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Objeciones Frecuentes</h4>
                          <p className="text-sm bg-muted/30 p-2 rounded">{analysisData.customerObjections || "No definidas"}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Vocabulario</h4>
                          <p className="text-sm bg-muted/30 p-2 rounded">{analysisData.customerVocabulary || "No definido"}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                  <CardSources cardKey="voice-vocabulary" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>
              </div>
            </TabsContent>

            {/* STRATEGY TAB */}
            <TabsContent value="context" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Objetivos y Estrategias</CardTitle>
                  <CardDescription>Plan de acción para el crecimiento</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="objectives"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Objetivos de Marketing</FormLabel>
                            <FormControl>
                              <Textarea placeholder="KPIs y metas específicas" className="min-h-[150px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Target className="h-4 w-4" /> Objetivos</h4>
                        <p className="whitespace-pre-wrap text-sm bg-muted/30 p-3 rounded-md">{analysisData.objectives || "No definidos"}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="marketingStrategies"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estrategias Clave</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Estrategias content marketing, ads, email, etc." className="min-h-[150px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Estrategias</h4>
                        <p className="whitespace-pre-wrap text-sm bg-muted/30 p-3 rounded-md">{analysisData.marketingStrategies || "No definidas"}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardSources cardKey="strategy" isEditing={isEditing} onOpen={setDocumentCard} />
              </Card>

            </TabsContent>

            {/* UVP TAB (New) */}
            <TabsContent value="brand" id="brand-brain-uvp" className="space-y-4">
              <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/10">
                <CardHeader>
                  <CardTitle className="text-amber-700 dark:text-primary/80">Propuesta de Valor Única (UVP)</CardTitle>
                  <CardDescription>¿Qué hace a tu marca radicalmente diferente?</CardDescription>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <FormField
                      control={form.control}
                      name="uniqueValueProposition"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Describe tu diferenciador clave. Aquello que la competencia no puede copiar fácilmente."
                              className="min-h-[150px] text-lg"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground mt-2">
                            💡 Esta UVP se usará para crear hooks y CTAs que resalten tu ventaja competitiva.
                          </p>
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-base font-medium">{analysisData.uniqueValueProposition || "No definida"}</p>
                    </div>
                  )}
                </CardContent>
                <CardSources cardKey="uvp" isEditing={isEditing} onOpen={setDocumentCard} />
              </Card>
            </TabsContent>

            {/* PILLARS TAB (New) */}
            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Pilares de Contenido</CardTitle>
                      <CardDescription>Temas principales para generar autoridad</CardDescription>
                    </div>
                    {isEditing && (
                      <Button type="button" size="sm" onClick={() => pillarsFieldArray.append({ name: "", description: "", percentage: 0 })}>
                        <Plus className="h-4 w-4 mr-2" /> Nuevo Pilar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isEditing ? (
                      pillarsFieldArray.fields.map((field, index) => (
                        <div key={field.id} className="p-4 border rounded-md bg-muted/10 grid gap-4">
                          <div className="flex justify-between">
                            <h4 className="font-medium text-sm">Pilar #{index + 1}</h4>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => pillarsFieldArray.remove(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`contentThemes.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre del Tema</FormLabel>
                                  <FormControl><Input placeholder="Ej: Educación" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`contentThemes.${index}.percentage`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>% del Mix (0-100)</FormLabel>
                                  <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`contentThemes.${index}.description`}
                              render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                  <FormLabel>Descripción y Enfoque</FormLabel>
                                  <FormControl><Textarea placeholder="Qué tipo de contenido incluye este pilar..." className="h-[60px]" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        {analysisData.contentThemes && Array.isArray(analysisData.contentThemes) && analysisData.contentThemes.length > 0 ? (
                          analysisData.contentThemes.map((theme: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-3 border rounded">
                              <div>
                                <h4 className="font-bold flex items-center gap-2">
                                  {theme.name}
                                  {theme.percentage && <Badge variant="secondary">{theme.percentage}%</Badge>}
                                </h4>
                                <p className="text-sm text-muted-foreground">{theme.description}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          // Fallback for string legacy data
                          <p className="whitespace-pre-wrap">{typeof analysisData.contentThemes === 'string' ? analysisData.contentThemes : "No hay pilares definidos."}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardSources cardKey="pillars" isEditing={isEditing} onOpen={setDocumentCard} />
              </Card>
            </TabsContent>

            {/* COMMUNICATION TAB */}
            <TabsContent value="content" id="brand-brain-content-communication" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Estilo y Tono</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <>
                        <FormField
                          control={form.control}
                          name="brandTone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tono de Voz</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar tono" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="professional">Profesional</SelectItem>
                                  <SelectItem value="casual">Casual / Cercano</SelectItem>
                                  <SelectItem value="funny">Humorístico / Divertido</SelectItem>
                                  <SelectItem value="serious">Serio / Autoritativo</SelectItem>
                                  <SelectItem value="inspirational">Inspiracional</SelectItem>
                                  <SelectItem value="educational">Educativo</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="brandCommunicationStyle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estilo de Comunicación</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Detalles sobre cómo habla la marca (vocabulario, emojis, longitud...)" className="min-h-[100px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">Tono:</span>
                          <Badge variant="outline" className="capitalize">{analysisData.brandTone || "No definido"}</Badge>
                        </div>
                        <div>
                          <span className="font-semibold text-sm block mb-1">Estilo:</span>
                          <p className="text-sm bg-muted/30 p-2 rounded">{analysisData.brandCommunicationStyle || "No definido"}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                  <CardSources cardKey="communication-style" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Palabras Clave y Temas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="keywords"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Keywords SEO/Marca</FormLabel>
                            <FormControl>
                              <Input placeholder="Separadas por comas" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Keywords</h4>
                        <div className="flex flex-wrap gap-1">
                          {analysisData.keywords ?
                            analysisData.keywords.split(',').map((k: string, i: number) => (
                              <Badge key={i} variant="secondary">{k.trim()}</Badge>
                            )) : <span className="text-sm text-muted-foreground">No definidas</span>
                          }
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardSources cardKey="communication-keywords" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>
              </div>
            </TabsContent>

            {/* COMPETITORS TAB (New) */}
            <TabsContent value="context" id="brand-brain-context-competitors" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Análisis Competitivo</CardTitle>
                      <CardDescription>Comparativa directa para encontrar tu ventaja</CardDescription>
                    </div>
                    {isEditing && (
                      <Button type="button" size="sm" onClick={() => competitorsFieldArray.append({ name: "" })}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar Competidor
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isEditing ? (
                      competitorsFieldArray.fields.map((field, index) => (
                        <Card key={field.id} className="border p-4">
                          <div className="flex justify-between mb-4">
                            <h4 className="font-medium">Competidor #{index + 1}</h4>
                            <Button type="button" size="icon" variant="ghost" className="text-destructive h-6 w-6" onClick={() => competitorsFieldArray.remove(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`competitorAnalysis.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre/Marca</FormLabel>
                                  <FormControl><Input placeholder="Competidor X" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`competitorAnalysis.${index}.ourAdvantage`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-primary font-bold">Nuestra Ventaja (Diferenciador)</FormLabel>
                                  <FormControl><Input placeholder="En qué somos mejores" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`competitorAnalysis.${index}.strengths`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sus Fortalezas</FormLabel>
                                  <FormControl><Textarea placeholder="Qué hacen bien" className="h-[80px]" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`competitorAnalysis.${index}.weaknesses`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sus Debilidades</FormLabel>
                                  <FormControl><Textarea placeholder="Qué hacen mal" className="h-[80px]" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {analysisData.competitorAnalysis && Array.isArray(analysisData.competitorAnalysis) ? (
                          analysisData.competitorAnalysis.map((comp: any, i: number) => (
                            <Card key={i} className="bg-muted/10">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">{comp.name}</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm">
                                {comp.ourAdvantage && <div className="text-green-600 font-medium">✨ Ventaja: {comp.ourAdvantage}</div>}
                                {comp.strengths && <div><span className="font-semibold">Fortalezas:</span> {comp.strengths}</div>}
                                {comp.weaknesses && <div><span className="font-semibold">Debilidades:</span> {comp.weaknesses}</div>}
                              </CardContent>
                            </Card>
                          ))
                        ) : (
                          // Fallback for legacy string data
                          <p className="whitespace-pre-wrap">{typeof analysisData.competitorAnalysis === 'string' ? analysisData.competitorAnalysis : "No hay datos."}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardSources cardKey="competitors" isEditing={isEditing} onOpen={setDocumentCard} />
              </Card>
            </TabsContent>

            {/* CALENDAR TAB (New) */}
            <TabsContent value="context" id="brand-brain-context-calendar" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Calendario Estacional</CardTitle>
                      <CardDescription>Fechas comerciales y eventos clave</CardDescription>
                    </div>
                    {isEditing && (
                      <Button type="button" size="sm" onClick={() => calendarFieldArray.append({ date: "", eventName: "Nuevo Evento", importance: "medium" })}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar Evento
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      {calendarFieldArray.fields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-start p-2 border rounded-md bg-muted/20">
                          <div className="grid gap-2 flex-1 md:grid-cols-4">
                            <FormField
                              control={form.control}
                              name={`seasonalCalendar.${index}.date`}
                              render={({ field }) => (
                                <FormItem><FormControl><Input placeholder="Fecha/Mes" {...field} /></FormControl></FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`seasonalCalendar.${index}.eventName`}
                              render={({ field }) => (
                                <FormItem className="md:col-span-2"><FormControl><Input placeholder="Nombre del Evento" {...field} /></FormControl></FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`seasonalCalendar.${index}.importance`}
                              render={({ field }) => (
                                <FormItem>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                          <Button type="button" variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => calendarFieldArray.remove(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {analysisData.seasonalCalendar && Array.isArray(analysisData.seasonalCalendar) && analysisData.seasonalCalendar.map((event: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                          <span className="text-xl">{event.importance === 'high' ? '🔴' : event.importance === 'medium' ? '🟡' : '🟢'}</span>
                          <Badge variant="outline">{event.date}</Badge>
                          <span className="font-medium">{event.eventName}</span>
                          {event.contentIdeas && <span className="text-muted-foreground text-sm">- {event.contentIdeas}</span>}
                        </div>
                      ))}
                      {(!analysisData.seasonalCalendar || analysisData.seasonalCalendar.length === 0) && <p className="text-muted-foreground">No hay eventos configurados.</p>}
                    </div>
                  )}
                </CardContent>
                <CardSources cardKey="calendar" isEditing={isEditing} onOpen={setDocumentCard} />
              </Card>
            </TabsContent>

            {/* POLICIES TAB */}
            <TabsContent value="content" id="brand-brain-content-policies" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-green-200 dark:border-green-900 bg-green-50/10">
                  <CardHeader>
                    <CardTitle className="text-green-700 dark:text-green-400">Políticas de Respuesta Positiva</CardTitle>
                    <CardDescription>Cómo responder a halagos y clientes felices</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="responsePolicyPositive"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Guía de interacción positiva" className="min-h-[150px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{analysisData.responsePolicyPositive || "No definida"}</p>
                    )}
                  </CardContent>
                  <CardSources cardKey="policies-positive" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>

                <Card className="border-red-200 dark:border-red-900 bg-red-50/10">
                  <CardHeader>
                    <CardTitle className="text-red-700 dark:text-red-400">Políticas de Crisis / Negativos</CardTitle>
                    <CardDescription>Protocolo para quejas y comentarios negativos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="responsePolicyNegative"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Guía de gestión de crisis" className="min-h-[150px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{analysisData.responsePolicyNegative || "No definida"}</p>
                    )}
                  </CardContent>
                  <CardSources cardKey="policies-negative" isEditing={isEditing} onOpen={setDocumentCard} />
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          {isEditing && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>Fuentes sin clasificar</CardTitle>
                <CardDescription>Documentos existentes que todavía no pertenecen a una tarjeta.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" variant="outline" onClick={() => setDocumentCard("unclassified")}>
                  Revisar y reubicar fuentes
                </Button>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
      <ProjectDocuments
        projectId={project.id}
        cardKey={documentCard}
        canEdit={canEdit}
        onOpenChange={(open) => !open && setDocumentCard(null)}
      />
    </div >
  );
}
