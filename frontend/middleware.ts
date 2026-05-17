import { NextRequest, NextResponse } from "next/server"

// Auth is handled client-side via localStorage tokens.
// Middleware only passes through all requests.
export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
