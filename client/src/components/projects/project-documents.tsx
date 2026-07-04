import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Archive,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileIcon,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fromDbArray } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Document as KnowledgeItem } from "@/shared/schema";

const SECTION_OPTIONS = {
  branding: [
    { value: "manual-de-marca", label: "Manual de Marca" },
    { value: "tono-de-marca", label: "Tono de Marca" },
    { value: "colores-de-marca", label: "Colores de Marca" },
    { value: "other", label: "Otra subsección" },
  ],
  strategy: [
    { value: "palabras-clave", label: "Palabras Clave" },
    { value: "palabras-a-evitar", label: "Palabras a Evitar" },
    { value: "ctas", label: "CTA's" },
    { value: "faq", label: "FAQ" },
    { value: "other", label: "Otra subsección" },
  ],
  examples: [
    { value: "publicaciones-y-resultados", label: "Publicaciones y resultados" },
    { value: "disenos-de-marca", label: "Diseños de la marca" },
    { value: "other", label: "Otra subsección" },
  ],
} as const;

type Category = keyof typeof SECTION_OPTIONS;

type EditState = {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  content: string;
  summary: string;
  structuredDataText: string;
  keyPointsText: string;
  keywordsText: string;
};

interface ProjectDocumentsProps {
  projectId: number;
  projectName: string;
  canApprove: boolean;
}

function getSubcategoryLabel(category: string, subcategory: string) {
  const options = SECTION_OPTIONS[category as Category] || [];
  return options.find((option) => option.value === subcategory)?.label || subcategory;
}

function createEditState(item: KnowledgeItem): EditState {
  const metadata = item.metadata || {};
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    content: item.content || "",
    summary: metadata.summary || metadata.analysisResults?.summary || "",
    structuredDataText: JSON.stringify(
      metadata.structuredData || metadata.analysisResults?.structuredData || {},
      null,
      2,
    ),
    keyPointsText: Array.isArray(metadata.keyPoints || metadata.analysisResults?.keyPoints)
      ? (metadata.keyPoints || metadata.analysisResults?.keyPoints).join("\n")
      : "",
    keywordsText: Array.isArray(metadata.keywords || metadata.analysisResults?.keywords)
      ? (metadata.keywords || metadata.analysisResults?.keywords).join(", ")
      : "",
  };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" />
          Aprobado
        </Badge>
      );
    case "review":
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
          <Sparkles className="h-3 w-3" />
          En revisión
        </Badge>
      );
    case "processing":
      return (
        <Badge className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 animate-spin" />
          Procesando
        </Badge>
      );
    case "archived":
      return (
        <Badge className="gap-1 bg-slate-100 text-slate-700 hover:bg-slate-100">
          <Archive className="h-3 w-3" />
          Archivado
        </Badge>
      );
    case "failed":
      return (
        <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100">
          <AlertCircle className="h-3 w-3" />
          Falló
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock3 className="h-3 w-3" />
          Borrador
        </Badge>
      );
  }
}

