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
  const label = {
    approved: "Aprobado",
    review: "En revisión",
    processing: "Procesando",
    archived: "Archivado",
    failed: "Falló",
    draft: "Borrador",
  }[status];

  return <Badge variant="outline">{label}</Badge>;
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isUnclassified
              ? "Reubica las fuentes heredadas en la tarjeta que corresponda."
              : "Adjunta y revisa las fuentes que respaldan esta parte del Cerebro de Marca."}
          </DialogDescription>
        </DialogHeader>

        {!isUnclassified && canEdit && !isManual && !editingItem && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(event) => uploadMutation.mutate(Array.from(event.target.files || []))}
            />
            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Subir archivos
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsManual(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear manualmente
            </Button>
          </div>
        )}

        {isManual ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={manualForm.name} onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Contenido base</Label><Textarea rows={10} value={manualForm.content} onChange={(event) => setManualForm((current) => ({ ...current, content: event.target.value }))} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setIsManual(false)}>Cancelar</Button><Button disabled={manageMutation.isPending || !manualForm.name.trim()} onClick={createManual}>Crear</Button></DialogFooter>
          </div>
        ) : editingItem ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Contenido base</Label><Textarea rows={10} value={editForm.content} onChange={(event) => setEditForm((current) => ({ ...current, content: event.target.value }))} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button><Button disabled={manageMutation.isPending} onClick={saveItem}>Guardar</Button></DialogFooter>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground"><FileIcon className="h-8 w-8" /><p>No hay documentos en esta tarjeta.</p></div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-medium">{item.name}</p><div className="mt-2">{getStatusBadge(item.status)}</div></div>
                  {canEdit && <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingItem(item); setEditForm({ name: item.name, content: item.content || "" }); }}><Pencil className="mr-2 h-3 w-3" />Editar</Button>
                    {item.status !== "approved" && item.status !== "processing" && <Button size="sm" onClick={() => manageMutation.mutate({ action: "approve", itemId: item.id })}><CheckCircle2 className="mr-2 h-3 w-3" />Aprobar</Button>}
                    {item.status === "approved" && <Button size="sm" variant="outline" onClick={() => manageMutation.mutate({ action: "archive", itemId: item.id })}><Archive className="mr-2 h-3 w-3" />Archivar</Button>}
                    <Button size="sm" variant="destructive" onClick={() => manageMutation.mutate({ action: "delete", itemId: item.id })}><Trash2 className="mr-2 h-3 w-3" />Eliminar</Button>
                  </div>}
                </div>
                {isUnclassified && canEdit && <div className="mt-4 flex flex-wrap gap-2"><Select onValueChange={(value) => setMoveTargets((current) => ({ ...current, [item.id]: value as BrandBrainCardKey }))}><SelectTrigger className="w-56"><SelectValue placeholder="Asignar a una tarjeta" /></SelectTrigger><SelectContent>{BRAND_BRAIN_CARDS.map((target) => <SelectItem key={target.key} value={target.key}>{target.label}</SelectItem>)}</SelectContent></Select><Button size="sm" disabled={!moveTargets[item.id] || manageMutation.isPending} onClick={() => moveItem(item)}>Mover</Button></div>}
              </div>
            ))}
          </div>
        )}

        {!isManual && !editingItem && <DialogFooter><Button variant="outline" onClick={close}>Cerrar</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
