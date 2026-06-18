// app/api/profil/route.ts — ⚠️ CSRF encore présent — à corriger plus tard
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const form = await req.formData();
  const nouvelEmail = String(form.get("email") ?? "");

  const db = await getDb();
  db("UPDATE users SET email = ? WHERE id = ?", [nouvelEmail, Number(sessionId)]);

  return NextResponse.json({ message: `Email du compte ${sessionId} changé en ${nouvelEmail}` });
}