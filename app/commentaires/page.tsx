// app/commentaires/page.tsx — ⚠️ XSS encore présent — à corriger plus tard
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
          <span dangerouslySetInnerHTML={{ __html: c.html }} />
        </div>
      ))}
    </main>
  );
}