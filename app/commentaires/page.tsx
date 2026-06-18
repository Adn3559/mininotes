// app/commentaires/page.tsx — ✅ CORRIGÉ : XSS stocké (affichage échappé par défaut de React)
import { getDb } from "@/lib/sqldb";

export const runtime = "nodejs";

export default async function CommentairesPage() {
  const db = await getDb();
  const comments = db("SELECT * FROM comments") as Array<{
    id: number;
    author: string;
    html: string;
  }>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Commentaires</h1>
      {comments.map((c) => (
        <div key={c.id} style={{ marginBottom: 12 }}>
          <b>{c.author} :</b>{" "}
          {/* ✅ CORRECTIF : affichage échappé via {c.html} au lieu de dangerouslySetInnerHTML */}
          {c.html}
        </div>
      ))}
    </main>
  );
}