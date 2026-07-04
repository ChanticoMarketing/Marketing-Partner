import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart4, PieChart, TrendingUp, Calendar, Filter, Download, ArrowUpRight, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from "recharts";

// Interfaces para datos de analíticas
interface AnalyticsData {
  platform: string;
  totalPosts: number;
  performance: {
    engagement: number;
    impressions: number;
    clicks: number;
  };
  contentTypeDistribution: {
    type: string;
    count: number;
  }[];
  timeDistribution: {
    day: string;
    posts: number;
  }[];
  trendsOverTime: {
    month: string;
    posts: number;
    engagement: number;
  }[];
}

// Colores para gráficos
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  twitter: "#1DA1F2", 
  linkedin: "#0A66C2",
  tiktok: "#000000",
  youtube: "#FF0000",
  pinterest: "#E60023",
  other: "#718096"
};

const CONTENT_TYPE_COLORS = [
  "#4299E1", // azul
  "#F6AD55", // naranja
  "#68D391", // verde
  "#FC8181", // rojo
  "#B794F4", // morado
  "#63B3ED", // azul claro
  "#F687B3", // rosa
  "#9AE6B4", // verde claro
  "#FBD38D", // amarillo
  "#CBD5E0"  // gris
];

// Datos simulados para cuando no hay datos reales
const generatePlaceholderData = (): AnalyticsData => {
  const contentTypes = ["photo", "carousel", "video", "text", "story"];
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
  
  return {
    platform: "Todas",
    totalPosts: 0,
    performance: {
      engagement: 0,
      impressions: 0,
      clicks: 0
    },
    contentTypeDistribution: contentTypes.map(type => ({
      type,
      count: 0
    })),
    timeDistribution: weekdays.map(day => ({
      day,
      posts: 0
    })),
    trendsOverTime: months.map(month => ({
      month,
      posts: 0,
      engagement: 0
    }))
  };
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("last30days");
  const [activeTab, setActiveTab] = useState<string>("overview");
  
  // Definir interfaz para proyectos
  interface Project {
    id: number;
    name: string;
    client: string;
  }

  // Obtener proyectos
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return fromDbArray<Project>("projects", data);
    },
    staleTime: 30000,
  });

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', selectedProject, selectedPlatform, selectedTimeRange],
    enabled: !!selectedProject,
    staleTime: 60000,
    retry: false,
    // Si la API no está implementada, esto evitará errores continuos
    queryFn: async () => {
      try {
        const response = await fetch(`/api/analytics?projectId=${selectedProject}&platform=${selectedPlatform}&timeRange=${selectedTimeRange}`);
        if (response.ok) {
          return await response.json();
        }
        return generatePlaceholderData();
      } catch (error) {
        console.error("Error fetching analytics:", error);
        return generatePlaceholderData();
      }
    }
  });

  // Datos para renderizar
  const data = analyticsData || generatePlaceholderData();

  const handleExportData = () => {
    toast({
      title: "Exportando datos",
      description: "Esta funcionalidad estará disponible próximamente",
    });
  };

  // Helper para formato de números
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8">
        {/* Encabezado de página */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 dark:text-foreground">
              <span className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-600 dark:bg-gradient-to-br dark:from-blue-500/30 dark:to-blue-600/30 dark:text-blue-400">
                <BarChart4 className="h-6 w-6" />
              </span>
              Analíticas
            </h1>
            <p className="text-muted-foreground mt-1 dark:text-slate-400">
              Visualiza el rendimiento de tus publicaciones y distribución de contenido
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 mt-4 md:mt-0">
            <Button 
              variant="outline" 
              className="gap-1.5 dark:border-[#3e4a6d] dark:bg-[#1e293b] dark:text-foreground dark:hover:bg-[#2a3349]"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="dark:border-[#2a3349] dark:bg-[#1a1d2d]">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="dark:text-slate-300">Proyecto</Label>
                <Select 
                  value={selectedProject} 
                  onValueChange={setSelectedProject}
                  disabled={projectsLoading}
                >
                  <SelectTrigger className="h-10 dark:border-[#3e4a6d] dark:bg-[#1e293b] dark:text-foreground">
                    <SelectValue placeholder="Seleccionar proyecto" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-[#3e4a6d] dark:bg-[#1e293b]">
                    {projects && projects.map((project: Project) => (
                      <SelectItem 
                        key={project.id} 
                        value={project.id.toString()}
                        className="dark:text-foreground dark:focus:bg-[#2a3349]"
                      >
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="dark:text-slate-300">Plataforma</Label>
                <Select 
                  value={selectedPlatform} 
                  onValueChange={setSelectedPlatform}
                >
                  <SelectTrigger className="h-10 dark:border-[#3e4a6d] dark:bg-[#1e293b] dark:text-foreground">
                    <SelectValue placeholder="Todas las plataformas" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-[#3e4a6d] dark:bg-[#1e293b]">
                    <SelectItem value="all" className="dark:text-foreground dark:focus:bg-[#2a3349]">Todas las plataformas</SelectItem>
                    <SelectItem value="instagram" className="dark:text-foreground dark:focus:bg-[#2a3349]">Instagram</SelectItem>
                    <SelectItem value="facebook" className="dark:text-foreground dark:focus:bg-[#2a3349]">Facebook</SelectItem>
                    <SelectItem value="twitter" className="dark:text-foreground dark:focus:bg-[#2a3349]">Twitter</SelectItem>
                    <SelectItem value="linkedin" className="dark:text-foreground dark:focus:bg-[#2a3349]">LinkedIn</SelectItem>
                    <SelectItem value="tiktok" className="dark:text-foreground dark:focus:bg-[#2a3349]">TikTok</SelectItem>
                    <SelectItem value="youtube" className="dark:text-foreground dark:focus:bg-[#2a3349]">YouTube</SelectItem>
                    <SelectItem value="pinterest" className="dark:text-foreground dark:focus:bg-[#2a3349]">Pinterest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="dark:text-slate-300">Periodo</Label>
                <Select 
                  value={selectedTimeRange} 
                  onValueChange={setSelectedTimeRange}
                >
                  <SelectTrigger className="h-10 dark:border-[#3e4a6d] dark:bg-[#1e293b] dark:text-foreground">
                    <SelectValue placeholder="Seleccionar periodo" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-[#3e4a6d] dark:bg-[#1e293b]">
                    <SelectItem value="last7days" className="dark:text-foreground dark:focus:bg-[#2a3349]">Últimos 7 días</SelectItem>
                    <SelectItem value="last30days" className="dark:text-foreground dark:focus:bg-[#2a3349]">Últimos 30 días</SelectItem>
                    <SelectItem value="last90days" className="dark:text-foreground dark:focus:bg-[#2a3349]">Últimos 90 días</SelectItem>
                    <SelectItem value="last6months" className="dark:text-foreground dark:focus:bg-[#2a3349]">Últimos 6 meses</SelectItem>
                    <SelectItem value="lastyear" className="dark:text-foreground dark:focus:bg-[#2a3349]">Último año</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenido principal - Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 dark:bg-[#1e293b] dark:border dark:border-[#3e4a6d]">
            <TabsTrigger value="overview" className="dark:data-[state=active]:bg-[#2a3349] dark:data-[state=active]:text-foreground dark:text-slate-400">
              Vista General
            </TabsTrigger>
            <TabsTrigger value="content" className="dark:data-[state=active]:bg-[#2a3349] dark:data-[state=active]:text-foreground dark:text-slate-400">
              Tipos de Contenido
            </TabsTrigger>
            <TabsTrigger value="trends" className="dark:data-[state=active]:bg-[#2a3349] dark:data-[state=active]:text-foreground dark:text-slate-400">
              Tendencias
            </TabsTrigger>
          </TabsList>

          {/* Vista General */}
          <TabsContent value="overview" className="space-y-6">
            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-md font-medium text-muted-foreground">Total Publicaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold">{formatNumber(data.totalPosts)}</div>
                    <div className="p-2 rounded-full bg-blue-100 text-blue-700">
                      <Calendar className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-md font-medium text-muted-foreground">Engagement Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold">{formatNumber(data.performance.engagement)}</div>
                    <div className="p-2 rounded-full bg-amber-100 text-amber-700">
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-md font-medium text-muted-foreground">Impresiones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold">{formatNumber(data.performance.impressions)}</div>
                    <div className="p-2 rounded-full bg-green-100 text-green-700">
                      <BarChart4 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribución de tiempo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Distribución por Día de la Semana
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  Cantidad de publicaciones por día de la semana
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[300px] w-full">
                  {analyticsLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground dark:text-slate-500" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.timeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted dark:stroke-[#2a3349]" />
                        <XAxis 
                          dataKey="day" 
                          className="text-xs fill-muted-foreground dark:fill-slate-400" 
                        />
                        <YAxis 
                          className="text-xs fill-muted-foreground dark:fill-slate-400" 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "rgba(255, 255, 255, 0.95)", 
                            border: "1px solid #E2E8F0",
                            borderRadius: "6px"
                          }} 
                        />
                        <Bar 
                          dataKey="posts" 
                          fill={PLATFORM_COLORS[selectedPlatform] || PLATFORM_COLORS.other}
                          radius={[4, 4, 0, 0]}
                          className="dark:opacity-80"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Distribución de Tipos de Contenido */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Distribución por Tipo de Contenido
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  Proporción de cada tipo de contenido publicado
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[350px] w-full">
                  {analyticsLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground dark:text-slate-500" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={data.contentTypeDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={150}
                          dataKey="count"
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {data.contentTypeDistribution.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CONTENT_TYPE_COLORS[index % CONTENT_TYPE_COLORS.length]} 
                              className="dark:opacity-80"
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "rgba(255, 255, 255, 0.95)", 
                            border: "1px solid #E2E8F0",
                            borderRadius: "6px"
                          }} 
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {data.contentTypeDistribution.map((item, index) => (
                    <div 
                      key={item.type}
                      className="flex items-center gap-2 p-2 rounded-md border dark:border-[#2a3349]"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CONTENT_TYPE_COLORS[index % CONTENT_TYPE_COLORS.length] }}
                      ></div>
                      <span className="text-sm capitalize dark:text-slate-300">{item.type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tendencias */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Tendencias a lo Largo del Tiempo
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  Evolución de publicaciones y engagement a lo largo del tiempo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[350px] w-full">
                  {analyticsLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground dark:text-slate-500" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trendsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted dark:stroke-[#2a3349]" />
                        <XAxis 
                          dataKey="month" 
                          className="text-xs fill-muted-foreground dark:fill-slate-400" 
                        />
                        <YAxis 
                          className="text-xs fill-muted-foreground dark:fill-slate-400" 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "rgba(255, 255, 255, 0.95)", 
                            border: "1px solid #E2E8F0",
                            borderRadius: "6px"
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="posts" 
                          stroke="#4C9AFF" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }} 
                          name="Publicaciones"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="engagement" 
                          stroke="#F6AD55" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }} 
                          name="Engagement"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                
                <div className="mt-6 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#4C9AFF]"></div>
                    <span className="text-sm dark:text-slate-300">Publicaciones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#F6AD55]"></div>
                    <span className="text-sm dark:text-slate-300">Engagement</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="p-6 text-center">
              <p className="text-muted-foreground text-sm dark:text-slate-400">
                Los datos mostrados son ilustrativos. La funcionalidad completa de analíticas estará disponible próximamente.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}