/* End-to-end checks against a running server. Mutates data, so point it at a
 * throwaway database:
 *
 *   npm run build
 *   export SESSION_SECRET=$(openssl rand -hex 32)
 *   REWARDS_DB_PATH=/tmp/rewards-e2e.db FUNDING_WEBHOOK_SECRET=e2e-secret-0123456789abcdef PORT=3100 npm start &
 *   E2E_BASE_URL=http://localhost:3100 E2E_WEBHOOK_SECRET=e2e-secret-0123456789abcdef npm run e2e
 *
 * SESSION_SECRET must match the server's so the script can sign test sessions.
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { createToken, SESSION_COOKIE } from "../src/lib/auth/token";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const secret = process.env.E2E_WEBHOOK_SECRET;
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(context: BrowserContext, userId: string) {
  await context.clearCookies();
  await context.addCookies([{ name: SESSION_COOKIE, value: createToken(userId), domain: new URL(base).hostname, path: "/" }]);
}

async function headerPoints(page: Page) {
  const label = await page.locator('header a[href="/activity"]').getAttribute("aria-label");
  return Number(label?.match(/^([\d,]+)/)?.[1].replace(/,/g, ""));
}

// Merchant pages stream in behind a loading skeleton, so wait for real content before reading.
async function visible(locator: ReturnType<Page["locator"]>, timeout = 10000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

async function openClaims(page: Page) {
  await page.goto(`${base}/claims`);
  await visible(page.getByRole("heading", { name: "Your rewards, on their way" }));
}

async function claimCount(page: Page) {
  await openClaims(page);
  return page.locator('a[href^="/claims/rd_"]').count();
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();

  // ---- Access control ----
  const anon = await page.goto(`${base}/`);
  check("Signed-out visitors are sent to sign in", anon?.url().endsWith("/login") ?? false, anon?.url());

  await signIn(context, "usr_jordan");
  await page.goto(`${base}/admin`);
  check("Merchants cannot open the admin area", !page.url().includes("/admin"), page.url());

  await signIn(context, "usr_marcus");
  await page.goto(`${base}/claims`);
  const marcusClaim = await page.locator('a[href^="/claims/rd_"]').first().getAttribute("href");
  await signIn(context, "usr_jordan");
  await page.goto(`${base}${marcusClaim}`);
  // The merchant area streams (loading.tsx), so not-found renders with a 200 status; check content instead.
  const leaked = (await page.getByText("Smart Watch").count()) + (await page.getByText("Marcus Bell").count());
  check(
    "A merchant cannot view another merchant's claim",
    (await page.getByRole("heading", { name: "We couldn't find that page" }).count()) === 1 && leaked === 0,
    leaked ? "foreign data rendered" : "",
  );

  // ---- Balances on the overview ----
  await page.goto(`${base}/`);
  await visible(page.getByRole("heading", { name: /Welcome back/ }));
  const start = await headerPoints(page);
  check("Overview shows the demo balance", start === 5250, String(start));
  check("Overview shows pending points", await visible(page.getByText("3,200")));

  // ---- Unavailable and insufficient states ----
  await page.goto(`${base}/rewards/smart-watch`);
  check("Tier-locked reward explains the lock", await page.getByRole("button", { name: "Available at Platinum" }).isDisabled());
  await page.goto(`${base}/rewards/leather-padfolio`);
  check("Out-of-stock reward cannot be claimed", await page.getByRole("button", { name: "Out of stock" }).isDisabled());
  await page.goto(`${base}/rewards/digital-prepaid-card`);
  await page.getByText("$100", { exact: true }).click();
  check(
    "Unaffordable option shows how many points are missing",
    await page.getByRole("button", { name: "750 more points needed" }).isDisabled(),
  );

  // ---- Catalog filter ----
  await page.goto(`${base}/rewards`);
  await page.getByRole("switch", { name: "Only show rewards I can afford" }).click();
  await page.waitForURL(/affordable=1/);
  await page.locator("main ul li a[href^='/rewards/']").nth(11).waitFor({ state: "detached" });
  const affordableCards = await page.locator("main ul li a[href^='/rewards/']").count();
  check("“Affordable with my points” filters the catalog", affordableCards === 11, `${affordableCards} shown`);

  // ---- Redeem an eligible reward, double-clicking confirm ----
  const before = await claimCount(page);
  await page.goto(`${base}/rewards/premium-headphones`);
  await page.getByLabel("Color").selectOption("Midnight");
  await page.getByLabel("Street address").fill("418 King Street");
  await page.getByLabel("ZIP").fill("29403");
  await page.getByRole("button", { name: "Review claim" }).click();
  const dialog = page.getByRole("dialog");
  check("Confirmation shows points spent and balance after", (await dialog.getByText("750 pts").count()) > 0);
  const confirm = dialog.getByRole("button", { name: /Confirm and spend/ });
  await confirm.dblclick();
  await page.waitForURL(/\/claims\/rd_.*\?new=1/, { timeout: 15000 });
  check("Receipt confirms the claim", await visible(page.getByRole("heading", { name: "Your reward is on its way" })));
  const after = await claimCount(page);
  check("Double-clicking confirm creates exactly one claim", after === before + 1, `${before} → ${after}`);
  await page.goto(`${base}/`);
  check("Balance drops by the reward cost", (await headerPoints(page)) === 750);
  await page.goto(`${base}/activity`);
  check("Activity lists the redemption", await visible(page.getByText("Redeemed: Premium Headphones")));

  // ---- Admin fulfills the claim ----
  await signIn(context, "usr_alyssa");
  await page.goto(`${base}/admin/claims`);
  await page.getByRole("row", { name: /Premium Headphones.*Coastal Kitchen/ }).getByRole("link", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await page.getByText(/marked delivered/).waitFor({ timeout: 10000 });
  check("Staff can mark a claim delivered", true);

  await signIn(context, "usr_jordan");
  await openClaims(page);
  const claimLinks = await page.locator('a[href^="/claims/rd_"]').allInnerTexts();
  const headphones = claimLinks.find((t) => t.includes("Premium Headphones")) ?? "(not listed)";
  check("Merchant sees the updated fulfillment status", headphones.includes("Delivered"), headphones.replace(/\s+/g, " "));

  // ---- Staff adjustment requires a reason and is audited ----
  await signIn(context, "usr_alyssa");
  await page.goto(`${base}/admin/merchants/mer_harbor`);
  await page.getByRole("button", { name: "Adjust points" }).click();
  const adjust = page.getByRole("dialog", { name: "Adjust points" });
  await adjust.getByRole("textbox", { name: "Points", exact: true }).fill("300");
  const apply = adjust.getByRole("button", { name: "Apply adjustment" });
  check("Adjustment cannot be applied without a reason", await apply.isDisabled());
  await adjust.getByRole("textbox", { name: "Reason" }).fill("Goodwill credit for a delayed shipment");
  await apply.click();
  await page.getByLabel(/Notifications/).getByText("Added 300 points").waitFor({ timeout: 10000 });
  await page.goto(`${base}/admin/audit?type=ledger_entry`);
  check("Adjustment appears in the audit log with its reason", (await page.getByText("Goodwill credit for a delayed shipment").count()) > 0);

  // ---- Funding webhook ----
  const unauth = await fetch(`${base}/api/integrations/funding-events`, { method: "POST", body: "{}" });
  check("Webhook rejects unauthenticated calls", unauth.status === 401 || unauth.status === 503, String(unauth.status));
  if (secret) {
    const body = JSON.stringify({
      source: "n8n",
      events: [{ externalId: "E2E-DEAL-1", merchantRef: "DEMO-ACCT-11207", dealType: "renewal", fundedAmount: 50000, fundedAt: new Date().toISOString() }],
    });
    const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
    const first = (await (await fetch(`${base}/api/integrations/funding-events`, { method: "POST", headers, body })).json()) as {
      results: { status: string }[];
    };
    const second = (await (await fetch(`${base}/api/integrations/funding-events`, { method: "POST", headers, body })).json()) as {
      results: { status: string }[];
    };
    check("First webhook delivery records the funding", first.results[0].status === "created");
    check("Repeated webhook delivery is ignored", second.results[0].status === "duplicate");
    await page.goto(`${base}/admin/merchants/mer_harbor`);
    check("Duplicate delivery awarded pending points once", (await page.getByText("E2E-DEAL-1").count()) === 1);
  } else {
    console.log("· Skipping authenticated webhook checks (set E2E_WEBHOOK_SECRET)");
  }

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll end-to-end checks passed");
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
