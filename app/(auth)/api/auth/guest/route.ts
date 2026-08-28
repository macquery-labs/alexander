import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signIn } from "@/app/(auth)/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";
import { userExists } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  const token = await getToken({
    req: request,
    secureCookie: !isDevelopmentEnvironment,
    ...(process.env.AUTH_SECRET === undefined
      ? {}
      : { secret: process.env.AUTH_SECRET }),
  });

  // A token alone is not enough: it stays valid after its user row is gone, and
  // every write would then fail a foreign key. Signing a fresh guest in is the
  // way out, and is also what stops this bouncing back and forth with the app.
  const hasUser =
    typeof token?.id === "string" ? await userExists(token.id) : false;

  if (token && hasUser) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return signIn("guest", { redirect: true, redirectTo: redirectUrl });
}
