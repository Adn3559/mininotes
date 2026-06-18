# Rapport de sécurité — MiniNotes

**Auteure :** Sandrine MERITEL  
**Date :** juin 2026  
**Dépôt :** https://github.com/Adn3559/mininotes  
**Option choisie :** B — MiniNotes (application inconnue)

---

## 1. Périmètre & Méthode

### Application auditée
MiniNotes est une application de prise de notes fictive construite avec Next.js 16 + TypeScript + alasql (moteur SQL en mémoire). Elle expose 5 routes API et une page publique de commentaires.

### Méthode d'audit

| Outil | Famille | Résultat | Limite observée |
|---|---|---|---|
| ESLint + plugins security/react/next | SAST léger | 0 problème | Ne détecte pas l'injection SQL par template literal |
| npm audit --audit-level=high | SCA | Propre (0 high/critical) | 2 vulnérabilités modérées postcss/next, non corrigeables sans downgrade Next.js |
| Semgrep --config auto | SAST | 0 finding / 213 règles | alasql absent du ruleset communautaire |
| Revue manuelle + attaques curl | Manuel | 13 failles détectées | — |

**Q0.1 :** 0 alerte ne signifie pas 0 faille. Les trois outils automatiques donnent un résultat propre alors que trois failles critiques/élevées ont été confirmées par attaque réelle. ESLint ne fait pas de suivi de flux de données. npm audit n'analyse que les dépendances. Semgrep en mode auto ne reconnaît pas alasql comme sink SQL. La faille n'a été trouvée que par revue manuelle et attaque curl avec le payload ' --.

**Q0.2 :** Deux failles visibles à la seule lecture de lib/sqldb.ts et lib/config.ts :
- lib/sqldb.ts : mots de passe stockés en clair (faille A02)
- lib/config.ts : SESSION_SECRET écrit en dur et commité dans Git (faille A05)

**Q0.3 :** 13 failles recensées — 2 critiques, 5 élevées, 4 moyennes, 2 faibles.

---

## 2. Inventaire des failles (classé par gravité CVSS)

| # | Fichier | Faille | OWASP | Gravité |
|---|---|---|---|---|
| 1 | app/api/login/route.ts | Injection SQL (login) | A03 | Critique (9-10) |
| 2 | app/api/notes/route.ts | Injection SQL (notes GET+POST) | A03 | Critique (9-10) |
| 3 | lib/sqldb.ts | Mots de passe en clair | A02 | Élevé (7-8.9) |
| 4 | app/api/notes/[id]/route.ts | IDOR | A01 | Élevé (7-8.9) |
| 5 | app/commentaires/page.tsx | XSS stocké | A03 | Élevé (7-8.9) |
| 6 | lib/config.ts | Secret commité dans Git | A05 | Élevé (7-8.9) |
| 7 | app/api/login/route.ts | Cookie non-httpOnly | A05/A07 | Moyen (4-6.9) |
| 8 | app/api/login/route.ts | Absence de rate limiting | A07 | Moyen (4-6.9) |
| 9 | app/api/profil/route.ts | CSRF | A01 | Moyen (4-6.9) |
| 10 | app/api/login/route.ts | Fuite de données (password+role) | A01/A02 | Moyen (4-6.9) |
| 11 | app/api/notes/route.ts | Absence de validation Zod | A03/A04 | Faible (0.1-3.9) |
| 12 | app/api/login/route.ts | Message d'erreur bavard | A07 | Faible (0.1-3.9) |
| 13 | lib/config.ts | Secret commité (Faille L) | A05 | Élevé (7-8.9) |

---

## 3. Correctifs (avec preuves avant/après)

### Faille A — Injection SQL sur le login (A03 — Critique)

**Q : Le payload admin@mininotes.test' -- te connecte sans mot de passe. Pourquoi ? Corriges-tu le symptôme ou la cause ?**

La requête SQL était construite par concaténation de chaînes. Le ' suivi de -- fermait prématurément la chaîne SQL et transformait la vérification du mot de passe en commentaire. J'ai corrigé la cause racine via une requête paramétrée (WHERE email = ? AND password = ?), pas le symptôme (filtrer des caractères, contournable).

- AVANT : connexion admin sans mot de passe (200)
- APRÈS : {"error":"Email ou mot de passe invalide"} (401)
- Commit : fix: injection SQL sur le login (requete parametree)

---

### Faille B — Mots de passe en clair (A02 — Élevé)

**Q : Que se passe-t-il si la base fuite ? Comment stocker correctement et vérifier au login ?**

Si la base fuite, l'attaquant obtient tous les mots de passe sans effort. La solution : hacher avec bcrypt (fonction à sens unique, volontairement lente, sel intégré). Au seed : bcrypt.hash(motDePasse, 10). Au login : bcrypt.compare(saisi, hashStocké).

- AVANT : mots de passe en clair dans lib/sqldb.ts
- APRÈS : "password":"$2b$10$..." dans la réponse (hash bcrypt)
- Commit : fix: hachage bcrypt des mots de passe (getDb devient async)

