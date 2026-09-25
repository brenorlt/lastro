import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type { AppNotification } from "@/types/planning";

export const notificationKeys = { all: ["notifications"] as const };

type Meta = { page: number; total: number; totalPages: number; unreadCount: number };

/** Contagem de não lidas para o sino (poll leve a cada minuto). */
export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await api.get<AppNotification[], Meta>("/notifications", { query: { unread: true, pageSize: 1 } })).meta?.unreadCount ?? 0,
    refetchInterval: 60_000,
  });
}

export function useNotificationsPage(unread: boolean, page: number) {
  return useQuery({
    queryKey: ["notifications", "page", { unread, page }],
    queryFn: () => api.get<AppNotification[], Meta>("/notifications", { query: { unread: unread || undefined, page, pageSize: 30 } }),
    placeholderData: keepPreviousData,
  });
}

function useNotificationMutation<T>(fn: (v: T) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => success && toast.success(success),
    onError: (err) => toast.error(userMessage(err)),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export const useMarkRead = () => useNotificationMutation((id: string) => api.post(`/notifications/${id}/read`));
export const useMarkAllRead = () => useNotificationMutation(() => api.post("/notifications/read-all"), "Tudo marcado como lido");
export const useDeleteNotification = () => useNotificationMutation((id: string) => api.delete(`/notifications/${id}`));
export const useDeleteRead = () => useNotificationMutation(() => api.delete("/notifications?read=true"), "Notificações lidas removidas");
