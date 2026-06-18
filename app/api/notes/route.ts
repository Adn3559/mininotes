// app/api/notes/route.ts — ⚠️ FAILLES restantes (SQLi, validation, CSRF) — à corriger plus tard
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";

export const runtime = "nodejs";

// GET /api/notes → "mes" notes (celles du user connecté)
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const db = await getDb();

  // ⚠️ FAILLE encore présente : sessionId COLLÉ dans la requête → corrigée à l'étape suivante
  const sql = `SELECT * FROM notes WHERE userId = ${sessionId}`;
  console.log("🔎 SQL exécuté :", sql);

  const rows = db(sql);
  return NextResponse.json({ notes: rows });
}

// POST /api/notes → créer une note
export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const { titre, contenu } = await req.json();
  const db = await getDb();

  const nextId =
    (db("SELECT MAX(id) AS m FROM notes")[0] as { m: number }).m + 1;

  // ⚠️ FAILLE encore présente : titre/contenu collés → corrigée à l'étape suivante
  const sql = `INSERT INTO notes VALUES (${nextId}, ${sessionId}, '${titre}', '${contenu}')`;
  console.log("🔎 SQL exécuté :", sql);
  db(sql);

  return NextResponse.json({ message: "Note créée", id: nextId });
}