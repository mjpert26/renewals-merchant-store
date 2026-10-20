import Image from "next/image";
import { listDemoUsers, getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getMerchantSummary } from "@/lib/domain/merchants";
import { BrandLockup } from "@/components/brand";
import { isDemoMode } from "@/lib/env";
import { PersonaButton } from "./persona-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const demo = isDemoMode();
  const current = await getCurrentUser();
  const users = demo ? listDemoUsers() : [];
  const db = getDb();
  const merchants = users
    .filter((u) => u.role === "merchant")
    .map((u) => ({ user: u, summary: getMerchantSummary(db, u.merchantId!) }));
  const staff = users.filter((u) => u.role === "admin");

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_30%_20%,rgb(47_107_255/0.25),transparent_70%)]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLockup subtitle="Client Rewards" />
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-ink">Big Think Rewards</p>
            <h1 className="mt-3 text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
              Every funding earns more than capital.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              Merchants earn points each time their business is funded, including every renewal, and redeem them for gift
              cards, experiences and services that help the business grow.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3" aria-hidden>
            {["/images/rewards/headphones.webp", "/images/rewards/getaway.webp", "/images/rewards/prepaid-card.webp"].map((src) => (
              <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line">
                <Image src={src} alt="" fill sizes="200px" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <BrandLockup subtitle="Client Rewards" className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Sign in to the demo</h2>
          {demo ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                Choose an account to explore. All merchants, balances and claims are sample data. No real gift cards are issued
                and no messages are sent.
              </p>
              {current && (
                <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
                  Currently signed in as <span className="font-semibold text-ink">{current.name}</span>. Pick an account to switch.
                </p>
              )}
              <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Merchants</h3>
              <ul className="space-y-2.5">
                {merchants.map(({ user, summary }) => (
                  <li key={user.id}>
                    <PersonaButton
                      userId={user.id}
                      title={summary.merchant.businessName}
                      subtitle={`${user.name} · ${summary.merchant.city}, ${summary.merchant.state}`}
                      meta={`${summary.account.available.toLocaleString()} pts`}
                      badge={summary.tier.current.name}
                      tone={summary.tier.current.id === "silver" ? "neutral" : "gold"}
                      recommended={user.id === "usr_jordan"}
                    />
                  </li>
                ))}
              </ul>
              <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Big Think Capital staff</h3>
              <ul className="space-y-2.5">
                {staff.map((user) => (
                  <li key={user.id}>
                    <PersonaButton userId={user.id} title={user.name} subtitle={user.title ?? "Staff"} badge="Admin" tone="brand" />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Demo sign-in is turned off. Connect the company identity provider in <code>src/lib/auth</code> to enable sign-in.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
