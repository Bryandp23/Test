import { NextResponse } from "next/server";
import { logout } from "@/lib/server/auth";
import { requestOrigin } from "@/lib/server/http";

export async function POST(req: Request) {
  await logout();
  return NextResponse.redirect(`${requestOrigin(req)}/admin/login?deconnecte=1`, 303);
}
