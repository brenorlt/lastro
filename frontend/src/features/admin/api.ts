import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { PaginationMeta } from "@/types/api";
import type { AdminOverview, AdminUserDetail, AdminUserListItem } from "@/types/admin";

const PAGE_SIZE = 20;

export const adminKeys = {
  overview: ["admin", "overview"] as const,
  users: (search: string, page: number) => ["admin", "users", search, page] as const,
  user: (id: string) => ["admin", "user", id] as const,
};

export const adminApi = {
  overview: () => api.get<AdminOverview>("/admin/overview"),
  users: (search: string, page: number) =>
    api.get<AdminUserListItem[], PaginationMeta>("/admin/users", {
      query: { search: search || undefined, page, pageSize: PAGE_SIZE },
    }),
  user: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`),
  grantAccess: (id: string, days: number) => api.post<null>(`/admin/users/${id}/grant-access`, { days }),
  block: (id: string) => api.post<null>(`/admin/users/${id}/block`),
  unblock: (id: string) => api.post<null>(`/admin/users/${id}/unblock`),
};

export function useAdminOverview() {
  return useQuery({ queryKey: adminKeys.overview, queryFn: async () => (await adminApi.overview()).data });
}

export function useAdminUsers(search: string, page: number) {
  return useQuery({
    queryKey: adminKeys.users(search, page),
    queryFn: () => adminApi.users(search, page),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string) {
  return useQuery({ queryKey: adminKeys.user(id), queryFn: async () => (await adminApi.user(id)).data });
}

function invalidateUser(qc: ReturnType<typeof useQueryClient>, id: string) {
  void qc.invalidateQueries({ queryKey: adminKeys.user(id) });
  void qc.invalidateQueries({ queryKey: ["admin", "users"] });
  void qc.invalidateQueries({ queryKey: adminKeys.overview });
}

export function useGrantAccess(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => adminApi.grantAccess(id, days),
    onSuccess: () => invalidateUser(qc, id),
  });
}

export function useBlockUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.block(id),
    onSuccess: () => invalidateUser(qc, id),
  });
}

export function useUnblockUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.unblock(id),
    onSuccess: () => invalidateUser(qc, id),
  });
}
