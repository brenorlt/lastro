import type { Metadata } from "next";
import { UserDetailView } from "@/features/admin/components/user-detail-view";

export const metadata: Metadata = { title: "Usuário · Admin" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailView userId={id} />;
}
