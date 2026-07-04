import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, AtSign, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface TaskCommentsProps {
  taskId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface Comment {
  id: number;
  content: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    username: string;
    profileImage?: string;
  };
}

interface User {
  id: number;
  fullName: string;
  username: string;
  profileImage?: string;
}

export default function TaskComments({ taskId, isOpen, onClose }: TaskCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // ponytail: realtime sync para comentarios de tareas
  useRealtimeSync({
    table: 'task_comments',
    filter: `task_id=eq.${taskId}`,
    queryKey: ['tasks', taskId, 'comments'],
    enabled: isOpen && !!taskId
  });

  // Obtener comentarios de la tarea
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['tasks', taskId, 'comments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, user:users(id, full_name, username, profile_image)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return fromDbArray("task_comments", data);
    },
    enabled: isOpen && !!taskId,
  });

  // Obtener usuarios para menciones
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, username, profile_image")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return fromDbArray("users", data);
    },
    enabled: isOpen,
  });

  // Mutación para crear comentario
  const createCommentMutation = useMutation({
    mutationFn: async (commentData: { content: string; taskId: number }) => {
      return dbQuery("task_comments").insertSingle({
        taskId,
        userId: user?.id,
        content: commentData.content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] });
      setNewComment("");
      toast({
        title: "Comentario agregado",
        description: "Tu comentario ha sido añadido exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar el comentario. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    
    createCommentMutation.mutate({
      content: newComment,
      taskId
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setNewComment(value);
    setCursorPosition(position);

    // Detectar mención (@)
    const textBeforeCursor = value.substring(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const searchTerm = mentionMatch[1].toLowerCase();
      const filteredUsers = users.filter((u: User) => 
        u.fullName.toLowerCase().includes(searchTerm) ||
        u.username.toLowerCase().includes(searchTerm)
      );
      setMentionSuggestions(filteredUsers);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: User) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
      setNewComment(newText);
      setShowMentions(false);
    }
  };

  const renderCommentContent = (content: string) => {
    // Resaltar menciones en los comentarios
    return content.replace(/@(\w+)/g, '<span class="text-primary font-medium">@$1</span>');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] mx-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Comentarios de la Tarea</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Lista de comentarios */}
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Cargando comentarios...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No hay comentarios aún.</p>
                  <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>
                </div>
              ) : (
                comments.map((comment: Comment) => (
                  <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.user.profileImage} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{comment.user.fullName}</span>
                        <Badge variant="outline" className="text-xs">
                          @{comment.user.username}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </span>
                      </div>
                      <div 
                        className="text-sm"
                        dangerouslySetInnerHTML={{ 
                          __html: renderCommentContent(comment.content) 
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Formulario de nuevo comentario */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Textarea
                placeholder="Escribe un comentario... Usa @ para mencionar usuarios"
                value={newComment}
                onChange={handleTextareaChange}
                className="min-h-[80px] resize-none"
                disabled={createCommentMutation.isPending}
              />
              
              {/* Sugerencias de mención */}
              {showMentions && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full mb-1 w-full bg-popover border rounded-md shadow-lg z-10 max-h-32 overflow-y-auto">
                  {mentionSuggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                      onClick={() => insertMention(user)}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.profileImage} />
                        <AvatarFallback>
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{user.fullName}</div>
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AtSign className="h-3 w-3" />
                <span>Usa @ para mencionar usuarios</span>
              </div>
              <Button 
                type="submit" 
                disabled={!newComment.trim() || createCommentMutation.isPending}
                size="sm"
              >
                {createCommentMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Comentar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}