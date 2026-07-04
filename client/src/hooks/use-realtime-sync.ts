import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface UseRealtimeSyncOptions {
  table: string;
  filter?: string;
  queryKey: string | readonly unknown[];
  enabled?: boolean;
}

/**
 * Hook para sincronizar datos en tiempo real usando Supabase Realtime
 *
 * Cuando ocurre un cambio (INSERT, UPDATE, DELETE) en la tabla especificada,
 * invalida el query de TanStack Query para forzar un refetch.
 *
 * @param options.table - Nombre de la tabla a monitorear
 * @param options.filter - Filtro opcional (ej: 'project_id=eq.123')
 * @param options.queryKey - QueryKey de TanStack Query a invalidar
 * @param options.enabled - Si la suscripción está habilitada (default: true)
 *
 * @example
 * // Sincronizar tareas de un proyecto
 * useRealtimeSync({
 *   table: 'tasks',
 *   filter: `project_id=eq.${projectId}`,
 *   queryKey: ['tasks', projectId]
 * });
 *
 * @example
 * // Sincronizar mensajes de chat de un proyecto
 * useRealtimeSync({
 *   table: 'chat_messages',
 *   filter: `project_id=eq.${projectId}`,
 *   queryKey: ['chat_messages', projectId]
 * });
 */
export function useRealtimeSync({
  table,
  filter,
  queryKey,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Crear un canal único para esta suscripción
    const channelName = `public:${table}${filter ? `:${filter}` : ''}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        () => {
          // Invalidar el query para forzar un refetch
          queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
        }
      )
      .subscribe();

    // Cleanup: desuscribirse cuando el componente se desmonta
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, queryKey, enabled, queryClient]);
}
