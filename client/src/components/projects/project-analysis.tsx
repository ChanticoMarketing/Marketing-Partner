import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { toDb } from "@/lib/supabase-helpers";
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

type AnalysisValues = z.infer<typeof analysisSchema>;
type AnalysisTab = "brand" | "customer" | "content" | "context";

const ANALYSIS_FIELDS_BY_TAB: Record<AnalysisTab, (keyof AnalysisValues)[]> = {
  brand: ["mission", "vision", "coreValues", "uniqueValueProposition"],
  customer: ["buyerPersona", "targetAudience", "customerQuotes", "customerObjections", "customerVocabulary"],
  content: ["contentThemes", "brandTone", "brandCommunicationStyle", "keywords", "responsePolicyPositive", "responsePolicyNegative"],
  context: ["objectives", "marketingStrategies", "competitorAnalysis", "seasonalCalendar"],
};

export default function ProjectAnalysis({ project, canEdit }: ProjectAnalysisProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("brand");
  const [documentCard, setDocumentCard] = useState<BrandBrainCardKey | "unclassified" | null>(null);

  // Get analysis data from project
  const analysisData = project?.analysis || {};

  // Initialize form with project analysis data
  const defaultValues: AnalysisValues = {
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
    uniqueValueProposition: analysisData.uniqueValueProposition || "",
    customerObjections: analysisData.customerObjections || "",
    customerVocabulary: analysisData.customerVocabulary || "",
    contentThemes: Array.isArray(analysisData.contentThemes) ? analysisData.contentThemes : [],
    competitorAnalysis: Array.isArray(analysisData.competitorAnalysis) ? analysisData.competitorAnalysis : [],
    customerQuotes: Array.isArray(analysisData.customerQuotes) ? analysisData.customerQuotes : [],
    seasonalCalendar: Array.isArray(analysisData.seasonalCalendar) ? analysisData.seasonalCalendar : [],
  };

  const form = useForm<AnalysisValues>({
    resolver: zodResolver(analysisSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [analysisData.updatedAt, project.id]);

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
    mutationFn: async (values: AnalysisValues) => {
      const payload = Object.fromEntries(
        ANALYSIS_FIELDS_BY_TAB[activeTab].map((field) => [field, values[field]]),
      );
      const { error } = await supabase
        .from("analysis_results")
        .upsert(toDb("analysis_results", { ...payload, projectId: project.id }), {
          onConflict: "project_id",
        });
      if (error) throw error;
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
  const onSubmit = (values: AnalysisValues) => {
    updateAnalysisMutation.mutate(values);
  };

  const hasAnalysis = analysisData && Object.keys(analysisData).length > 0;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-background/95 backdrop-blur z-10 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Centro de marca</h2>
          <p className="text-muted-foreground text-sm">El contexto estratégico que guía el contenido, las decisiones y Chantia IA.</p>
        </div>
        {canEdit && !isEditing && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="gap-2 border-border hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            <span>Editar estrategia</span>
          </Button>
        )}
        {canEdit && isEditing && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="gap-2 flex-1 sm:flex-none"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={form.handleSubmit(onSubmit)}
              disabled={updateAnalysisMutation.isPending}
              className="gap-2 flex-1 sm:flex-none bg-ember-600 hover:bg-ember-700 text-white"
            >
              <Save className="h-4 w-4" />
              {updateAnalysisMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="pb-20">
          {/* ponytail: group the existing cards without changing their data contract. */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisTab)} className="space-y-8 mt-2">
            <TabsList className="flex overflow-x-auto w-full justify-start h-auto bg-transparent border-b rounded-none p-0 space-x-8 mb-6">
              <TabsTrigger value="brand" className="flex items-center py-3 gap-2 h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-ember-600 data-[state=active]:text-ember-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Marca</span>
              </TabsTrigger>
              <TabsTrigger value="customer" className="flex items-center py-3 gap-2 h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-ember-600 data-[state=active]:text-ember-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Audiencia</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center py-3 gap-2 h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-ember-600 data-[state=active]:text-ember-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Contenido</span>
              </TabsTrigger>
              <TabsTrigger value="context" className="flex items-center py-3 gap-2 h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-ember-600 data-[state=active]:text-ember-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <BarChart className="h-4 w-4" />
                <span className="text-sm font-medium">Contexto</span>
              </TabsTrigger>
            </TabsList>

            {/* MARCA TAB */}
            <TabsContent value="brand" className="space-y-12">
              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Identidad Core</h3>
                    <p className="text-sm text-muted-foreground mt-1">El propósito fundamental y principios que guían la marca.</p>
                  </div>
                  <CardSources cardKey="identity-purpose" isEditing={isEditing} onOpen={setDocumentCard} />
                </div>
                
                <div className="grid gap-8 md:grid-cols-2 bg-muted/10 p-6 rounded-xl border border-border/50">
                  {/* Misión & Visión */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">Misión</h4>
                      {isEditing ? (
                        <FormField
                          control={form.control}
                          name="mission"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea placeholder="Qué hace la empresa y para quién" className="min-h-[120px] resize-none" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {analysisData.mission || <span className="text-muted-foreground italic">Sin definir</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">Visión</h4>
                      {isEditing ? (
                        <FormField
                          control={form.control}
                          name="vision"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea placeholder="A dónde quiere llegar la empresa a futuro" className="min-h-[120px] resize-none" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {analysisData.vision || <span className="text-muted-foreground italic">Sin definir</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Valores Centrales */}
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium flex items-center gap-2">Valores Centrales</h4>
                      <CardSources cardKey="identity-values" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="coreValues"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Listado de valores (ej: Transparencia, Calidad, Innovación)" className="min-h-[290px] resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-3 mt-4">
                        {analysisData.coreValues ? (
                          analysisData.coreValues.split(/[\n,]+/).filter((v:string)=>v.trim()).map((val: string, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <span className="text-sm leading-relaxed">{val.trim()}</span>
                            </div>
                          ))
                        ) : <p className="text-sm text-muted-foreground italic">Sin definir</p>}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* UVP SECTION */}
              <section id="brand-brain-uvp" className="pt-2">
                <div className="rounded-xl border border-warm-gold/30 bg-warm-gold/5 overflow-hidden">
                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-heading font-semibold text-warm-gold-700 dark:text-warm-gold-400">Propuesta de Valor Única (UVP)</h3>
                        <p className="text-sm text-muted-foreground mt-1">La razón principal por la que una persona elegiría esta marca.</p>
                      </div>
                      <CardSources cardKey="uvp" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>
                    
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="uniqueValueProposition"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder="Describe tu diferenciador clave. Aquello que la competencia no puede copiar fácilmente."
                                className="min-h-[120px] text-base resize-none bg-background/50 focus:bg-background"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
                          {analysisData.uniqueValueProposition || <span className="text-muted-foreground italic">Sin definir</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* AUDIENCIA TAB */}
            <TabsContent value="customer" className="space-y-12">
              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Perfil de Audiencia</h3>
                    <p className="text-sm text-muted-foreground mt-1">A quién nos dirigimos y cómo es nuestro cliente ideal.</p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="bg-muted/10 p-6 rounded-xl border border-border/50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium flex items-center gap-2">Buyer Persona</h4>
                      <CardSources cardKey="audience-persona" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="buyerPersona"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Descripción detallada: Datos demográficos, dolores, motivaciones, objeciones..." className="min-h-[250px] resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                        <p className="whitespace-pre-wrap leading-relaxed">{analysisData.buyerPersona || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-muted/10 p-6 rounded-xl border border-border/50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium flex items-center gap-2">Audiencia General</h4>
                      <CardSources cardKey="audience-general" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="targetAudience"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Segmentos generales a los que se dirige la marca" className="min-h-[250px] resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                        <p className="whitespace-pre-wrap leading-relaxed">{analysisData.targetAudience || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Voz del Cliente (VoC)</h3>
                    <p className="text-sm text-muted-foreground mt-1">Cómo hablan, qué les preocupa y qué dicen sobre la marca.</p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <Card className="flex flex-col shadow-none border-border/50">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base font-semibold">Frases Reales & Citas</CardTitle>
                        <CardSources cardKey="voice-customer" isEditing={isEditing} onOpen={setDocumentCard} />
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {isEditing && (
                        <Button type="button" size="sm" variant="secondary" className="w-full mb-4" onClick={() => quotesFieldArray.append({ quote: "", context: "" })}>
                          <Plus className="h-4 w-4 mr-2" /> Agregar frase
                        </Button>
                      )}

                      {isEditing ? (
                        <div className="space-y-4">
                          {quotesFieldArray.fields.map((field, index) => (
                            <div key={field.id} className="grid gap-3 p-4 bg-muted/20 border border-border/50 rounded-lg relative group">
                              <FormField
                                control={form.control}
                                name={`customerQuotes.${index}.quote`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Textarea placeholder="Ej: 'Me ahorra 3 horas al día...'" className="min-h-[60px] resize-none" {...field} />
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
                                        <Input placeholder="Contexto (ej: Review en G2)" className="h-9 text-sm" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => quotesFieldArray.remove(index)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {quotesFieldArray.fields.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">No hay frases registradas.</p>}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {analysisData.customerQuotes && Array.isArray(analysisData.customerQuotes) && analysisData.customerQuotes.length > 0 ? (
                            analysisData.customerQuotes.map((q: any, i: number) => (
                              <figure key={i} className="pl-4 border-l-2 border-border py-1">
                                <blockquote className="text-sm italic text-foreground/90 leading-relaxed">"{q.quote}"</blockquote>
                                {q.context && <figcaption className="text-xs text-muted-foreground mt-2 font-medium">— {q.context}</figcaption>}
                              </figure>
                            ))
                          ) : <p className="text-sm text-muted-foreground italic">Sin definir</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex flex-col gap-6 bg-muted/10 p-6 rounded-xl border border-border/50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">Diccionario y Barreras</h4>
                      <CardSources cardKey="voice-vocabulary" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h5 className="text-sm font-semibold mb-2">Objeciones Frecuentes</h5>
                        {isEditing ? (
                          <FormField
                            control={form.control}
                            name="customerObjections"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea placeholder="Miedo al precio / Curva de aprendizaje / etc." className="min-h-[120px] resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{analysisData.customerObjections || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                        )}
                      </div>
                      
                      <div className="border-t border-border/50 pt-6">
                        <h5 className="text-sm font-semibold mb-2">Vocabulario del Nicho</h5>
                        {isEditing ? (
                          <FormField
                            control={form.control}
                            name="customerVocabulary"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea placeholder="Palabras clave, jerga, tecnicismos usados por ellos." className="min-h-[120px] resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{analysisData.customerVocabulary || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </TabsContent>


             {/* CONTENIDO TAB */}
            <TabsContent value="content" className="space-y-12">
              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Pilares de Contenido</h3>
                    <p className="text-sm text-muted-foreground mt-1">Temas principales para generar autoridad y conectar.</p>
                  </div>
                  <CardSources cardKey="pillars" isEditing={isEditing} onOpen={setDocumentCard} />
                </div>
                
                <Card className="shadow-none border-border/50">
                  <CardContent className="p-6">
                    {isEditing && (
                      <Button type="button" size="sm" variant="secondary" className="mb-6" onClick={() => pillarsFieldArray.append({ name: "", description: "", percentage: 0 })}>
                        <Plus className="h-4 w-4 mr-2" /> Nuevo pilar
                      </Button>
                    )}
                    
                    <div className="space-y-4">
                      {isEditing ? (
                        pillarsFieldArray.fields.map((field, index) => (
                          <div key={field.id} className="p-5 border border-border/50 rounded-xl bg-muted/10 grid gap-5 relative group">
                            <div className="flex justify-between items-center">
                              <h4 className="font-medium text-sm">Pilar #{index + 1}</h4>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => pillarsFieldArray.remove(index)}>
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
                                    <FormControl><Textarea placeholder="Qué tipo de contenido incluye este pilar..." className="min-h-[80px] resize-none" {...field} /></FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="space-y-4">
                          {analysisData.contentThemes && Array.isArray(analysisData.contentThemes) && analysisData.contentThemes.length > 0 ? (
                            analysisData.contentThemes.map((theme: any, i: number) => (
                              <div key={i} className="flex justify-between items-start p-4 border border-border/50 bg-muted/10 rounded-xl">
                                <div>
                                  <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                                    {theme.name}
                                    {theme.percentage && <Badge variant="secondary" className="font-normal text-xs">{theme.percentage}%</Badge>}
                                  </h4>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{theme.description}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground italic">{typeof analysisData.contentThemes === 'string' ? analysisData.contentThemes : "Sin definir"}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Guía de Comunicación</h3>
                    <p className="text-sm text-muted-foreground mt-1">Cómo se expresa la marca verbal y textualmente.</p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="bg-muted/10 p-6 rounded-xl border border-border/50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium">Estilo y Tono</h4>
                      <CardSources cardKey="communication-style" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>
                    <div className="space-y-6">
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
                                  <Textarea placeholder="Ej: Usar frases cortas, evitar jerga técnica, siempre incluir emojis..." className="min-h-[120px] resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="keywords"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Palabras Clave (SEO y Branding)</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Separadas por comas" className="min-h-[80px] resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      ) : (
                        <>
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Tono de Voz</h5>
                            <p className="text-sm capitalize">{analysisData.brandTone || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Estilo</h5>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{analysisData.brandCommunicationStyle || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Palabras Clave</h5>
                            <p className="text-sm leading-relaxed">{analysisData.keywords || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-muted/10 p-6 rounded-xl border border-border/50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium">Políticas de Respuesta</h4>
                      <CardSources cardKey="communication-policies" isEditing={isEditing} onOpen={setDocumentCard} />
                    </div>
                    
                    <div className="space-y-6">
                      <div className="border-l-2 border-emerald-500/50 pl-4">
                        <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          Positiva
                        </h5>
                        {isEditing ? (
                          <FormField
                            control={form.control}
                            name="responsePolicyPositive"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea placeholder="Cómo responder a elogios, reviews 5 estrellas, menciones." className="min-h-[100px] resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{analysisData.responsePolicyPositive || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                        )}
                      </div>
                      
                      <div className="border-l-2 border-amber-500/50 pl-4">
                        <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          Negativa / Crisis
                        </h5>
                        {isEditing ? (
                          <FormField
                            control={form.control}
                            name="responsePolicyNegative"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea placeholder="Protocolo para quejas, trolls o crisis de PR." className="min-h-[100px] resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{analysisData.responsePolicyNegative || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* CONTEXTO TAB */}
            <TabsContent value="context" className="space-y-12">
              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Estrategia Global</h3>
                    <p className="text-sm text-muted-foreground mt-1">Objetivos de negocio y directrices de marketing.</p>
                  </div>
                  <CardSources cardKey="strategy" isEditing={isEditing} onOpen={setDocumentCard} />
                </div>
                
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="bg-muted/10 p-6 rounded-xl border border-border/50">
                    <h4 className="font-medium mb-4 flex items-center gap-2">Objetivos de Marketing</h4>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="objectives"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="KPIs y metas específicas" className="min-h-[150px] resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysisData.objectives || <span className="text-muted-foreground italic">Sin definir</span>}</p>
                    )}
                  </div>

                  <div className="bg-muted/10 p-6 rounded-xl border border-border/50">
                    <h4 className="font-medium mb-4 flex items-center gap-2">Estrategias Clave</h4>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name="marketingStrategies"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea placeholder="Estrategias content marketing, ads, email, etc." className="min-h-[150px] resize-none" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysisData.marketingStrategies || <span className="text-muted-foreground italic">Sin definidas</span>}</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Análisis Competitivo</h3>
                    <p className="text-sm text-muted-foreground mt-1">Comparativa directa para encontrar nuestra ventaja.</p>
                  </div>
                  <CardSources cardKey="competitors" isEditing={isEditing} onOpen={setDocumentCard} />
                </div>
                
                <div className="space-y-4">
                  {isEditing && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => competitorsFieldArray.append({ name: "" })}>
                      <Plus className="h-4 w-4 mr-2" /> Agregar Competidor
                    </Button>
                  )}
                  {isEditing ? (
                    <div className="grid gap-6">
                      {competitorsFieldArray.fields.map((field, index) => (
                        <div key={field.id} className="p-6 border border-border/50 rounded-xl bg-muted/10 grid gap-5 relative group">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">Competidor #{index + 1}</h4>
                            <Button type="button" size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => competitorsFieldArray.remove(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-6 md:grid-cols-2">
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
                                  <FormLabel className="text-emerald-600 dark:text-emerald-400 font-semibold">Nuestra Ventaja (Diferenciador)</FormLabel>
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
                                  <FormControl><Textarea placeholder="Qué hacen bien" className="h-[100px] resize-none" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`competitorAnalysis.${index}.weaknesses`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sus Debilidades</FormLabel>
                                  <FormControl><Textarea placeholder="Qué hacen mal" className="h-[100px] resize-none" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      {analysisData.competitorAnalysis && Array.isArray(analysisData.competitorAnalysis) ? (
                        analysisData.competitorAnalysis.map((comp: any, i: number) => (
                          <div key={i} className="bg-muted/10 p-6 rounded-xl border border-border/50">
                            <h4 className="text-lg font-semibold mb-4">{comp.name}</h4>
                            <div className="space-y-4 text-sm">
                              {comp.ourAdvantage && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                  <div className="text-emerald-700 dark:text-emerald-400 font-semibold mb-1 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" /> Ventaja Competitiva
                                  </div>
                                  <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">{comp.ourAdvantage}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                  <span className="font-semibold block mb-1">Fortalezas:</span>
                                  <p className="text-muted-foreground leading-relaxed">{comp.strengths}</p>
                                </div>
                                <div>
                                  <span className="font-semibold block mb-1">Debilidades:</span>
                                  <p className="text-muted-foreground leading-relaxed">{comp.weaknesses}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground italic">{typeof analysisData.competitorAnalysis === 'string' ? analysisData.competitorAnalysis : "Sin definir"}</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Calendario Estacional</h3>
                    <p className="text-sm text-muted-foreground mt-1">Fechas comerciales y eventos clave.</p>
                  </div>
                  <CardSources cardKey="calendar" isEditing={isEditing} onOpen={setDocumentCard} />
                </div>
                
                <Card className="shadow-none border-border/50 bg-muted/5">
                  <CardContent className="p-6">
                    {isEditing && (
                      <Button type="button" size="sm" variant="secondary" className="mb-4" onClick={() => calendarFieldArray.append({ date: "", eventName: "Nuevo Evento", importance: "medium" })}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar Evento
                      </Button>
                    )}
                    
                    {isEditing ? (
                      <div className="space-y-3">
                        {calendarFieldArray.fields.map((field, index) => (
                          <div key={field.id} className="flex gap-4 items-start p-4 border border-border/50 rounded-xl bg-background">
                            <div className="grid gap-4 flex-1 md:grid-cols-4">
                              <FormField
                                control={form.control}
                                name={`seasonalCalendar.${index}.date`}
                                render={({ field }) => (
                                  <FormItem><FormControl><Input placeholder="Fecha/Mes (ej: Nov)" {...field} /></FormControl></FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`seasonalCalendar.${index}.eventName`}
                                render={({ field }) => (
                                  <FormItem className="md:col-span-2"><FormControl><Input placeholder="Nombre (ej: Black Friday)" {...field} /></FormControl></FormItem>
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
                                        <SelectItem value="high">Prioridad Alta</SelectItem>
                                        <SelectItem value="medium">Prioridad Media</SelectItem>
                                        <SelectItem value="low">Prioridad Baja</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-10 w-10 shrink-0 mt-0" onClick={() => calendarFieldArray.remove(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {analysisData.seasonalCalendar && Array.isArray(analysisData.seasonalCalendar) && analysisData.seasonalCalendar.map((event: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-background w-full">
                            <div className={`flex shrink-0 items-center justify-center h-8 w-8 rounded-full ${event.importance === 'high' ? 'bg-destructive/10' : event.importance === 'medium' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                              <CalendarIcon className={`h-4 w-4 ${event.importance === 'high' ? 'text-destructive' : event.importance === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`} />
                            </div>
                            <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">{event.eventName}</span>
                              <Badge variant="secondary" className="font-normal text-xs">{event.date}</Badge>
                            </div>
                          </div>
                        ))}
                        {(!analysisData.seasonalCalendar || analysisData.seasonalCalendar.length === 0) && <p className="text-sm text-muted-foreground italic">Sin definir</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
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
