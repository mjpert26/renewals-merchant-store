import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listReferrals, listSupportRequests, REFERRAL_STATUS_LABELS } from "@/lib/domain/engagement";
import { merchantNames } from "@/lib/data/admin";
import { PageHeader, SectionHeader, Badge, EmptyState, Notice } from "@/components/ui/primitives";
import { DataTable, Th, Td } from "@/components/admin/table";
import { ReferralStatusControl, CloseCallbackButton } from "@/components/admin/referral-controls";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Referrals & callbacks" };

export default async function AdminReferralsPage() {
  await requireAdminPage();
  const db = getDb();
  const referrals = listReferrals(db);
  const callbacks = listSupportRequests(db);
  const names = merchantNames();

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Referrals and callbacks"
        description="Track referred businesses through review, and close the loop on merchant callback requests."
      />
      <Notice tone="brand" className="mb-6">
        Marking a referral funded credits the referring merchant&apos;s bonus once. The referred business&apos;s matching bonus is applied
        after they&apos;re onboarded; until merchant onboarding is integrated, add it with a point adjustment.
      </Notice>

      <section aria-labelledby="ref-heading" className="mb-10">
        <SectionHeader id="ref-heading" title="Referrals" />
        {referrals.length ? (
          <DataTable label="Referrals">
            <thead>
              <tr>
                <Th>Referred business</Th>
                <Th>Contact</Th>
                <Th>Referred by</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <p className="font-semibold text-ink">{r.businessName}</p>
                    <p className="text-xs text-ink-3">{r.ownerName}</p>
                  </Td>
                  <Td>{r.contact}</Td>
                  <Td>
                    <Link href={`/admin/merchants/${r.merchantId}`} className="hover:text-ink hover:underline">
                      {names[r.merchantId]}
                    </Link>
                  </Td>
                  <Td>{formatDate(r.createdAt)}</Td>
                  <Td>
                    {r.status === "funded" ? (
                      <Badge tone="success" dot>
                        {REFERRAL_STATUS_LABELS[r.status]}
                      </Badge>
                    ) : (
                      <ReferralStatusControl referralId={r.id} status={r.status} businessName={r.businessName} />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState title="No referrals yet" />
        )}
      </section>

      <section id="callbacks" aria-labelledby="cb-heading" className="scroll-mt-28">
        <SectionHeader id="cb-heading" title="Callback requests" />
        {callbacks.length ? (
          <DataTable label="Callback requests">
            <thead>
              <tr>
                <Th>Merchant</Th>
                <Th>Topic</Th>
                <Th>Best time</Th>
                <Th>Phone</Th>
                <Th>Requested</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {callbacks.map((c) => (
                <tr key={c.id}>
                  <Td className="font-semibold text-ink">{names[c.merchantId]}</Td>
                  <Td>{c.topic}</Td>
                  <Td>{c.preferredTime}</Td>
                  <Td>
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="hover:text-ink hover:underline">
                      {c.phone}
                    </a>
                  </Td>
                  <Td>{formatDateTime(c.createdAt)}</Td>
                  <Td>{c.status === "open" ? <CloseCallbackButton id={c.id} /> : <Badge>Closed</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState title="No callback requests" />
        )}
      </section>
    </>
  );
}
