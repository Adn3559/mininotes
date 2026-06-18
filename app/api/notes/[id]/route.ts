// app/api/notes/[id]/route.ts — ⚠️ IDOR encore présent — à corriger plus tard
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/sqldb";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDb();

  const rows = db("SELECT * FROM notes WHERE id = ?", [Number(id)]);
  if (!rows.length) {
    return NextResponse.json({ error: "Note introuvable" }, { status: 404 });
  }

  // ⚠️ FAILLE encore présente (IDOR) : à corriger à l'étape suivante
  return NextResponse.json({ note: rows[0] });
}