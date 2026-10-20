import { Phone, MessageSquareText, Mail } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { getPreferences } from "@/lib/domain/engagement";
import { Card, PageHeader, SectionHeader } from "@/components/ui/primitives";
import { CallbackForm, PreferencesForm } from "@/components/rewards/help-forms";
import { formatPoints } from "@/lib/utils";

export const metadata = { title: "Help & preferences" };

export default async function HelpPage() {
  const user = await requireMerchantPage();
  const { db, merchant, settings } = loadMerchantContext(user.merchantId);
  const prefs = getPreferences(db, merchant.id);
  const [silver, gold, platinum] = [...settings.tiers].sort((a, b) => a.threshold - b.threshold);
  const tel = (s: string) => s.replace(/[^\d+]/g, "");

  const rules = [
    {
      title: "Earn",
      body: `Every funded deal earns ${settings.earning.pointsPerHundredDollars} points per $100 funded, including renewals. A $100,000 renewal earns ${formatPoints(
        Math.floor(1000 * settings.earning.pointsPerHundredDollars * settings.earning.renewalMultiplier),
      )} points.`,
    },
    {
      title: "Pending points",
      body: `New points become spendable after ${settings.release.onTimePaymentsRequired} on-time payments, usually about ${settings.release.typicalDays} days. Points from deals that default are removed.`,
    },
    {
      title: "Level up",
      body: `${silver.name} starts at 0, ${gold.name} at ${formatPoints(gold.threshold)} and ${platinum.name} at ${formatPoints(platinum.threshold)} lifetime points. Redeeming never lowers your tier.`,
    },
    {
      title: "Milestones",
      body: `Anniversaries (+${formatPoints(settings.bonuses.anniversary)}), your first funding (+${formatPoints(settings.bonuses.firstFunding)}) and paying a balance in full (+${formatPoints(settings.bonuses.paidInFull)}) add bonus points automatically.`,
    },
    {
      title: "Referrals",
      body: `You and a business you refer each earn ${formatPoints(settings.bonuses.referralFunded)} points when their funding closes. Up to ${settings.referrals.maxPerYear} referrals per year.`,
    },
    {
      title: "Claim",
      body: "Pick any unlocked reward. Points are deducted when you confirm, and we email you as your reward is prepared and delivered.",
    },
    {
      title: "Expiration",
      body: `Points expire after ${settings.expiration.inactivityMonths} months with no account activity. We email you ${settings.expiration.warningDays} days before any points expire.`,
    },
    {
      title: "Limits and taxes",
      body: `Up to ${settings.limits.maxRedemptionsPerMonth} rewards per month. Some rewards may be reportable for tax purposes, and we'll send any required forms.`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Help & preferences"
        title="Questions? We're here to help"
        description="Stop by anytime. Reach out about your rewards, your account or anything else, and your account team will get back to you."
      />

      <section id="contact" className="scroll-mt-28" aria-labelledby="contact-heading">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
          <Card className="p-5 sm:p-6">
            <SectionHeader
              id="contact-heading"
              title="Contact your account team"
              description={`${merchant.accountManager} and the rewards team · ${settings.support.hours}`}
              className="mb-4"
            />
            <ul className="space-y-2.5">
              {[
                { icon: Phone, label: "Call", value: settings.support.phone, href: `tel:${tel(settings.support.phone)}` },
                { icon: MessageSquareText, label: "Text", value: settings.support.sms, href: `sms:${tel(settings.support.sms)}` },
                { icon: Mail, label: "Email", value: settings.support.email, href: `mailto:${settings.support.email}?subject=Big%20Think%20Rewards%20question` },
              ].map(({ icon: Icon, label, value, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/40 p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink" aria-hidden>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{label}</span>
                      <span className="block text-[13px] text-ink-3">{value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 sm:p-6">
            <SectionHeader title="Prefer a call back?" description="Tell us what it's about and when to call." className="mb-4" />
            <CallbackForm defaultPhone={merchant.phone} />
          </Card>
        </div>
      </section>

      <section id="preferences" className="mt-10 scroll-mt-28" aria-labelledby="prefs-heading">
        <Card className="p-5 sm:p-6">
          <SectionHeader
            id="prefs-heading"
            title="Email updates"
            description="Choose what we let you know about. We keep it short and only send what you pick. Changes save automatically."
            className="mb-2"
          />
          <PreferencesForm initial={prefs} email={merchant.email} />
        </Card>
      </section>

      <section id="how-it-works" className="mt-10 scroll-mt-28" aria-labelledby="how-heading">
        <SectionHeader id="how-heading" title="How rewards work" />
        <Card className="p-5 sm:p-6">
          <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {rules.map((r) => (
              <div key={r.title}>
                <dt className="text-sm font-semibold text-ink">{r.title}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-3">{r.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-ink-3">
            Program terms: the program is open to Big Think Capital clients in good standing. Rewards, point values and benefits may
            change, and substitutions of equal or greater value may be made. Points have no cash value and cannot be transferred.
            Big Think Capital may end or modify the program with notice.
          </p>
        </Card>
      </section>
    </>
  );
}
