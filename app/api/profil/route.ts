// app/api/profil/route.ts — ✅ CORRIGÉ : protection CSRF par double-submit cookie
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

// GET /api/profil/csrf → distribue un jeton anti-CSRF
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  // ✅ génère un jeton aléatoire et le pose dans un cookie lisible en JS (pas httpOnly)
  const token = randomBytes(32).toString("hex");
  const res = NextResponse.json({ csrfToken: token });
  res.cookies.set("csrf_token", token, { httpOnly: false, sameSite: "strict", path: "/" });
  return res;
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  // ✅ CORRECTIF : le client doit renvoyer le jeton dans l'en-tête X-CSRF-Token
  const csrfCookie = req.cookies.get("csrf_token")?.value;
  const csrfHeader = req.headers.get("X-CSRF-Token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: "Jeton CSRF invalide" }, { status: 403 });
  }

  const form = await req.formData();
  const nouvelEmail = String(form.get("email") ?? "");

  const db = await getDb();
  db("UPDATE users SET email = ? WHERE id = ?", [nouvelEmail, Number(sessionId)]);

  return NextResponse.json({ message: `Email changé en ${nouvelEmail}` });
}