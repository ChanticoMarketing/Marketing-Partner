import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  ChevronDown, 
  Clock, 
  Cog, 
  Edit, 
  Loader2, 
  MoreHorizontal,
  Plus, 
  Sparkles, 
  Trash2, 
  Zap 
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

interface AutomationRulesPanelProps {
  projectId: number;
}

// Tipos para las reglas de automatización
interface AutomationRule {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  trigger: 'status_change' | 'due_date_approaching' | 'task_assigned' | 'comment_added' | 'subtask_completed' | 'attachment_added';
  triggerConfig: Record<string, any>;
  action: 'change_status' | 'assign_task' | 'send_notification' | 'create_subtask' | 'update_priority' | 'move_to_group';
  actionConfig: Record<string, any>;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// Tipo para la configuración del disparador
type TriggerConfig = {
  fromStatus?: string;
  toStatus?: string;
  daysRemaining?: number;
  assignedTo?: number | 'any';
};

// Tipo para la configuración de la acción
type ActionConfig = {
  newStatus?: string;
  assignTo?: number;
  newPriority?: string;
  message?: string;
};

export default function AutomationRulesPanel({ projectId }: AutomationRulesPanelProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRule, setCurrentRule] = useState<AutomationRule | null>(null);
  const [newRuleData, setNewRuleData] = useState({
    name: "",
    description: "",
    trigger: "status_change" as 'status_change' | 'due_date_approaching' | 'task_assigned' | 'comment_added' | 'subtask_completed' | 'attachment_added',
    triggerConfig: {} as TriggerConfig,
    action: "change_status" as 'change_status' | 'assign_task' | 'send_notification' | 'create_subtask' | 'update_priority' | 'move_to_group',
    actionConfig: {} as ActionConfig,
    isActive: true
  });

