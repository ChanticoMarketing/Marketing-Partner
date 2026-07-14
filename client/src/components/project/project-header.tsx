import { useParams, Link, useLocation } from 'wouter';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  ListTodo, 
  MessageSquare, 
  Clock, 
  Image, 
  BarChart4, 
  Settings, 
  Package,
  Layout
} from 'lucide-react';
import ProjectIdentityAvatar from "@/components/projects/project-identity-avatar";

type ProjectHeaderProps = {
  project: any;
  activeTab?: string;
};

export default function ProjectHeader({ project, activeTab = "overview" }: ProjectHeaderProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [_, navigate] = useLocation();
  
  const handleTabChange = (value: string) => {
    switch (value) {
      case 'overview':
        navigate(`/projects/${projectId}`);
        break;
      case 'tasks':
        navigate(`/projects/${projectId}/tasks`);
        break;
      case 'calendar':
        navigate(`/projects/${projectId}/calendar`);
        break;
      case 'chat':
        navigate(`/projects/${projectId}/chat`);
        break;
      case 'schedules':
        navigate(`/projects/${projectId}/schedules`);
        break;
      case 'time':
        navigate(`/projects/${projectId}/time`);
        break;
      case 'products':
        navigate(`/projects/${projectId}/products`);
        break;
      case 'views':
        navigate(`/projects/${projectId}/views`);
        break;
      case 'imageAnalysis':
        navigate(`/projects/${projectId}/image-analysis`);
        break;
      case 'settings':
        navigate(`/projects/${projectId}/settings`);
        break;
      default:
        navigate(`/projects/${projectId}`);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ProjectIdentityAvatar
            name={project.name}
            color={project.color}
            imageUrl={project.imageUrl}
            size="md"
          />
          <h1 className="text-3xl font-bold">{project.name}</h1>
        </div>
      </div>
      
      <div className="border-b">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-10">
            <TabsTrigger value="overview" className="flex items-center">
              <Layout className="h-4 w-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center">
              <ListTodo className="h-4 w-4 mr-2" />
              Tareas
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="schedules" className="flex items-center">
              <BarChart4 className="h-4 w-4 mr-2" />
              Cronogramas
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Tiempo
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="imageAnalysis" className="flex items-center">
              <Image className="h-4 w-4 mr-2" />
              Análisis de Imágenes
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Ajustes
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
