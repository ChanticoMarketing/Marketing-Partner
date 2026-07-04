import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dbQuery, fromDbArray, fromDb } from "@/lib/supabase-helpers";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, User, Sparkles } from "lucide-react";

interface ChatMessage {
  id: number;
  content: string;
  role: string;
  userId?: number;
  createdAt: string;
}

interface ProjectChatProps {
  projectId: number;
}

export default function ProjectChat({ projectId }: ProjectChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ponytail: realtime sync para mensajes de chat
  useRealtimeSync({
    table: 'chat_messages',
    filter: `project_id=eq.${projectId}`,
    queryKey: ['projects', projectId, 'chat']
  });
  
  // Fetch chat messages
  const { 
    data: messages, 
    isLoading, 
    error,
    refetch 
  } = useQuery<ChatMessage[]>({
    queryKey: ["projects", projectId, "chat"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return fromDbArray<ChatMessage>("chat_messages", data);
    },
    staleTime: 10000,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { message: content, projectId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setMessage("");
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  // Scroll to bottom when new messages come in
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
        <p>Error loading chat: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-20rem)]">
      <div className="flex-1 overflow-y-auto mb-4 rounded-lg border">
        <div className="p-4 space-y-4">
          {!messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="h-12 w-12 mb-4 text-primary/30" />
              <h3 className="text-lg font-medium">Start the conversation</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Ask questions about your project, get content suggestions, or brainstorm marketing ideas with our AI assistant.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className="flex h-8 w-8 flex-shrink-0 self-start mt-1">
                    <Avatar>
                      {msg.role === 'user' ? (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user?.fullName?.charAt(0) || 'U'}
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <Sparkles className="h-4 w-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  <div className={`mx-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div 
                      className={`inline-block rounded-lg px-4 py-2 ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(msg.createdAt), 'h:mm a')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>
      
      <div className="border rounded-lg p-2 flex items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about this project..."
          className="min-h-[80px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-transparent"
          disabled={sendMessageMutation.isPending}
        />
        <Button
          type="submit"
          size="icon"
          className="ml-2 mb-2"
          onClick={handleSendMessage}
          disabled={sendMessageMutation.isPending || !message.trim()}
        >
          {sendMessageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
