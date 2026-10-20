import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/token";

// Optimistic gate only: sends signed-out visitors to the sign-in page.
// Role checks and authorization are enforced again in every page, Server
// Function and Route Handler via src/lib/auth/session.ts.
export function proxy(request: NextRequest) {
  const session = verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/integrations|api/health|_next/static|_next/image|images/|favicon.ico).*)"],
};
