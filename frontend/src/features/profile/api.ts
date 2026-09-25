import { api } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Currency, Locale, NotificationPrefs, ThemePreference, User } from "@/types/auth";

export interface ProfileUpdate {
  name?: string;
  phone?: string | null;
  currency?: Currency;
  locale?: Locale;
  timezone?: string;
  theme?: ThemePreference;
  notificationPrefs?: Partial<Omit<NotificationPrefs, "channels">> & { channels?: Partial<NotificationPrefs["channels"]> };
}

/** Toda resposta com o usuário atualiza o store — é a fonte da verdade do perfil na UI. */
const commit = ({ data }: { data: User }) => {
  useAuthStore.getState().setUser(data);
  return data;
};

export const profileApi = {
  me: () => api.get<User>("/users/me").then(commit),
  update: (input: ProfileUpdate) => api.patch<User>("/users/me", input).then(commit),
  uploadAvatar(file: File) {
    const form = new FormData();
    form.append("file", file);
    return api.upload<User>("/users/me/avatar", form).then(commit);
  },
  removeAvatar: () => api.delete<User>("/users/me/avatar").then(commit),
  async deleteAccount(password: string) {
    await api.delete<null>("/users/me", { password, confirmation: "EXCLUIR" });
    useAuthStore.getState().clear();
  },
};
