// app/api/notes/route.ts — ✅ CORRIGÉ : validation Zod + requêtes paramétrées
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";
import { z } from "zod";

export const runtime = "nodejs";

// ✅ schéma de validation : titre obligatoire (1-100 chars), contenu obligatoire (1-1000 chars)
const NoteSchema = z.object({
  titre: z.string().min(1).max(100),
  contenu: z.string().min(1).max(1000),
});

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const db = await getDb();
  const rows = db("SELECT * FROM notes WHERE userId = ?", [Number(sessionId)]);
  return NextResponse.json({ notes: rows });
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  // ✅ CORRECTIF : validation stricte avant tout traitement
  const body = await req.json();
  const result = NoteSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Données invalides", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { titre, contenu } = result.data;
  const db = await getDb();
  const nextId =
    (db("SELECT MAX(id) AS m FROM notes")[0] as { m: number }).m + 1;
  db("INSERT INTO notes VALUES (?,?,?,?)", [nextId, Number(sessionId), titre, contenu]);

  return NextResponse.json({ message: "Note créée", id: nextId });
}