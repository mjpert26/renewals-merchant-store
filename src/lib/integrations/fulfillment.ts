import type { DeliveryMethod, Redemption } from "@/lib/domain/types";

/**
 * Fulfillment boundary. A real gift card provider can implement this
 * interface later; until one is selected, every reward routes to the manual
 * workflow where staff fulfill requests from /admin/redemptions.
 */
export interface FulfillmentProvider {
  readonly id: string;
  readonly label: string;
  /** True when this provider performs real-world delivery. */
  readonly live: boolean;
  supports(method: DeliveryMethod): boolean;
  /** Called after points are reserved. Returns the note shown to staff. */
  submit(redemption: Pick<Redemption, "reference" | "rewardName" | "variantLabel" | "details">): Promise<{ note: string }>;
}

export const manualFulfillment: FulfillmentProvider = {
  id: "manual",
  label: "Manual fulfillment (staff queue)",
  live: false,
  supports: () => true,
  async submit(redemption) {
    return { note: `Queued for staff fulfillment: ${redemption.rewardName} (${redemption.variantLabel}).` };
  },
};

export function providerFor(method: DeliveryMethod): FulfillmentProvider {
  // No digital gift card vendor has been selected yet, so every method uses
  // the manual queue. Register a provider here once one is approved.
  void method;
  return manualFulfillment;
}
