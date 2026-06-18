// app/api/notes/route.ts — ✅ CORRIGÉ : injections SQL (requêtes paramétrées)
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const db = await getDb();

  // ✅ CORRECTIF : sessionId passé en paramètre, jamais collé dans la requête
  const rows = db("SELECT * FROM notes WHERE userId = ?", [Number(sessionId)]);
  return NextResponse.json({ notes: rows });
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const { titre, contenu } = await req.json();
  const db = await getDb();

  const nextId =
    (db("SELECT MAX(id) AS m FROM notes")[0] as { m: number }).m + 1;

  // ✅ CORRECTIF : titre/contenu passés en paramètres, jamais collés dans la requête
  db("INSERT INTO notes VALUES (?,?,?,?)", [nextId, Number(sessionId), titre, contenu]);

  return NextResponse.json({ message: "Note créée", id: nextId });
}