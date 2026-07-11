import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  clearClientLogs,
  CLIENT_LOG_UPDATED_EVENT,
  readClientLogs,
  type ClientLogEntry,
} from "@/lib/client-logs";

interface ProjectLogsProps {
  projectId: number;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export default function ProjectLogs({ projectId }: ProjectLogsProps) {
  const [logs, setLogs] = useState<ClientLogEntry[]>([]);

  useEffect(() => {
    const syncLogs = () => setLogs(readClientLogs());

    syncLogs();
    window.addEventListener(CLIENT_LOG_UPDATED_EVENT, syncLogs);
    window.addEventListener("storage", syncLogs);

    return () => {
      window.removeEventListener(CLIENT_LOG_UPDATED_EVENT, syncLogs);
      window.removeEventListener("storage", syncLogs);
    };
  }, []);

  const projectLogs = useMemo(() => {
    const projectPath = `/projects/${projectId}`;
    return logs.filter((log) => log.path.startsWith(projectPath));
  }, [logs, projectId]);

  const visibleLogs = projectLogs.length > 0 ? projectLogs : logs;
  const showingProjectLogs = projectLogs.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">Logs de errores</CardTitle>
          <CardDescription>
            Se guardan en este navegador para revisar fallos mientras seguimos desarrollando.
            {showingProjectLogs
              ? " Mostrando errores capturados dentro de este proyecto."
              : " Si todavia no hay errores de este proyecto, veras la bitacora general."}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearClientLogs}
          disabled={logs.length === 0}
        >
          <Trash2 className="h-4 w-4" />
          Limpiar logs
        </Button>
      </CardHeader>

      <CardContent>
        {visibleLogs.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Todavia no hay errores capturados.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando aparezca uno, quedara listado aqui con su ruta y hora.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[440px] pr-4">
            <div className="space-y-3">
              {visibleLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border bg-background/70 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                          {log.level}
                        </span>
                        <span>{log.source}</span>
                        <span>{log.path}</span>
                      </div>
                      <p className="text-sm font-medium">{log.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>

                  {log.details && (
                    <p className="mt-3 text-xs text-muted-foreground">{log.details}</p>
                  )}

                  {log.stack && (
                    <pre className="mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                      {log.stack}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
