import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, MessageSquare, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ScheduleEntry {
  id: number;
  title: string;
  description: string;
  content: string;
  copyIn?: string;      // Texto integrado dentro del diseño
  copyOut?: string;     // Texto para la descripción del post
  designInstructions?: string; // Indicaciones para el departamento de diseño
  platform: string;
  postDate: string;
  postTime: string;
  hashtags: string;
  // Las propiedades relacionadas con imágenes ya no se utilizan
  // referenceImagePrompt?: string;
  // referenceImageUrl?: string;
}

interface Schedule {
  id: number;
  name: string;
  startDate: string;
  endDate?: string;
  specifications?: string;
  createdAt: string;
  entries: ScheduleEntry[];
}

interface ProjectWorkflowsProps {
  projectId: number;
}

export default function ProjectWorkflows({ projectId }: ProjectWorkflowsProps) {
  const { toast } = useToast();
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  // Estado para las acciones en la interfaz

  // Fetch schedules for the project
  const { data: schedules, isLoading, error } = useQuery<Schedule[]>({
    queryKey: [`/api/projects/${projectId}/schedules`],
    staleTime: 60000,
  });

  // Ya no hay funcionalidad de generación de imágenes

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-md bg-red-50 text-red-700">
        <p>Error loading schedules: {(error as Error).message}</p>
      </div>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center p-8 border rounded-md">
        <h3 className="text-lg font-medium mb-2">No Schedules Available</h3>
        <p className="text-muted-foreground mb-6">
          There are no content schedules for this project yet.
        </p>
        <p className="text-sm text-muted-foreground">
          You can create a new schedule from the Dashboard's "Create Quick Schedule" section.
        </p>
      </div>
    );
  }

  const handleViewSchedule = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
  };

  // Ya no hay funcionalidad para generar o ver imágenes

  // Platform badges
  const getPlatformBadge = (platform: string) => {
    const platformColors: Record<string, string> = {
      Instagram: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      Facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      Twitter: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
      LinkedIn: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      TikTok: "bg-black text-foreground dark:bg-gray-700 dark:text-muted-foreground",
      default: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300"
    };

    return (
      <Badge 
        variant="outline" 
        className={platformColors[platform] || platformColors.default}
      >
        {platform}
      </Badge>
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Content Schedules</h2>
      </div>

      {selectedSchedule ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{selectedSchedule.name}</h3>
              <p className="text-sm text-muted-foreground">
                Created on {format(parseISO(selectedSchedule.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                onClick={() => window.open(`/api/schedules/${selectedSchedule.id}/download?format=excel`, '_blank')}
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                onClick={() => window.open(`/api/schedules/${selectedSchedule.id}/download?format=pdf`, '_blank')}
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" onClick={() => setSelectedSchedule(null)}>
                Back to All Schedules
              </Button>
            </div>
          </div>

          {selectedSchedule.specifications && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-medium mb-2">Schedule Specifications</h4>
                <p className="text-sm text-muted-foreground">{selectedSchedule.specifications}</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {selectedSchedule.entries && selectedSchedule.entries.length > 0 ? (
              selectedSchedule.entries.map((entry) => (
                <Card key={entry.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{entry.title}</CardTitle>
                      {getPlatformBadge(entry.platform)}
                    </div>
                    <CardDescription>
                      {format(parseISO(entry.postDate), "EEEE, MMMM d, yyyy")} at {entry.postTime}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 pb-2">
                    {entry.description && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium mb-1">Description</h4>
                        <p className="text-sm text-muted-foreground">{entry.description}</p>
                      </div>
                    )}
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-1">Content</h4>
                      <div className="p-3 bg-muted/30 rounded-md text-sm">
                        {entry.content}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      {entry.copyIn && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Copy In (Texto en Diseño)</h4>
                          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-md text-sm border border-purple-200 dark:border-purple-800">
                            {entry.copyIn}
                          </div>
                        </div>
                      )}
                      
                      {entry.copyOut && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Copy Out (Descripción)</h4>
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm border border-blue-200 dark:border-blue-800">
                            {entry.copyOut}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {entry.designInstructions && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium mb-1">Instrucciones de Diseño</h4>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm border border-amber-200 dark:border-amber-800">
                          {entry.designInstructions}
                        </div>
                      </div>
                    )}
                    
                    {entry.hashtags && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium mb-1">Hashtags</h4>
                        <div className="flex flex-wrap gap-1">
                          {entry.hashtags.split(/[\s,]+/).filter(Boolean).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  {/* Ya no hay botón para generar imágenes - Funcionalidad eliminada */}
                </Card>
              ))
            ) : (
              <div className="text-center p-8 border rounded-md">
                <h3 className="text-lg font-medium mb-2">No Entries Available</h3>
                <p className="text-muted-foreground mb-2">
                  This schedule doesn't have any entries yet.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{schedule.name}</CardTitle>
                <CardDescription>
                  Created {format(parseISO(schedule.createdAt), "MMMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <div className="text-sm text-muted-foreground mb-4">
                  {schedule.entries && Array.isArray(schedule.entries) ? 
                    `${schedule.entries.length} content items` : 
                    "No content items yet"}
                </div>
                <div className="space-y-3">
                  {schedule.entries && Array.isArray(schedule.entries) && schedule.entries.length > 0 ? (
                    <>
                      {schedule.entries.slice(0, 2).map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 rounded-md border p-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{entry.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {format(parseISO(entry.postDate), "MMM d, yyyy")} • {entry.platform}
                            </div>
                          </div>
                        </div>
                      ))}
                      {schedule.entries.length > 2 && (
                        <div className="text-center py-2 text-sm text-muted-foreground">
                          +{schedule.entries.length - 2} more items
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>No entries available</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between p-3 border-t mt-4">
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1"
                    onClick={() => window.open(`/api/schedules/${schedule.id}/download?format=excel`, '_blank')}
                  >
                    <Download className="h-3 w-3" />
                    Excel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1"
                    onClick={() => window.open(`/api/schedules/${schedule.id}/download?format=pdf`, '_blank')}
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleViewSchedule(schedule)}>
                  Ver Detalles
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Ya no hay diálogo de imágenes de referencia - Funcionalidad eliminada */}
    </div>
  );
}
