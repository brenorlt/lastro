import type { Metadata } from "next";
import { NotificationsView } from "@/features/notifications/components/notifications-view";

export const metadata: Metadata = { title: "Notificações" };

export default function NotificationsPage() {
  return <NotificationsView />;
}