---

### Faille C — Fuite de données + message bavard (A01/A02 — Moyen)

**Q : Deux problèmes dans les réponses du login. Lesquels, et leur parade ?**

1. La réponse renvoyait tout l'objet user (hash + rôle) — principe du moindre privilège violé.
2. Le message d'erreur mentionnait l'email saisi — énumération d'emails possible.

Parade : réponse minimale (id, email, role uniquement) + message neutre identique dans tous les cas d'échec.

- AVANT : réponse contient "password":"azerty123","role":"user"
- APRÈS : {"user":{"id":1,"email":"...","role":"user"}} — plus de hash ni fuite de rôle
- Commit : fix: reponse minimale + message neutre (anti-enumeration)

---

### Faille D — IDOR sur les notes (A01 — Élevé)

**Q : Alice (id=1) lit la note 3 (à l'admin). La requête est déjà paramétrée : où est la faille ? Cacher un bouton côté front suffirait-il ?**

Ce n'est pas une injection SQL mais un défaut de contrôle d'accès : la route ne vérifiait pas que la note appartient au user connecté. Cacher un bouton côté front ne protège rien — l'attaquant appelle l'API directement en curl. Le contrôle d'accès doit toujours se faire côté serveur.

- AVANT : Alice (cookie id=1) lit note id=3 → {"contenu":"le code du coffre est 4271"} (200)
- APRÈS : même requête → {"error":"Note introuvable"} (404)
- Commit : fix: IDOR sur notes/[id] (verification de propriete)

---

### Faille E — XSS stocké (A03 — Élevé)

**Q : Un commentaire <img src=x onerror=alert(1)> s'exécute chez tous les visiteurs. Quelle ligne est responsable, et quelle est la parade par défaut ?**

La ligne dangerouslySetInnerHTML={{ __html: c.html }} injecte du HTML brut utilisateur dans le DOM. React échappe automatiquement tout ce qui passe par { } — dangerouslySetInnerHTML désactive volontairement cette protection. Il suffit d'utiliser {c.html}.

- AVANT : popup JavaScript dans le navigateur
- APRÈS : texte affiché en clair, aucune popup
- Commit : fix: XSS stocke (affichage echappe au lieu de dangerouslySetInnerHTML)

---

### Faille F — Cookie de session non-httpOnly (A05/A07 — Moyen)

**Q : Le cookie mininotes_session est posé avec httpOnly:false. En quoi ça aggrave un XSS ? Quels attributs poser ?**

Avec httpOnly:false, le cookie est lisible par JavaScript via document.cookie — un XSS peut le voler et usurper la session. Avec httpOnly:true, le cookie est invisible pour JavaScript. On ajoute secure:true (HTTPS uniquement) et sameSite:"lax" (protection partielle contre CSRF).

- AVANT : set-cookie: mininotes_session=1; Path=/
- APRÈS : set-cookie: mininotes_session=1; Path=/; Secure; HttpOnly; SameSite=lax
- Commit : fix: cookie session httpOnly + Secure + SameSite=lax

---

### Faille G — CSRF sur le profil (A01 — Moyen)

**Q : Un site pirate peut changer l'email d'Alice sans qu'elle s'en rende compte. Comment, et quelle est la parade ?**

Le navigateur envoie automatiquement les cookies sur chaque requête, même depuis un site tiers. Un formulaire HTML pirate peut soumettre une requête avec le cookie d'Alice. Parade : double-submit cookie — jeton aléatoire généré côté serveur, exigé dans l'en-tête X-CSRF-Token. Un site tiers ne peut pas lire ce cookie (same-origin policy).

- AVANT : POST sans jeton → 200
- APRÈS : sans jeton → {"error":"Jeton CSRF invalide"} (403). Avec jeton → 200
- Commit : fix: protection CSRF par double-submit cookie (jeton X-CSRF-Token)

---

### Faille H — Injections SQL sur les notes (A03 — Critique)

**Q : Même cause, même remède que la Faille A ?**

Oui — même pattern (concaténation de chaînes), même correctif (requêtes paramétrées). Le vecteur est ici le cookie de session (GET) et le titre/contenu d'une note (POST). Multiplier les occurrences du même pattern illustre l'importance d'une revue systématique fichier par fichier.

- Commit : fix: injections SQL sur notes GET+POST (requetes parametrees)

---

### Faille I — Secret en dur commité dans Git (A05 — Élevé)

**Q : SESSION_SECRET est dans Git. Pourquoi c'est irréversible même après suppression ?**

Git conserve tout l'historique de façon immuable — même supprimé dans un commit suivant, le secret reste accessible via git log -p pour toujours. La seule réponse : considérer le secret comme compromis définitivement, le révoquer et le régénérer. Pour l'avenir : secrets uniquement dans .env.local (ignoré par .gitignore), .env.example commité avec valeurs fictives.

- Commit : fix: secret SESSION_SECRET deplace en variable d'environnement (.env.local)

---

### Faille J — Absence de validation des entrées (A03/A04 — Faible)

**Q : Sans validation, que peut-on envoyer dans titre/contenu ? Pourquoi Zod côté serveur ?**

Sans validation : titre vide, contenu de 10 000 caractères, champs manquants — tout accepté. Zod valide côté serveur (jamais côté client uniquement, contournable en curl) avec un schéma strict : titre obligatoire 1-100 chars, contenu 1-1000 chars.

- APRÈS : titre vide → {"error":"Données invalides","details":{...}} (400)
- Commit : fix: validation Zod sur POST /api/notes (titre et contenu obligatoires)

---

### Faille K — Absence de rate limiting (A07 — Moyen)

**Q : Sans limite de tentatives, comment brute-force-t-on le login ? Quelle parade simple en mémoire ?**

Sans rate limiting : des milliers de requêtes par seconde pour tester des mots de passe en masse. Parade en labo : compteur en mémoire par IP, 5 tentatives max par minute (lib/rate-limit.ts). En production : Redis/Upstash pour partager le compteur entre instances.

- APRÈS : tentatives 1-5 → 401. Tentative 6 → {"error":"Trop de tentatives, réessayez dans 1 minute"} (429)
- Commit : fix: rate limiting sur /api/login (5 tentatives par minute par IP)

---

### Faille L — Prévention des fuites futures de secrets (A05 — Élevé)

**Q : Comment prévenir toute fuite accidentelle future ?**

En plus de déplacer les secrets dans .env.local, on peut activer un pre-commit hook avec git-secrets ou truffleHog pour scanner automatiquement chaque commit avant sa création. Pour les secrets déjà fuités : les considérer comme compromis, les révoquer et régénérer immédiatement. Le fichier .env.example (commité avec valeurs fictives) documente les variables nécessaires sans exposer les vraies valeurs.

---

## 4. Durcissement

### En-têtes de sécurité HTTP (next.config.ts)

| En-tête | Protection |
|---|---|
| Content-Security-Policy | Limite les sources de ressources chargées |
| X-Frame-Options: DENY | Anti-clickjacking |
| X-Content-Type-Options: nosniff | Anti MIME-sniffing |
| Referrer-Policy: strict-origin-when-cross-origin | Limite les infos de provenance |
| Strict-Transport-Security | Force HTTPS (effet réel en production) |

### Dependabot (.github/dependabot.yml)

Veille hebdomadaire sur les dépendances npm et les actions GitHub. 4 PRs Dependabot ouvertes automatiquement dans les minutes suivant l'activation.

---

## 5. Pipeline CI/CD bloquant

**Q : Qu'est-ce qui empêche concrètement un développeur de merger du code vulnérable sur main ?**

Trois mécanismes combinés :

1. **Pipeline CI bloquant** (.github/workflows/security.yml) : deux jobs en parallèle à chaque push/PR vers main :
   - ESLint + npm audit : analyse statique + vulnérabilités de dépendances
   - Semgrep (SAST) : ruleset auto + règle maison regles/sqli.yml ciblant alasql

2. **Branch protection** : main exige les deux checks verts avant tout merge, enforce_admins:true — push direct refusé même pour le mainteneur.

3. **Dependabot** : surveille les dépendances en continu, ouvre des PRs qui passent elles aussi par la CI.

**Démo de blocage (PR #5) :** réintroduction volontaire de l'injection SQL sur demo/faille-reintroduite → PR ouverte → Semgrep rouge → merge bloqué. PR fermée et branche supprimée après démo.

---

## 6. Tests d'attaque finaux (après correctifs)

| Attaque | AVANT | APRÈS |
|---|---|---|
| Injection SQL login (admin' --) | 200 + connexion admin | 401 + message neutre |
| IDOR (Alice lit note admin id=3) | 200 + contenu sensible | 404 Note introuvable |
| Brute force (6 tentatives) | 401 x6 (illimité) | 401 x5 puis 429 bloqué |

---

## 7. Limites & Points d'amélioration

- **alasql en mémoire** : données perdues à chaque redémarrage. En production : PostgreSQL avec Row Level Security.
- **Rate limiting en mémoire** : non partagé entre instances. En production : Redis/Upstash.
- **Cookie secure:false** : nécessaire pour les tests HTTP local. En production (HTTPS) : remettre secure:true.
- **Vulnérabilité postcss modérée** : non corrigée — correctif disponible impliquerait downgrade Next.js 16 → 9.3 (breaking change disproportionné).
- **Semgrep OSS** : 1859 règles Pro manquées. La règle maison regles/sqli.yml compense partiellement.
- **Secret dans l'historique Git** : SESSION_SECRET reste dans les anciens commits — à révoquer en production.
- **Bug ESLint/FlatCompat** : incompatibilité entre eslint-config-next et ESLint 9.39.x résolue en utilisant les exports flat natifs des plugins.

---

*Rapport réalisé dans le cadre d'une formation en sécurité applicative (OWASP & Secure Coding) — Sandrine MERITEL, juin 2026.*
