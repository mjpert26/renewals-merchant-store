/* Captures full-page screenshots of key routes at desktop and mobile sizes.
 * Usage: npm run screenshots -- [baseUrl] [routes...]
 * Requires the app to be running. Output goes to ./artifacts/screenshots. */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createToken, SESSION_COOKIE } from "../src/lib/auth/token";

const base = process.argv[2] ?? "http://localhost:3000";
const only = process.argv.slice(3);
const outDir = path.join(process.cwd(), "artifacts", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const ROUTES: { name: string; path: string; user: string | null }[] = [
  { name: "login", path: "/login", user: null },
  { name: "overview", path: "/", user: "usr_jordan" },
  { name: "rewards", path: "/rewards", user: "usr_jordan" },
  { name: "reward-detail", path: "/rewards/premium-headphones", user: "usr_jordan" },
  { name: "reward-locked", path: "/rewards/smart-watch", user: "usr_jordan" },
  { name: "activity", path: "/activity", user: "usr_jordan" },
  { name: "claims", path: "/claims", user: "usr_jordan" },
  { name: "benefits", path: "/benefits", user: "usr_jordan" },
  { name: "referrals", path: "/referrals", user: "usr_jordan" },
  { name: "help", path: "/help", user: "usr_jordan" },
  { name: "admin", path: "/admin", user: "usr_alyssa" },
  { name: "admin-claims", path: "/admin/claims", user: "usr_alyssa" },
  { name: "admin-merchants", path: "/admin/merchants", user: "usr_alyssa" },
  { name: "admin-merchant", path: "/admin/merchants/mer_coastal", user: "usr_alyssa" },
  { name: "admin-rewards", path: "/admin/rewards", user: "usr_alyssa" },
  { name: "admin-settings", path: "/admin/settings", user: "usr_alyssa" },
  { name: "admin-audit", path: "/admin/audit", user: "usr_alyssa" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

async function overflowCheck(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: string[] = [];
    if (doc.scrollWidth > doc.clientWidth + 1) {
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > doc.clientWidth + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.right)}`);
        }
      });
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders: offenders.slice(0, 5) };
  });
}

async function main() {
  const browser = await chromium.launch();
  const routes = only.length ? ROUTES.filter((r) => only.includes(r.name)) : ROUTES;
  let problems = 0;
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.isMobile ? 2 : 1,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      reducedMotion: "reduce",
    });
    for (const route of routes) {
      await context.clearCookies();
      if (route.user) {
        const url = new URL(base);
        await context.addCookies([{ name: SESSION_COOKIE, value: createToken(route.user), domain: url.hostname, path: "/" }]);
      }
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      const res = await page.goto(base + route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const file = path.join(outDir, `${route.name}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await overflowCheck(page);
      const status = res?.status();
      const bad = overflow.scrollWidth > overflow.clientWidth + 1 || errors.length > 0 || (status ?? 500) >= 400;
      if (bad) problems += 1;
      console.log(
        `${bad ? "✗" : "✓"} ${vp.name.padEnd(7)} ${route.path.padEnd(32)} ${status} ${
          overflow.scrollWidth > overflow.clientWidth + 1 ? `OVERFLOW ${overflow.scrollWidth}>${overflow.clientWidth} ${overflow.offenders.join(" | ")}` : ""
        } ${errors.length ? `ERRORS: ${errors.slice(0, 3).join(" | ")}` : ""}`,
      );
      await page.close();
    }
    await context.close();
  }
  await browser.close();
  if (problems) {
    console.log(`\n${problems} page(s) need attention.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
