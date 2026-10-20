// Demo mode turns on the persona sign-in screen, simulated funding tools and
// the "demo data" labels. It is on unless DEMO_MODE is explicitly "false".
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}
