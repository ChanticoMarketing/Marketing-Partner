import { useState, useRef } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload, Camera, PenTool, Users } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type AnalysisType = 'brand' | 'content' | 'audience';

interface ImageAnalysisResult {
  success: boolean;
  analysisType: AnalysisType;
  result: {
    analysisType: AnalysisType;
    rawAnalysis: string;
    structuredData?: Record<string, string>;
  };
  imageInfo: {
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
  };
}

export default function ImageAnalysisPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('content');
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutation para subir y analizar la imagen
  const analyzeImageMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data, error } = await supabase.functions.invoke('analyze-image', { body: formData });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setAnalysisResult(data as ImageAnalysisResult);
      toast({
        title: 'Análisis completado',
        description: 'La imagen ha sido analizada con éxito',
      });
      // Cerrar el diálogo de carga
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error analizando imagen:', error);
      toast({
        title: 'Error al analizar la imagen',
        description: 'No se pudo completar el análisis. Por favor intenta nuevamente.',
        variant: 'destructive',
      });
      // Cerrar el diálogo de carga
      setIsDialogOpen(false);
    },
  });

  // Manejar la selección de archivo
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Archivo no válido',
          description: 'Por favor selecciona una imagen (JPG, PNG o WEBP)',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFile(file);
      
      // Crear URL de vista previa
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Limpiar cualquier resultado previo
      setAnalysisResult(null);
    }
  };

  // Manejar análisis de imagen
  const handleAnalyzeImage = () => {
    if (!selectedFile) {
      toast({
        title: 'No hay imagen seleccionada',
        description: 'Por favor selecciona una imagen para analizar',
        variant: 'destructive',
      });
      return;
    }
    
    // Abrir diálogo de carga
    setIsDialogOpen(true);
    
    // Preparar FormData con la imagen y el tipo de análisis
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('analysisType', analysisType);
    formData.append('projectId', projectId);
    
    // Ejecutar la mutación
    analyzeImageMutation.mutate(formData);
  };

  // Abrir selector de archivos
  const handleOpenFileSelector = () => {
    fileInputRef.current?.click();
  };

  // Renderizar resultados según el tipo de análisis
  const renderAnalysisResults = () => {
    if (!analysisResult) return null;
    
    const { result } = analysisResult;
    
    // Formato para los datos estructurados
    const formatStructuredData = () => {
      if (!result.structuredData) {
        return (
          <div className="whitespace-pre-wrap text-sm mt-4 p-4 bg-secondary/20 rounded-md">
            {result.rawAnalysis}
          </div>
        );
      }
      
      return (
        <div className="mt-4">
          {Object.entries(result.structuredData).map(([key, value], index) => (
            <div key={index} className="mb-4">
              <h4 className="font-semibold text-primary">{key}</h4>
              <p className="text-sm">{value}</p>
            </div>
          ))}
        </div>
      );
    };
    
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.analysisType === 'brand' && <PenTool className="h-5 w-5" />}
            {result.analysisType === 'content' && <Camera className="h-5 w-5" />}
            {result.analysisType === 'audience' && <Users className="h-5 w-5" />}
            Análisis de {result.analysisType === 'brand' ? 'Marca' : result.analysisType === 'content' ? 'Contenido' : 'Audiencia'}
          </CardTitle>
          <CardDescription>
            Análisis realizado con Groq
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formatStructuredData()}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-xs text-muted-foreground">
            Imagen analizada: {analysisResult.imageInfo.originalName}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAnalysisResult(null)}>
            Nuevo análisis
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Imágenes de Marketing</CardTitle>
          <CardDescription>
            Analiza tus materiales visuales desde diferentes perspectivas usando Groq.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!analysisResult ? (
            <>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-secondary/50 transition-colors ${
                      previewUrl ? 'border-primary' : 'border-muted-foreground/25'
                    }`}
                    onClick={handleOpenFileSelector}
                  >
                    {previewUrl ? (
                      <div className="flex flex-col items-center">
                        <img 
                          src={previewUrl} 
                          alt="Vista previa" 
                          className="max-h-[300px] max-w-full object-contain mb-4"
                        />
                        <p className="text-sm text-muted-foreground">
                          Haz clic para cambiar la imagen
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="font-medium text-muted-foreground">
                          Haz clic para subir una imagen
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          JPG, PNG o WEBP (máx. 8MB)
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="analysis-type">Tipo de análisis</Label>
                  <RadioGroup
                    value={analysisType}
                    onValueChange={(value) => setAnalysisType(value as AnalysisType)}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div>
                      <RadioGroupItem 
                        value="brand" 
                        id="brand" 
                        className="peer sr-only" 
                      />
                      <Label
                        htmlFor="brand"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-secondary/50 hover:text-secondary-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <PenTool className="mb-3 h-6 w-6" />
                        <span className="font-medium">Marca</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          Análisis de elementos de marca y diseño
                        </span>
                      </Label>
                    </div>
                    
                    <div>
                      <RadioGroupItem 
                        value="content" 
                        id="content" 
                        className="peer sr-only" 
                        defaultChecked 
                      />
                      <Label
                        htmlFor="content"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-secondary/50 hover:text-secondary-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Camera className="mb-3 h-6 w-6" />
                        <span className="font-medium">Contenido</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          Análisis de efectividad como contenido
                        </span>
                      </Label>
                    </div>
                    
                    <div>
                      <RadioGroupItem 
                        value="audience" 
                        id="audience" 
                        className="peer sr-only" 
                      />
                      <Label
                        htmlFor="audience"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-secondary/50 hover:text-secondary-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Users className="mb-3 h-6 w-6" />
                        <span className="font-medium">Audiencia</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          Análisis de impacto en la audiencia
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              
              <Button 
                className="w-full mt-6" 
                disabled={!selectedFile || analyzeImageMutation.isPending}
                onClick={handleAnalyzeImage}
              >
                {analyzeImageMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Analizar Imagen
              </Button>
            </>
          ) : (
            renderAnalysisResults()
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        // Solo permitir cerrar el diálogo si no hay una operación en curso
        if (!analyzeImageMutation.isPending) {
          setIsDialogOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Analizando imagen</DialogTitle>
            <DialogDescription>
              Groq está analizando tu imagen. Este proceso puede tardar unos segundos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
