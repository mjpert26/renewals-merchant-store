"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { runDailyJobsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function RunJobsButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await runDailyJobsAction();
          if (result.ok) {
            toast.success(
              result.data.anniversaries
                ? `Awarded ${result.data.anniversaries} anniversary bonus${result.data.anniversaries === 1 ? "" : "es"}`
                : "Daily jobs ran. Nothing was due.",
            );
          } else toast.error(result.error);
        })
      }
    >
      {!pending && <RefreshCw className="h-4 w-4" aria-hidden />}
      Run daily jobs
    </Button>
  );
}
