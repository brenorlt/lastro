"use client";

import { Card } from "@/components/ui/primitives";
import { SettingRow, SettingsSection } from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { userMessage } from "@/services/api-error";
import { useAuthStore } from "@/stores/auth-store";
import type { NotificationPrefs, User } from "@/types/auth";
import { profileApi } from "../api";

type TopicKey = Exclude<keyof NotificationPrefs, "channels">;

const TOPICS: { key: TopicKey; label: string; description: string }[] = [
  { key: "billsDue", label: "Contas a vencer", description: "Lançamentos agendados próximos do vencimento" },
  { key: "invoiceDue", label: "Faturas de cartão", description: "Fechamento e vencimento das faturas" },
  { key: "budgetAlerts", label: "Orçamento", description: "Ao atingir 50%, 80% e 100% do limite" },
  { key: "goalReminders", label: "Metas", description: "Quando uma meta estiver atrasada" },
  { key: "emergencyFund", label: "Reserva financeira", description: "Quando a reserva ficar abaixo do objetivo" },
  { key: "recurring", label: "Lançamentos recorrentes", description: "Quando um recorrente for criado automaticamente" },
  { key: "newTransactions", label: "Novas movimentações", description: "A cada lançamento registrado" },
  { key: "weeklySummary", label: "Resumo semanal", description: "Um panorama da semana, toda segunda-feira" },
];

async function save(next: NotificationPrefs, patch: Parameters<typeof profileApi.update>[0]["notificationPrefs"]) {
  const store = useAuthStore.getState();
  const previous = store.user;
  if (previous) store.setUser({ ...previous, notificationPrefs: next });
  try {
    await profileApi.update({ notificationPrefs: patch });
  } catch (err) {
    if (previous) useAuthStore.getState().setUser(previous);
    toast.error(userMessage(err));
  }
}

export function NotificationsSection({ user }: { user: User }) {
  const prefs = user.notificationPrefs;
  const noChannel = !prefs.channels.inApp && !prefs.channels.email;

  return (
    <SettingsSection id="notificacoes" title="Notificações" description="Escolha o que merece sua atenção e por onde avisamos.">
      <div className="space-y-4">
        <Card className="divide-y divide-line">
          {(["inApp", "email"] as const).map((ch) => (
            <SettingRow
              key={ch}
              htmlFor={`ch-${ch}`}
              label={ch === "inApp" ? "No aplicativo" : "Por e-mail"}
              description={ch === "inApp" ? "Central de notificações do Lastro" : "Enviadas para " + user.email}
              control={
                <Switch
                  id={`ch-${ch}`}
                  checked={prefs.channels[ch]}
                  onCheckedChange={(v) => void save({ ...prefs, channels: { ...prefs.channels, [ch]: v } }, { channels: { [ch]: v } })}
                />
              }
            />
          ))}
        </Card>
        <Card className={noChannel ? "divide-y divide-line opacity-60" : "divide-y divide-line"} aria-disabled={noChannel || undefined}>
          {TOPICS.map((t) => (
            <SettingRow
              key={t.key}
              htmlFor={`topic-${t.key}`}
              label={t.label}
              description={t.description}
              control={
                <Switch
                  id={`topic-${t.key}`}
                  checked={prefs[t.key]}
                  disabled={noChannel}
                  onCheckedChange={(v) => void save({ ...prefs, [t.key]: v }, { [t.key]: v })}
                />
              }
            />
          ))}
        </Card>
        {noChannel && <p className="text-xs text-ink-3">Ative ao menos um canal para receber avisos.</p>}
      </div>
    </SettingsSection>
  );
}
