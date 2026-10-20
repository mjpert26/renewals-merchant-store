import type { RedemptionStatus } from "./types";

export const STATUS_LABELS: Record<RedemptionStatus, string> = {
  requested: "Requested",
  processing: "Processing",
  shipped: "On its way",
  fulfilled: "Delivered",
  canceled: "Canceled",
  failed: "Could not fulfill",
};
