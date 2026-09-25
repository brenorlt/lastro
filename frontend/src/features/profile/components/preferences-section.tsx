"use client";

import { Card } from "@/components/ui/primitives";
import { OptionCards } from "@/components/ui/pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsSection } from "@/components/ui/settings-section";
import { toast } from "@/components/ui/toaster";
import { userMessage } from "@/services/api-error";
import { useAuthStore } from "@/stores/auth-store";
import type { Currency, Locale, ThemePreference, User } from "@/types/auth";
import { profileApi, type ProfileUpdate } from "../api";
import { CURRENCIES, LOCALES, TIMEZONES } from "../schemas";
import { useThemePreference } from "../use-theme-preference";

/** Salva na hora (sem botão), com atualização otimista e reversão em caso de erro. */
async function savePreference(patch: ProfileUpdate) {
  const store = useAuthStore.getState();
  const previous = store.user;
  if (previous) store.setUser({ ...previous, ...(patch as Partial<User>) });
  try {
    await profileApi.update(patch);
    toast.success("Preferência salva");
  } catch (err) {
    if (previous) useAuthStore.getState().setUser(previous);
    toast.error(userMessage(err));
  }
}

function PreferenceRow({ id, label, description, children }: { id: string; label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-center sm:gap-6 sm:px-6">
      <div>
        <label id={`${id}-label`} className="text-sm font-medium text-ink">{label}</label>
        <p className="text-xs text-ink-3">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function PreferencesSection({ user }: { user: User }) {
  const { theme, setTheme } = useThemePreference();
  const timezones = TIMEZONES.some((t) => t.value === user.timezone)
    ? TIMEZONES
    : [{ value: user.timezone, label: user.timezone }, ...TIMEZONES];

  return (
    <SettingsSection id="preferencias" title="Preferências" description="Moeda, idioma, fuso e aparência. Salvas automaticamente.">
      <Card className="divide-y divide-line">
        <PreferenceRow id="currency" label="Moeda principal" description="Usada para exibir saldos e relatórios.">
          <Select value={user.currency} onValueChange={(v) => void savePreference({ currency: v as Currency })}>
            <SelectTrigger aria-labelledby="currency-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </PreferenceRow>
        <PreferenceRow id="locale" label="Idioma" description="Formato de datas e números.">
          <Select value={user.locale} onValueChange={(v) => void savePreference({ locale: v as Locale })}>
            <SelectTrigger aria-labelledby="locale-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </PreferenceRow>
        <PreferenceRow id="timezone" label="Fuso horário" description="Define quando um dia ou mês começa nos seus relatórios.">
          <Select value={user.timezone} onValueChange={(v) => void savePreference({ timezone: v })}>
            <SelectTrigger aria-labelledby="timezone-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              {timezones.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </PreferenceRow>
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium text-ink">Aparência</p>
            <p className="text-xs text-ink-3">Recomendado: automático, acompanhando o sistema.</p>
          </div>
          <OptionCards<ThemePreference>
            label="Aparência"
            columns={3}
            value={theme}
            onChange={(v) => void setTheme(v)}
            options={[
              { value: "SYSTEM", label: "Automático", description: "Segue o sistema" },
              { value: "LIGHT", label: "Claro" },
              { value: "DARK", label: "Escuro" },
            ]}
          />
        </div>
      </Card>
    </SettingsSection>
  );
}
