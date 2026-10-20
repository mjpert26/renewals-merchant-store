import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { AppShell } from "@/components/shell/app-shell";
import { isDemoMode } from "@/lib/env";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMerchantPage();
  const { merchant, account, tier } = loadMerchantContext(user.merchantId);
  return (
    <AppShell
      area="merchant"
      demo={isDemoMode()}
      account={{
        name: merchant.businessName,
        subtitle: `${tier.current.name} member · ${user.name}`,
        points: account.available,
      }}
    >
      {children}
    </AppShell>
  );
}
