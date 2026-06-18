// app/api/login/route.ts — ✅ injection SQL + bcrypt corrigés, fuite de données + message bavard corrigés ici
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const db = await getDb();

  const sql = "SELECT * FROM users WHERE email = ?";
  console.log("🔎 SQL exécuté :", sql, "| params:", [email]);

  const rows = db(sql, [email]) as Array<{ id: number; email: string; password: string; role: string }>;

  // ✅ CORRECTIF : message NEUTRE et IDENTIQUE, qu'on soit dans ce cas...
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Email ou mot de passe invalide" },
      { status: 401 }
    );
  }

  const user = rows[0];
  const motDePasseValide = await bcrypt.compare(password, user.password);

  // ✅ ... ou dans celui-ci : même message, même statut → pas d'énumération possible
  if (!motDePasseValide) {
    return NextResponse.json(
      { error: "Email ou mot de passe invalide" },
      { status: 401 }
    );
  }

  // ✅ CORRECTIF : réponse MINIMALE — jamais le hash du mot de passe
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