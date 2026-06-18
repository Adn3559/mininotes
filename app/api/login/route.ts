// app/api/login/route.ts — ✅ CORRIGÉ : requête paramétrée + bcrypt (à suivre)
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const db = await getDb();

  // requête paramétrée — on récupère l'utilisateur par email SEULEMENT
  const sql = "SELECT * FROM users WHERE email = ?";
  console.log("🔎 SQL exécuté :", sql, "| params:", [email]);

  const rows = db(sql, [email]) as Array<{ id: number; email: string; password: string; role: string }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: `Aucun compte ${email} avec ce mot de passe` },
      { status: 401 }
    );
  }

  const user = rows[0];

  // ✅ CORRECTIF : comparaison du mot de passe via bcrypt.compare (jamais en clair)
  const motDePasseValide = await bcrypt.compare(password, user.password);
  if (!motDePasseValide) {
    return NextResponse.json(
      { error: `Aucun compte ${email} avec ce mot de passe` },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ message: "Connecté", user });
  res.cookies.set("mininotes_session", String(user.id), { httpOnly: false, path: "/" });
  return res;
}