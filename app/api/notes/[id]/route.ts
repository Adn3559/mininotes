// app/api/notes/[id]/route.ts — ✅ CORRIGÉ : IDOR (vérification de propriété côté serveur)
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionId = req.cookies.get("mininotes_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();

  // ✅ CORRECTIF : on filtre AUSSI sur userId — la note doit appartenir au user connecté
  const rows = db("SELECT * FROM notes WHERE id = ? AND userId = ?", [
    Number(id),
    Number(sessionId),
  ]);

  if (!rows.length) {
    // 404 volontairement neutre : on ne dit pas "cette note existe mais n'est pas à toi"
    return NextResponse.json({ error: "Note introuvable" }, { status: 404 });
  }

  return NextResponse.json({ note: rows[0] });
}