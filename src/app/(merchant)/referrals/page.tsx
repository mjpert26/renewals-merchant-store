import { Gift, Send, BadgeCheck } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { listReferrals, referralsThisYear, REFERRAL_STATUS_LABELS } from "@/lib/domain/engagement";
import { Badge, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { ReferralLink, ReferralForm } from "@/components/rewards/referral-forms";
import { formatDate, formatPoints } from "@/lib/utils";
import type { ReferralStatus } from "@/lib/domain/types";

export const metadata = { title: "Refer a business" };

const TONES: Record<ReferralStatus, "brand" | "warn" | "success" | "neutral"> = {
  submitted: "brand",
  in_review: "warn",
  funded: "success",
  not_funded: "neutral",
};

export default async function ReferralsPage() {
  const user = await requireMerchantPage();
  const { db, merchant, settings } = loadMerchantContext(user.merchantId);
  const referrals = listReferrals(db, merchant.id);
  const used = referralsThisYear(db, merchant.id);
  const remaining = Math.max(0, settings.referrals.maxPerYear - used);
  const link = `https://bigthinkcapital.com/refer/${merchant.referralCode}`;

  return (
    <>
      <PageHeader
        eyebrow="Refer a business"
        title={
          <>
            You both earn <span className="text-gold-ink">{formatPoints(settings.bonuses.referralFunded)} points</span>
          </>
        }
        description={`Know a business owner who could use working capital? When their funding closes, you and the business you referred each get ${formatPoints(settings.bonuses.referralFunded)} points.`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionHeader title="Your referral link" description="Share it by text, email or social. Funded referrals are credited automatically." className="mb-4" />
            <ReferralLink link={link} code={merchant.referralCode} />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold text-ink">How it works</h2>
            <ol className="mt-4 space-y-4">
              {[
                { icon: Send, title: "Share or send details", body: "Use your link, or send us their details below with their permission." },
                { icon: BadgeCheck, title: "We take it from there", body: "A funding specialist reaches out and keeps you posted on the status here." },
                { icon: Gift, title: "You both get rewarded", body: `When their funding closes, ${formatPoints(settings.bonuses.referralFunded)} points land in each account.` },
              ].map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      <span className="sr-only">Step {i + 1}: </span>
                      {title}
                    </p>
                    <p className="text-sm text-ink-3">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="p-5 sm:p-6">
          <SectionHeader
            title="Or send us their details"
            description={`You can refer up to ${settings.referrals.maxPerYear} businesses per year. ${remaining} remaining this year.`}
            className="mb-4"
          />
          <ReferralForm disabled={remaining === 0} />
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="your-referrals">
        <SectionHeader id="your-referrals" title="Your referrals" />
        <Card className="overflow-hidden">
          {referrals.length ? (
            <ul className="divide-y divide-line">
              {referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.businessName}</p>
                    <p className="text-[13px] text-ink-3">
                      {r.ownerName} · Referred {formatDate(r.createdAt)}
                    </p>
                  </div>
                  {r.status === "funded" && r.bonusPoints ? (
                    <p className="num text-sm font-bold text-success">+{formatPoints(r.bonusPoints)}</p>
                  ) : null}
                  <Badge tone={TONES[r.status]} dot>
                    {REFERRAL_STATUS_LABELS[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No referrals yet" description="Businesses you refer will appear here with their status." />
          )}
        </Card>
      </section>
    </>
  );
}
