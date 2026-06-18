// lib/config.ts — ✅ CORRIGÉ : secret lu depuis les variables d'environnement
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET manquant dans .env.local");
}

export const SESSION_SECRET = process.env.SESSION_SECRET;
export const APP_NAME = "MiniNotes";