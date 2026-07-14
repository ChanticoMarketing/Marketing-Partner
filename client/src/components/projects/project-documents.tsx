import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, CheckCircle2, FileIcon, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fromDbArray } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Document as KnowledgeItem } from "@/shared/schema";
import { BRAND_BRAIN_CARDS, type BrandBrainCardKey } from "@/lib/brand-brain-cards";

interface ProjectDocumentsProps {
  projectId: number;
  cardKey: BrandBrainCardKey | "unclassified" | null;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusBadge(status: KnowledgeItem["status"]) {
  const config = {
    approved: { label: "Aprobada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    review: { label: "En revisión", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    processing: { label: "Procesando", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    archived: { label: "Archivada", className: "bg-muted text-muted-foreground border-transparent" },
    failed: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/20" },
    draft: { label: "Borrador", className: "bg-muted/50 text-muted-foreground border-border/50" },
  }[status];

  return <Badge variant="outline" className={`font-medium text-xs rounded-md px-2 py-0.5 ${config.className}`}>{config.label}</Badge>;
}

export default function ProjectDocuments({
  projectId,
  cardKey,
  canEdit,
  onOpenChange,
}: ProjectDocumentsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManual, setIsManual] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", content: "" });
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", content: "" });
  const [moveTargets, setMoveTargets] = useState<Record<number, BrandBrainCardKey>>({});

  const isOpen = cardKey !== null;
  const isUnclassified = cardKey === "unclassified";
  const card = BRAND_BRAIN_CARDS.find((item) => item.key === cardKey);
  const title = isUnclassified ? "Fuentes sin clasificar" : card?.label || "Documentos";

  useRealtimeSync({
    table: "documents",
    filter: `project_id=eq.${projectId}`,
    queryKey: ["projects", projectId, "documents"],
  });

  const { data: documents = [], isLoading } = useQuery<KnowledgeItem[]>({
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

  const items = documents.filter((item) =>
    isUnclassified
      ? !item.metadata?.brandBrainCard
      : item.metadata?.brandBrainCard === cardKey,
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "documents"] });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!cardKey || isUnclassified) return;

      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        body.append("projectId", String(projectId));
        body.append("category", "brand_brain");
        body.append("subcategory", cardKey);
        body.append("brandBrainCard", cardKey);
        const { error } = await supabase.functions.invoke("analyze-document", { body });
        if (error) throw error;
      }
    },
    onSuccess: (_, files) => {
      toast({ title: "Archivos enviados", description: `${files.length} archivo(s) enviados a ${title}.` });
      invalidate();
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error) => toast({ title: "No se pudo subir", description: (error as Error).message, variant: "destructive" }),
  });

  const manageMutation = useMutation({
    mutationFn: async (input: { action: "create-manual" | "update" | "approve" | "archive" | "delete"; itemId?: number; payload?: Record<string, unknown> }) => {
      const { error } = await supabase.functions.invoke("manage-knowledge", {
        body: { ...input, projectId },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const close = () => {
    setIsManual(false);
    setEditingItem(null);
    onOpenChange(false);
  };

  const createManual = async () => {
    if (!cardKey || isUnclassified || !manualForm.name.trim()) return;
    await manageMutation.mutateAsync({
      action: "create-manual",
      payload: {
        name: manualForm.name.trim(),
        content: manualForm.content,
        category: "brand_brain",
        subcategory: cardKey,
        brandBrainCard: cardKey,
      },
    });
    setManualForm({ name: "", content: "" });
    setIsManual(false);
    toast({ title: "Fuente creada", description: "Quedó lista para revisión." });
  };

  const saveItem = async () => {
    if (!editingItem) return;
    await manageMutation.mutateAsync({
      action: "update",
      itemId: editingItem.id,
      payload: { name: editForm.name, content: editForm.content },
    });
    setEditingItem(null);
    toast({ title: "Fuente actualizada" });
  };

  const moveItem = async (item: KnowledgeItem) => {
    const target = moveTargets[item.id];
    if (!target) return;
    await manageMutation.mutateAsync({
      action: "update",
      itemId: item.id,
      payload: { category: "brand_brain", subcategory: target, brandBrainCard: target },
    });
    toast({ title: "Fuente reubicada" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:rounded-2xl p-0 gap-0">
        <div className="p-6 md:p-8 border-b border-border/50 bg-muted/5">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-2xl font-heading">{title}</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground leading-relaxed">
              {isUnclassified
                ? "Reubica los documentos heredados hacia la sección estratégica correspondiente."
                : "Agrega y administra la base documental que respalda esta sección estratégica."}
            </DialogDescription>
          </DialogHeader>

          {!isUnclassified && canEdit && !isManual && !editingItem && (
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(event) => uploadMutation.mutate(Array.from(event.target.files || []))}
              />
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} className="rounded-full shadow-sm">
                {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Subir archivos
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsManual(true)} className="rounded-full bg-background">
                <Plus className="mr-2 h-4 w-4" />
                Crear apunte manual
              </Button>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          {isManual ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Título del apunte</Label>
                <Input placeholder="Ej. Notas de la reunión inicial" className="bg-muted/30" value={manualForm.name} onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Contenido base</Label>
                <Textarea placeholder="Escribe aquí el texto que servirá de fuente..." className="min-h-[200px] resize-none bg-muted/30 leading-relaxed" value={manualForm.content} onChange={(event) => setManualForm((current) => ({ ...current, content: event.target.value }))} />
              </div>
              <DialogFooter className="pt-4 border-t border-border/50">
                <Button variant="ghost" onClick={() => setIsManual(false)}>Cancelar</Button>
                <Button disabled={manageMutation.isPending || !manualForm.name.trim()} onClick={createManual} className="rounded-full px-6">Crear apunte</Button>
              </DialogFooter>
            </div>
          ) : editingItem ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Título del documento</Label>
                <Input className="bg-muted/30" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Contenido fuente</Label>
                <Textarea className="min-h-[200px] resize-none bg-muted/30 leading-relaxed" value={editForm.content} onChange={(event) => setEditForm((current) => ({ ...current, content: event.target.value }))} />
              </div>
              <DialogFooter className="pt-4 border-t border-border/50">
                <Button variant="ghost" onClick={() => setEditingItem(null)}>Cancelar</Button>
                <Button disabled={manageMutation.isPending} onClick={saveItem} className="rounded-full px-6">Guardar cambios</Button>
              </DialogFooter>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 text-muted-foreground animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center animate-in fade-in duration-500">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                <FileIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-heading font-medium text-foreground">No hay fuentes vinculadas</h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                El contexto mejora drásticamente cuando respaldas la estrategia con documentos y apuntes reales.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="group rounded-xl border border-border/50 bg-card p-5 hover:border-border/80 transition-all duration-200 hover:shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-medium text-foreground truncate">{item.name}</p>
                        {getStatusBadge(item.status)}
                      </div>
                      {item.content && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{item.content}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditingItem(item); setEditForm({ name: item.name, content: item.content || "" }); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {item.status !== "approved" && item.status !== "processing" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50" onClick={() => manageMutation.mutate({ action: "approve", itemId: item.id })} title="Aprobar fuente">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === "approved" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => manageMutation.mutate({ action: "archive", itemId: item.id })} title="Archivar">
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => manageMutation.mutate({ action: "delete", itemId: item.id })} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isUnclassified && canEdit && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-border/50">
                      <Select onValueChange={(value) => setMoveTargets((current) => ({ ...current, [item.id]: value as BrandBrainCardKey }))}>
                        <SelectTrigger className="w-full sm:w-[240px] h-9 text-sm bg-muted/30">
                          <SelectValue placeholder="Clasificar en sección..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAND_BRAIN_CARDS.map((target) => (
                            <SelectItem key={target.key} value={target.key}>{target.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-9 px-4 rounded-md" disabled={!moveTargets[item.id] || manageMutation.isPending} onClick={() => moveItem(item)}>
                        Clasificar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {!isManual && !editingItem && (
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={close} className="rounded-full px-6 hover:bg-accent">Cerrar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
