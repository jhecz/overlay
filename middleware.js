import { NextResponse } from "next/server";

export function middleware(req) {
  const host = req.headers.get("host") || "";

  if (!host.startsWith("dashboard.jhecz.com")) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  const username = "jhecz";
  const password = process.env.DASHBOARD_PASSWORD;

  if (!password) {
    return new NextResponse("Dashboard password not set", { status: 500 });
  }

  const expected =
    "Basic " + btoa(`${username}:${password}`);

  if (auth === expected) {
    return NextResponse.next();
  }

  return new NextResponse("Login required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="JHecz Dashboard"',
    },
  });
}

export const config = {
  matcher: "/:path*",
};