export default function ProjectDocuments({
  projectId,
  projectName,
  canApprove,
}: ProjectDocumentsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<Category>("branding");
  const [uploadSubcategory, setUploadSubcategory] = useState("manual-de-marca");
  const [customSubcategory, setCustomSubcategory] = useState("");
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [manualForm, setManualForm] = useState({
    name: "",
    category: "branding",
    subcategory: "manual-de-marca",
    customSubcategory: "",
    content: "",
  });

  useRealtimeSync({
    table: "documents",
    filter: `project_id=eq.${projectId}`,
    queryKey: ["projects", projectId, "documents"],
  });

  const { data: items, isLoading, error } = useQuery<KnowledgeItem[]>({
    queryKey: ["projects", projectId, "documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return fromDbArray<KnowledgeItem>("documents", data);
    },
    staleTime: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", String(projectId));
        formData.append("category", uploadCategory);
        formData.append(
          "subcategory",
          uploadSubcategory === "other" ? customSubcategory.trim() || "other" : uploadSubcategory,
        );

        const { error } = await supabase.functions.invoke("analyze-document", { body: formData });
        if (error) throw error;
      }
    },
    onSuccess: (_, files) => {
      toast({
        title: "Archivos enviados",
        description: `${files.length} archivo(s) fueron enviados al centro de conocimiento.`,
      });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "documents"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (mutationError) => {
      toast({
        title: "No se pudo subir el archivo",
        description: (mutationError as Error).message,
        variant: "destructive",
      });
    },
  });

  const manageMutation = useMutation({
    mutationFn: async (input: { action: string; itemId?: number; payload?: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke("manage-knowledge", {
        body: {
          action: input.action,
          projectId,
          itemId: input.itemId,
          payload: input.payload,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });

  const groupedItems = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: KnowledgeItem[] }> = [];

    (Object.keys(SECTION_OPTIONS) as Category[]).forEach((category) => {
      const categoryItems = (items || []).filter((item) => item.category === category);
      groups.push({
        key: category,
        label:
          category === "branding"
            ? "Branding"
            : category === "strategy"
              ? "Estrategia"
              : "Ejemplos",
        items: categoryItems,
      });
    });

    const customItems = (items || []).filter(
      (item) => !["branding", "strategy", "examples"].includes(item.category),
    );

    if (customItems.length > 0) {
      groups.push({ key: "custom", label: "Otras secciones", items: customItems });
    }

    return groups.filter((group) => group.items.length > 0);
  }, [items]);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  };

  const handleCreateManual = async () => {
    if (!manualForm.name.trim()) {
      toast({ title: "Falta el título", description: "Añade un nombre para este conocimiento.", variant: "destructive" });
      return;
    }

    try {
      await manageMutation.mutateAsync({
        action: "create-manual",
        payload: {
          name: manualForm.name.trim(),
          category: manualForm.category,
          subcategory: manualForm.subcategory === "other"
            ? manualForm.customSubcategory.trim() || "other"
            : manualForm.subcategory,
          content: manualForm.content,
        },
      });

      toast({
        title: "Conocimiento creado",
        description: "Quedó listo para revisión y aprobación.",
      });
      setIsManualOpen(false);
      setManualForm({
        name: "",
        category: "branding",
        subcategory: "manual-de-marca",
        customSubcategory: "",
        content: "",
      });
    } catch (mutationError) {
      toast({
        title: "No se pudo crear",
        description: (mutationError as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editState) return;

    let structuredData: unknown = {};
    try {
      structuredData = editState.structuredDataText.trim()
        ? JSON.parse(editState.structuredDataText)
        : {};
    } catch {
      toast({
        title: "JSON inválido",
        description: "Revisa el bloque de datos estructurados antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await manageMutation.mutateAsync({
        action: "update",
        itemId: editState.id,
        payload: {
          name: editState.name,
          category: editState.category,
          subcategory: editState.subcategory,
          content: editState.content,
          summary: editState.summary,
          structuredData,
          keyPoints: editState.keyPointsText
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          keywords: editState.keywordsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      });

      toast({
        title: "Conocimiento actualizado",
        description: "Los cambios quedaron guardados.",
      });
      setSelectedItem(null);
      setEditState(null);
    } catch (mutationError) {
      toast({
        title: "No se pudo guardar",
        description: (mutationError as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleModerationAction = async (action: "approve" | "archive" | "delete", item: KnowledgeItem) => {
    try {
      await manageMutation.mutateAsync({ action, itemId: item.id });
      toast({
        title:
          action === "approve"
            ? "Conocimiento aprobado"
            : action === "archive"
              ? "Conocimiento archivado"
              : "Conocimiento eliminado",
        description: item.name,
      });
      setSelectedItem(null);
      setEditState(null);
    } catch (mutationError) {
      toast({
        title: "No se pudo completar la acción",
        description: (mutationError as Error).message,
        variant: "destructive",
      });
    }
  };

  const selectedMetadata = selectedItem?.metadata || {};
  const selectedSummary = selectedMetadata.summary || selectedMetadata.analysisResults?.summary || "";

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
        Error al cargar el centro de conocimiento: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-5 w-5" />
            Centro de conocimiento de {projectName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Sección</Label>
              <Select
                value={uploadCategory}
                onValueChange={(value: Category) => {
                  setUploadCategory(value);
                  setUploadSubcategory(SECTION_OPTIONS[value][0].value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branding">Branding</SelectItem>
                  <SelectItem value="strategy">Estrategia</SelectItem>
                  <SelectItem value="examples">Ejemplos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subsección</Label>
              <Select value={uploadSubcategory} onValueChange={setUploadSubcategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_OPTIONS[uploadCategory].map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subsección personalizada</Label>
              <Input
                value={customSubcategory}
                onChange={(event) => setCustomSubcategory(event.target.value)}
                placeholder="Solo si eliges Otra subsección"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFilesSelected}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="gap-2"
            >
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Subir archivos
            </Button>
            <Button variant="outline" onClick={() => setIsManualOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear manualmente
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Formatos v1: PDF, DOCX, TXT, CSV, XLSX, PNG, JPG y WebP. La IA propone estructura,
            pero solo el contenido aprobado se usa como fuente oficial.
          </p>
        </CardContent>
      </Card>

      {groupedItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FileIcon className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">Todavía no hay conocimiento cargado.</p>
              <p className="text-sm text-muted-foreground">
                Sube documentos de branding, estrategia o ejemplos para empezar.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {groupedItems.map((group) => (
            <AccordionItem key={group.key} value={group.key} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="text-base font-semibold">
                {group.label} ({group.items.length})
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                {group.items.map((item) => {
                  const metadata = item.metadata || {};
                  const summary = metadata.summary || metadata.analysisResults?.summary || "Sin resumen";

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.name}</p>
                            {getStatusBadge(item.status)}
                            <Badge variant="outline">
                              {getSubcategoryLabel(item.category, item.subcategory)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{summary}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sourceKind === "manual" ? "Carga manual" : "Archivo"}
                            {" · "}
                            {format(parseISO(String(item.createdAt)), "MMM d, yyyy")}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setSelectedItem(item);
                              setEditState(createEditState(item));
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Revisar
                          </Button>
                          {canApprove && item.status !== "approved" && item.status !== "processing" && (
                            <Button
                              size="sm"
                              className="gap-2"
                              onClick={() => handleModerationAction("approve", item)}
                              disabled={manageMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Aprobar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo conocimiento manual</DialogTitle>
            <DialogDescription>
              Úsalo para cargar reglas, FAQs o notas aunque no exista un archivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={manualForm.name}
                onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sección</Label>
                <Select
                  value={manualForm.category}
                  onValueChange={(value: Category) =>
                    setManualForm((current) => ({
                      ...current,
                      category: value,
                      subcategory: SECTION_OPTIONS[value][0].value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branding">Branding</SelectItem>
                    <SelectItem value="strategy">Estrategia</SelectItem>
                    <SelectItem value="examples">Ejemplos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subsección</Label>
                <Select
                  value={manualForm.subcategory}
                  onValueChange={(value) => setManualForm((current) => ({ ...current, subcategory: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_OPTIONS[manualForm.category as Category].map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {manualForm.subcategory === "other" && (
              <div className="space-y-2">
                <Label>Nombre de la subsección</Label>
                <Input
                  value={manualForm.customSubcategory}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, customSubcategory: event.target.value }))
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Contenido base</Label>
              <Textarea
                rows={10}
                value={manualForm.content}
                onChange={(event) => setManualForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Pega aquí la información para que la IA la estructure."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateManual} disabled={manageMutation.isPending}>
              {manageMutation.isPending ? "Guardando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedItem && editState)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
            setEditState(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
            <DialogDescription>
              Ajusta el resumen y los datos estructurados antes de aprobar.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && editState && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(selectedItem.status)}
                <Badge variant="outline">
                  {getSubcategoryLabel(selectedItem.category, selectedItem.subcategory)}
                </Badge>
                {selectedItem.approvedAt && (
                  <Badge variant="outline">
                    Activo desde {format(parseISO(String(selectedItem.approvedAt)), "MMM d, yyyy")}
                  </Badge>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={editState.name}
                    onChange={(event) => setEditState((current) => current ? { ...current, name: event.target.value } : current)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subsección</Label>
                  <Input
                    value={editState.subcategory}
                    onChange={(event) => setEditState((current) => current ? { ...current, subcategory: event.target.value } : current)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Resumen</Label>
                <Textarea
                  rows={3}
                  value={editState.summary}
                  onChange={(event) => setEditState((current) => current ? { ...current, summary: event.target.value } : current)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Puntos clave</Label>
                  <Textarea
                    rows={6}
                    value={editState.keyPointsText}
                    onChange={(event) => setEditState((current) => current ? { ...current, keyPointsText: event.target.value } : current)}
                    placeholder="Un punto por línea"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keywords</Label>
                  <Textarea
                    rows={6}
                    value={editState.keywordsText}
                    onChange={(event) => setEditState((current) => current ? { ...current, keywordsText: event.target.value } : current)}
                    placeholder="Separadas por coma"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Datos estructurados</Label>
                <Textarea
                  rows={12}
                  className="font-mono text-xs"
                  value={editState.structuredDataText}
                  onChange={(event) => setEditState((current) => current ? { ...current, structuredDataText: event.target.value } : current)}
                />
              </div>

              <div className="space-y-2">
                <Label>Contenido base</Label>
                <Textarea
                  rows={8}
                  value={editState.content}
                  onChange={(event) => setEditState((current) => current ? { ...current, content: event.target.value } : current)}
                />
              </div>

              {selectedSummary && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Sugerencia original de IA: {selectedSummary}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {canApprove && selectedItem && (
                <>
                  {selectedItem.status !== "approved" && (
                    <Button
                      onClick={() => handleModerationAction("approve", selectedItem)}
                      disabled={manageMutation.isPending}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Aprobar
                    </Button>
                  )}
                  {selectedItem.status === "approved" && (
                    <Button
                      variant="outline"
                      onClick={() => handleModerationAction("archive", selectedItem)}
                      disabled={manageMutation.isPending}
                      className="gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      Archivar
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => handleModerationAction("delete", selectedItem)}
                    disabled={manageMutation.isPending}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedItem(null);
                  setEditState(null);
                }}
              >
                Cerrar
              </Button>
              <Button onClick={handleSaveEdit} disabled={manageMutation.isPending}>
                Guardar cambios
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