  // Obtener las reglas de automatización
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["projects", projectId, "automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray("automation_rules", data);
    },
  });

  // Obtener tareas y usuarios para las configuraciones
  const { data: tasks = [] } = useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true });
      if (error) throw error;
      return fromDbArray("tasks", data);
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, username, profile_image, role")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return fromDbArray("users", data);
    },
  });

  // Crear regla de automatización
  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      return dbQuery("automation_rules").insertSingle({ ...ruleData, projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "automation-rules"] });
      toast({
        title: "Regla creada",
        description: "La regla de automatización ha sido creada exitosamente.",
      });
      setIsCreating(false);
      setNewRuleData({
        name: "",
        description: "",
        trigger: "status_change",
        triggerConfig: {},
        action: "change_status",
        actionConfig: {},
        isActive: true
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear regla",
        description: error.message || "Ocurrió un error al crear la regla",
        variant: "destructive",
      });
    },
  });

  // Editar regla de automatización
  const updateRuleMutation = useMutation({
    mutationFn: async (data: { id: number; ruleData: any }) => {
      return dbQuery("automation_rules").updateSingle(data.ruleData, { id: data.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "automation-rules"] });
      toast({
        title: "Regla actualizada",
        description: "La regla de automatización ha sido actualizada exitosamente.",
      });
      setIsEditing(false);
      setCurrentRule(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar regla",
        description: error.message || "Ocurrió un error al actualizar la regla",
        variant: "destructive",
      });
    },
  });

  // Eliminar regla de automatización
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await dbQuery("automation_rules").delete({ id });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "automation-rules"] });
      toast({
        title: "Regla eliminada",
        description: "La regla de automatización ha sido eliminada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar regla",
        description: error.message || "Ocurrió un error al eliminar la regla",
        variant: "destructive",
      });
    },
  });

  // Togglear estado de regla (activa/inactiva)
  const toggleRuleStateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return dbQuery("automation_rules").updateSingle({ isActive }, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "automation-rules"] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la regla ha sido actualizado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar estado",
        description: error.message || "Ocurrió un error al actualizar el estado de la regla",
        variant: "destructive",
      });
    },
  });

  // Manejar cambios en el formulario de nueva regla
  const handleNewRuleChange = (field: string, value: any) => {
    setNewRuleData((prev) => ({ ...prev, [field]: value }));
    
    // Resetear las configuraciones específicas si se cambia el disparador o la acción
    if (field === "trigger") {
      setNewRuleData((prev) => ({ ...prev, triggerConfig: {} }));
    } else if (field === "action") {
      setNewRuleData((prev) => ({ ...prev, actionConfig: {} }));
    }
  };

  // Manejar cambios en configuraciones de disparador y acción
  const handleTriggerConfigChange = (key: string, value: any) => {
    setNewRuleData((prev) => ({
      ...prev,
      triggerConfig: { ...prev.triggerConfig, [key]: value }
    }));
  };

  const handleActionConfigChange = (key: string, value: any) => {
    setNewRuleData((prev) => ({
      ...prev,
      actionConfig: { ...prev.actionConfig, [key]: value }
    }));
  };

  // Obtener nombre legible del disparador
  const getTriggerName = (trigger: string) => {
    const triggerNames: Record<string, string> = {
      status_change: "Cambio de estado",
      due_date_approaching: "Fecha límite cercana",
      task_assigned: "Tarea asignada",
      comment_added: "Comentario añadido",
      subtask_completed: "Subtarea completada",
      attachment_added: "Archivo adjunto añadido"
    };
    return triggerNames[trigger] || trigger;
  };

  // Obtener nombre legible de la acción
  const getActionName = (action: string) => {
    const actionNames: Record<string, string> = {
      change_status: "Cambiar estado",
      assign_task: "Asignar tarea",
      send_notification: "Enviar notificación",
      create_subtask: "Crear subtarea",
      update_priority: "Actualizar prioridad",
      move_to_group: "Mover a grupo"
    };
    return actionNames[action] || action;
  };

  // Renderizar formulario del disparador según el tipo
  const renderTriggerConfig = () => {
    const triggerType = newRuleData.trigger;
    
    if (triggerType === "status_change") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fromStatus" className="text-right">
              De estado
            </Label>
            <Select
              value={newRuleData.triggerConfig.fromStatus || ""}
              onValueChange={(value) => handleTriggerConfigChange("fromStatus", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En progreso</SelectItem>
                <SelectItem value="review">En revisión</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="blocked">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="toStatus" className="text-right">
              A estado
            </Label>
            <Select
              value={newRuleData.triggerConfig.toStatus || ""}
              onValueChange={(value) => handleTriggerConfigChange("toStatus", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En progreso</SelectItem>
                <SelectItem value="review">En revisión</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="blocked">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }
    
    if (triggerType === "due_date_approaching") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="daysRemaining" className="text-right">
              Días restantes
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="daysRemaining"
                type="number"
                min="1"
                value={newRuleData.triggerConfig.daysRemaining?.toString() || ""}
                onChange={(e) => handleTriggerConfigChange("daysRemaining", parseInt(e.target.value))}
                className="w-24"
              />
              <span>días antes de la fecha límite</span>
            </div>
          </div>
        </div>
      );
    }
    
    if (triggerType === "task_assigned") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="assignedTo" className="text-right">
              Asignado a
            </Label>
            <Select
              value={(newRuleData.triggerConfig.assignedTo?.toString() || "")}
              onValueChange={(value) => handleTriggerConfigChange("assignedTo", value === "any" ? "any" : parseInt(value))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquier usuario</SelectItem>
                {users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.fullName || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    return (
      <div className="py-2 text-sm text-muted-foreground">
        No se requiere configuración adicional para este disparador.
      </div>
    );
  };

  // Renderizar formulario de la acción según el tipo
  const renderActionConfig = () => {
    const actionType = newRuleData.action;
    
    if (actionType === "change_status") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newStatus" className="text-right">
              Nuevo estado
            </Label>
            <Select
              value={newRuleData.actionConfig.newStatus || ""}
              onValueChange={(value) => handleActionConfigChange("newStatus", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En progreso</SelectItem>
                <SelectItem value="review">En revisión</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="blocked">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (actionType === "assign_task") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="assignTo" className="text-right">
              Asignar a
            </Label>
            <Select
              value={(newRuleData.actionConfig.assignTo?.toString() || "")}
              onValueChange={(value) => handleActionConfigChange("assignTo", parseInt(value))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.fullName || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (actionType === "update_priority") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newPriority" className="text-right">
              Nueva prioridad
            </Label>
            <Select
              value={newRuleData.actionConfig.newPriority || ""}
              onValueChange={(value) => handleActionConfigChange("newPriority", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona una prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (actionType === "send_notification") {
      return (
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="message" className="text-right">
              Mensaje
            </Label>
            <Input
              id="message"
              value={newRuleData.actionConfig.message || ""}
              onChange={(e) => handleActionConfigChange("message", e.target.value)}
              className="col-span-3"
              placeholder="Ej: La tarea necesita atención"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="py-2 text-sm text-muted-foreground">
        No se requiere configuración adicional para esta acción.
      </div>
    );
  };

  const getCardClassName = (isActive: boolean) => {
    return `shadow-sm hover:shadow transition-shadow ${
      isActive 
        ? "border-primary/10 bg-primary/5 dark:border-primary/20 dark:bg-primary/10" 
        : "opacity-60"
    }`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reglas de Automatización</h2>
          <p className="text-muted-foreground">
            Automatiza tareas repetitivas y workflows para tu equipo
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-1">
              <Zap className="h-4 w-4" />
              Nueva Regla
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear nueva regla de automatización</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="name"
                  value={newRuleData.name}
                  onChange={(e) => handleNewRuleChange("name", e.target.value)}
                  className="col-span-3"
                  placeholder="Ej: Asignar tareas bloqueadas"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Descripción
                </Label>
                <Input
                  id="description"
                  value={newRuleData.description}
                  onChange={(e) => handleNewRuleChange("description", e.target.value)}
                  className="col-span-3"
                  placeholder="Ej: Cuando una tarea se bloquea, asignarla al supervisor"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">
                  Activa
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Switch
                    id="isActive"
                    checked={newRuleData.isActive}
                    onCheckedChange={(checked) => handleNewRuleChange("isActive", checked)}
                  />
                  <Label htmlFor="isActive" className="text-sm text-muted-foreground">
                    {newRuleData.isActive ? "Regla activada" : "Regla desactivada"}
                  </Label>
                </div>
              </div>

              <div className="border-t pt-4">
                <Accordion type="single" collapsible defaultValue="trigger" className="w-full">
                  <AccordionItem value="trigger">
                    <AccordionTrigger className="text-base font-medium">
                      Cuando esto ocurre (Disparador)
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="trigger" className="text-right">
                            Disparador
                          </Label>
                          <Select
                            value={newRuleData.trigger}
                            onValueChange={(value) => handleNewRuleChange("trigger", value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Selecciona un disparador" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="status_change">Cambio de estado</SelectItem>
                              <SelectItem value="due_date_approaching">Fecha límite cercana</SelectItem>
                              <SelectItem value="task_assigned">Tarea asignada</SelectItem>
                              <SelectItem value="comment_added">Comentario añadido</SelectItem>
                              <SelectItem value="subtask_completed">Subtarea completada</SelectItem>
                              <SelectItem value="attachment_added">Archivo adjunto añadido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {renderTriggerConfig()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="action">
                    <AccordionTrigger className="text-base font-medium">
                      Hacer esto (Acción)
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="action" className="text-right">
                            Acción
                          </Label>
                          <Select
                            value={newRuleData.action}
                            onValueChange={(value) => handleNewRuleChange("action", value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Selecciona una acción" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="change_status">Cambiar estado</SelectItem>
                              <SelectItem value="assign_task">Asignar tarea</SelectItem>
                              <SelectItem value="send_notification">Enviar notificación</SelectItem>
                              <SelectItem value="create_subtask">Crear subtarea</SelectItem>
                              <SelectItem value="update_priority">Actualizar prioridad</SelectItem>
                              <SelectItem value="move_to_group">Mover a grupo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {renderActionConfig()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => createRuleMutation.mutate({
                  projectId,
                  name: newRuleData.name,
                  description: newRuleData.description || null,
                  trigger: newRuleData.trigger,
                  triggerConfig: newRuleData.triggerConfig,
                  action: newRuleData.action,
                  actionConfig: newRuleData.actionConfig,
                  isActive: newRuleData.isActive
                })}
                disabled={
                  !newRuleData.name || 
                  (newRuleData.trigger === "status_change" && (!newRuleData.triggerConfig.fromStatus || !newRuleData.triggerConfig.toStatus)) ||
                  (newRuleData.trigger === "due_date_approaching" && !newRuleData.triggerConfig.daysRemaining) ||
                  (newRuleData.action === "change_status" && !newRuleData.actionConfig.newStatus) ||
                  (newRuleData.action === "assign_task" && !newRuleData.actionConfig.assignTo) ||
                  (newRuleData.action === "update_priority" && !newRuleData.actionConfig.newPriority) ||
                  (newRuleData.action === "send_notification" && !newRuleData.actionConfig.message)
                }
              >
                Crear Regla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No hay reglas de automatización</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Las reglas de automatización te permiten ahorrar tiempo automatizando tareas repetitivas.
          </p>
          <Button
            className="mt-4 gap-1"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
            Crear primera regla
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((rule: AutomationRule) => (
            <Card key={rule.id} className={getCardClassName(rule.isActive)}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className={`h-4 w-4 ${rule.isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-base">{rule.name}</span>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => toggleRuleStateMutation.mutate({ 
                          id: rule.id, 
                          isActive: !rule.isActive 
                        })}
                      >
                        <Cog className="h-4 w-4 mr-2" />
                        {rule.isActive ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setCurrentRule(rule);
                          setIsEditing(true);
                          setNewRuleData({
                            name: rule.name,
                            description: rule.description || "",
                            trigger: rule.trigger,
                            triggerConfig: rule.triggerConfig || {},
                            action: rule.action,
                            actionConfig: rule.actionConfig || {},
                            isActive: rule.isActive
                          });
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {rule.description && (
                  <CardDescription className="mt-1">{rule.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-2 py-0">
                      Cuando
                    </Badge>
                    <span>{getTriggerName(rule.trigger)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-2 py-0">
                      Hacer
                    </Badge>
                    <span>{getActionName(rule.action)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-3 pb-2 flex justify-between items-center">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    {new Date(rule.updatedAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <Badge 
                  variant={rule.isActive ? "default" : "outline"} 
                  className="text-xs"
                >
                  {rule.isActive ? "Activa" : "Desactivada"}
                </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo para editar regla */}
      {currentRule && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Editar regla de automatización</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="edit-name"
                  value={newRuleData.name}
                  onChange={(e) => handleNewRuleChange("name", e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Descripción
                </Label>
                <Input
                  id="edit-description"
                  value={newRuleData.description}
                  onChange={(e) => handleNewRuleChange("description", e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-isActive" className="text-right">
                  Activa
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Switch
                    id="edit-isActive"
                    checked={newRuleData.isActive}
                    onCheckedChange={(checked) => handleNewRuleChange("isActive", checked)}
                  />
                  <Label htmlFor="edit-isActive" className="text-sm text-muted-foreground">
                    {newRuleData.isActive ? "Regla activada" : "Regla desactivada"}
                  </Label>
                </div>
              </div>

              <div className="border-t pt-4">
                <Accordion type="single" collapsible defaultValue="trigger" className="w-full">
                  <AccordionItem value="trigger">
                    <AccordionTrigger className="text-base font-medium">
                      Cuando esto ocurre (Disparador)
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-trigger" className="text-right">
                            Disparador
                          </Label>
                          <Select
                            value={newRuleData.trigger}
                            onValueChange={(value) => handleNewRuleChange("trigger", value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Selecciona un disparador" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="status_change">Cambio de estado</SelectItem>
                              <SelectItem value="due_date_approaching">Fecha límite cercana</SelectItem>
                              <SelectItem value="task_assigned">Tarea asignada</SelectItem>
                              <SelectItem value="comment_added">Comentario añadido</SelectItem>
                              <SelectItem value="subtask_completed">Subtarea completada</SelectItem>
                              <SelectItem value="attachment_added">Archivo adjunto añadido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {renderTriggerConfig()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="action">
                    <AccordionTrigger className="text-base font-medium">
                      Hacer esto (Acción)
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="edit-action" className="text-right">
                            Acción
                          </Label>
                          <Select
                            value={newRuleData.action}
                            onValueChange={(value) => handleNewRuleChange("action", value)}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Selecciona una acción" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="change_status">Cambiar estado</SelectItem>
                              <SelectItem value="assign_task">Asignar tarea</SelectItem>
                              <SelectItem value="send_notification">Enviar notificación</SelectItem>
                              <SelectItem value="create_subtask">Crear subtarea</SelectItem>
                              <SelectItem value="update_priority">Actualizar prioridad</SelectItem>
                              <SelectItem value="move_to_group">Mover a grupo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {renderActionConfig()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => updateRuleMutation.mutate({
                  id: currentRule.id,
                  ruleData: {
                    name: newRuleData.name,
                    description: newRuleData.description || null,
                    trigger: newRuleData.trigger,
                    triggerConfig: newRuleData.triggerConfig,
                    action: newRuleData.action,
                    actionConfig: newRuleData.actionConfig,
                    isActive: newRuleData.isActive
                  }
                })}
              >
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}