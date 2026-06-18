// app/api/login/route.ts — ✅ CORRIGÉ : injection SQL + bcrypt + fuite + rate limiting
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";
import bcrypt from "bcryptjs";
import { verifierRateLimit, reinitialiserRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // ✅ CORRECTIF : rate limiting par IP
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { bloque } = verifierRateLimit(ip);

  if (bloque) {
    return NextResponse.json(
      { error: "Trop de tentatives, réessayez dans 1 minute" },
      { status: 429 }
    );
  }

  const { email, password } = await req.json();
  const db = await getDb();

  const sql = "SELECT * FROM users WHERE email = ?";
  const rows = db(sql, [email]) as Array<{ id: number; email: string; password: string; role: string }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Email ou mot de passe invalide" },
      { status: 401 }
    );
  }

  const user = rows[0];
  const motDePasseValide = await bcrypt.compare(password, user.password);

  if (!motDePasseValide) {
    return NextResponse.json(
      { error: "Email ou mot de passe invalide" },
      { status: 401 }
    );
  }

  // ✅ login réussi → on remet le compteur à zéro
  reinitialiserRateLimit(ip);

  const res = NextResponse.json({
    message: "Connecté",
    user: { id: user.id, email: user.email, role: user.role },
  });
  res.cookies.set("mininotes_session", String(user.id), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
  return res;
}