import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { listRewards, availabilityFor } from "@/lib/domain/rewards";
import { PageHeader } from "@/components/ui/primitives";
import { RewardsBrowser } from "@/components/rewards/rewards-browser";
import { formatPoints } from "@/lib/utils";

export const metadata = { title: "Rewards catalog" };

export default async function RewardsPage() {
  const user = await requireMerchantPage();
  const { db, account, tier } = loadMerchantContext(user.merchantId);
  const ctx = { tier: tier.current.id, available: account.available };
  const items = listRewards(db).map((reward) => ({ reward, availability: availabilityFor(reward, ctx) }));
  return (
    <>
      <PageHeader
        eyebrow="Rewards catalog"
        title="Treat yourself, your team or your business"
        description={
          <>
            You have <span className="num font-semibold text-ink">{formatPoints(account.available)} points</span> to spend.
            {tier.next ? <> Reach {tier.next.name} to unlock premium rewards.</> : null}
          </>
        }
      />
      <RewardsBrowser items={items} available={account.available} />
    </>
  );
}
