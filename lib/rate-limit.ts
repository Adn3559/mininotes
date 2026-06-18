// lib/rate-limit.ts — limiteur de tentatives en mémoire (labo)
const tentatives = new Map<string, { count: number; resetAt: number }>();

const MAX_TENTATIVES = 5;
const FENETRE_MS = 60_000; // 1 minute

export function verifierRateLimit(ip: string): { bloque: boolean; restant: number } {
  const maintenant = Date.now();
  const entree = tentatives.get(ip);

  if (!entree || maintenant > entree.resetAt) {
    // première tentative ou fenêtre expirée → on repart à zéro
    tentatives.set(ip, { count: 1, resetAt: maintenant + FENETRE_MS });
    return { bloque: false, restant: MAX_TENTATIVES - 1 };
  }

  if (entree.count >= MAX_TENTATIVES) {
    return { bloque: true, restant: 0 };
  }

  entree.count++;
  return { bloque: false, restant: MAX_TENTATIVES - entree.count };
}

export function reinitialiserRateLimit(ip: string) {
  tentatives.delete(ip);
}