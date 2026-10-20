import { requireAdminPage } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: { default: "Admin", template: "%s · Rewards Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  return (
    <AppShell area="admin" demo={isDemoMode()} account={{ name: user.name, subtitle: user.title ?? "Staff" }}>
      {children}
    </AppShell>
  );
}
