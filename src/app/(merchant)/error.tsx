"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function MerchantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5 text-warn" />}
        title="We couldn't load this page"
        description="Your points and claims are safe. This is usually temporary, so please try again. If it keeps happening, contact your account team."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <a href="/help#contact" className="inline-flex h-11 items-center px-4 text-sm font-semibold text-brand-ink">
              Contact support
            </a>
          </div>
        }
      />
      {error.digest && <p className="pb-6 text-center text-xs text-ink-3">Reference: {error.digest}</p>}
    </Card>
  );
}
