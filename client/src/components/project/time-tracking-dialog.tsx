import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, PauseCircle, Clock, Save, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format, formatDistance, formatDuration, intervalToDuration } from "date-fns";
import { es } from "date-fns/locale";

interface TimeTrackingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number;
  projectId: number;
}

export default function TimeTrackingDialog({ isOpen, onClose, taskId, projectId }: TimeTrackingDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // en segundos
  const [description, setDescription] = useState("");
  const [timeEntryId, setTimeEntryId] = useState<number | null>(null);
  const [manualTime, setManualTime] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Obtener entradas de tiempo existentes
  const { data: timeEntries = [], isLoading, refetch } = useQuery({
    queryKey: ["tasks", taskId, "time-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray("time_entries", data);
    },
  });

  // Crear nueva entrada de tiempo
  const createTimeEntryMutation = useMutation({
    mutationFn: async (data: {
      taskId: number;
      startTime: Date;
      endTime?: Date;
      duration?: number;
      description: string;
    }) => {
      return dbQuery("time_entries").insertSingle({
        taskId: data.taskId,
        userId: user?.id,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        description: data.description,
        isRunning: false,
      });
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Registro guardado",
        description: "El tiempo ha sido registrado correctamente.",
      });
      setDescription("");
      setElapsedTime(0);
      setStartTime(null);
      setTimeEntryId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar tiempo",
        description: error.message || "Ha ocurrido un error. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Eliminar entrada de tiempo
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await dbQuery("time_entries").delete({ id });
      return id;
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Registro eliminado",
        description: "El registro de tiempo ha sido eliminado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "Ha ocurrido un error. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Formatear duración en formato hh:mm:ss
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Formatear tiempo para mostrar en la lista
  const formatTimeEntry = (entry: any): string => {
    if (entry.duration) {
      const hours = Math.floor(entry.duration / 3600);
      const minutes = Math.floor((entry.duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
    
    if (entry.startTime && entry.endTime) {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      const durationInSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
      const hours = Math.floor(durationInSeconds / 3600);
      const minutes = Math.floor((durationInSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
    
    return "Duración desconocida";
  };

  // Funciones de control del tiempo
  const startTracking = () => {
    const now = new Date();
    setStartTime(now);
    setIsTracking(true);
    setElapsedTime(0);
    toast({
      title: "Tiempo iniciado",
      description: "El cronómetro ha comenzado.",
    });
  };

  const stopTracking = () => {
    if (!startTime) return;
    
    setIsTracking(false);
    const endTime = new Date();
    const durationInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // Guardar automáticamente el tiempo
    createTimeEntryMutation.mutate({
      taskId,
      startTime,
      endTime,
      duration: durationInSeconds,
      description,
    });
  };

  const handleManualEntry = () => {
    // Validar que el formato sea hh:mm
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    if (!timeRegex.test(manualTime)) {
      toast({
        title: "Formato incorrecto",
        description: "Por favor, introduce un tiempo válido en formato hh:mm",
        variant: "destructive",
      });
      return;
    }

    const [hours, minutes] = manualTime.split(":").map(Number);
    const durationInSeconds = (hours * 3600) + (minutes * 60);
    
    if (durationInSeconds <= 0) {
      toast({
        title: "Tiempo inválido",
        description: "Por favor, introduce un tiempo mayor a cero",
        variant: "destructive",
      });
      return;
    }

    // Crear entrada de tiempo manual
    createTimeEntryMutation.mutate({
      taskId,
      startTime: new Date(), // Se usará como referencia
      duration: durationInSeconds,
      description,
    });
    
    setManualTime("");
    setShowManualEntry(false);
  };

  // Actualizar el tiempo transcurrido cada segundo
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const durationInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(durationInSeconds);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, startTime]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Seguimiento de Tiempo</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Cronómetro activo */}
          <div className="bg-muted/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-sm">Registrar tiempo</h3>
              
              <div>
                {!isTracking ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={startTracking}
                    disabled={isTracking}
                  >
                    <PlayCircle className="h-4 w-4" />
                    Iniciar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={stopTracking}
                  >
                    <PauseCircle className="h-4 w-4" />
                    Detener
                  </Button>
                )}
              </div>
            </div>
            
            {isTracking && (
              <div className="mb-4 text-center">
                <div className="text-3xl font-mono font-semibold text-primary">{formatTime(elapsedTime)}</div>
                <div className="text-xs text-muted-foreground">
                  Cronómetro activo
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Textarea
                placeholder="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none h-20"
              />
              
              <div className="flex justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="gap-1 text-xs"
                >
                  <Clock className="h-3 w-3" />
                  {showManualEntry ? "Cancelar entrada manual" : "Entrada manual"}
                </Button>
              </div>
              
              {showManualEntry && (
                <div className="flex gap-2 items-center mt-2">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="manual-time" className="text-xs">Tiempo (hh:mm)</Label>
                    <Input
                      id="manual-time"
                      type="text"
                      placeholder="01:30"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <Button 
                    size="sm" 
                    className="mt-5" 
                    onClick={handleManualEntry}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Historial de tiempos */}
          <div>
            <h3 className="font-medium text-sm mb-2">Historial de tiempos</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : timeEntries.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No hay registros de tiempo para esta tarea
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                {timeEntries.map((entry: any) => (
                  <Card key={entry.id} className="p-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" />
                        <span className="font-medium text-sm">
                          {formatTimeEntry(entry)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.startTime && format(new Date(entry.startTime), "dd MMM yyyy", { locale: es })}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteTimeEntryMutation.mutate(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}