# 🛡️ MiniNotes — Labo de sécurité applicative

MiniNotes est une application de prise de notes fictive construite volontairement avec des failles de sécurité, dans le cadre d'une formation **OWASP & Secure Coding**. Le projet illustre un cycle complet : **construire une app vulnérable → l'exploiter comme un attaquant → l'auditer avec des outils → corriger chaque faille à la racine → automatiser la détection en CI/CD.**

> ⚠️ **Usage strictement pédagogique.** Cette application contient (ou a contenu) des vulnérabilités intentionnelles. Elle ne doit jamais être déployée en production ni exposée publiquement.

## Stack technique

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **alasql** — moteur SQL en mémoire, 100 % JavaScript (zéro compilation native, adapté à WSL)
- **bcryptjs** — hachage des mots de passe
- **Zod** — validation des entrées
- **ESLint** (+ `eslint-plugin-security`, `eslint-plugin-react`), **Semgrep**, règle maison `regles/sqli.yml` — analyse statique

## Démarrage

```bash
cp .env.example .env.local
# Remplir SESSION_SECRET dans .env.local
npm install
npm run dev
```

L'application est servie sur [http://localhost:3000](http://localhost:3000).

### Routes disponibles

| Route | Méthode | Description |
|---|---|---|
| `/api/login` | POST | Authentification |
| `/api/notes` | GET | Lister ses notes |
| `/api/notes` | POST | Créer une note |
| `/api/notes/[id]` | GET | Lire une note (contrôle d'accès) |
| `/api/profil` | GET | Obtenir un jeton anti-CSRF |
| `/api/profil` | POST | Changer son email (protégé CSRF) |
| `/commentaires` | GET | Page publique de commentaires |

---

## 📅 Démarche du labo

### Étape 1 — Construire puis exploiter (état initial vulnérable)

Construction de MiniNotes avec 13 failles volontaires couvrant les principales catégories OWASP Top 10 : injection SQL, mots de passe en clair, IDOR, XSS stocké, secret commité, cookie non-httpOnly, CSRF, fuite de données, message d'erreur bavard, absence de validation et de rate limiting.

Exploitation réalisée en conditions réelles : bypass de login par injection SQL (`' --`), lecture de notes privées par IDOR, exécution de script XSS stocké, brute force sans limite de tentatives.

### Étape 2 — Audit automatique

Passage de l'application au crible de trois familles d'outils :

| Outil | Détecte | Angle mort |
|---|---|---|
| `npm audit --audit-level=high` | CVE connues dans les dépendances | Aveugle au code applicatif |
| ESLint + plugins sécurité | Patterns dangereux ciblés | Pas d'analyse de flux de données |
| Semgrep `--config auto` | Analyse de flux (SAST) | Ne reconnaît pas alasql comme sink SQL |

**Leçon retenue :** 0 alerte ≠ 0 faille. Les trois outils automatiques donnent un résultat "propre" alors que trois failles critiques/élevées ont été confirmées par attaque réelle. La revue humaine reste indispensable.

### Étape 3 — Corriger à la racine

Application de **11 correctifs**, chacun validé par la méthode AVANT/APRÈS puis vérifié en rejouant l'attaque (qui doit échouer) tout en confirmant que l'usage normal fonctionne toujours (non-régression).

| # | Faille | OWASP | Gravité | Correctif |
|---|---|---|---|---|
| A | Injection SQL (login) | A03 | Critique | Requêtes paramétrées (`?`) |
| B | Mots de passe en clair | A02 | Élevé | Hachage **bcrypt** (cost=10) |
| C | Fuite de données + message bavard | A01/A02 | Moyen | Réponse minimale + message neutre |
| D | IDOR sur les notes | A01 | Élevé | Vérification de propriété (`AND userId = ?`) |
| E | XSS stocké | A03 | Élevé | Suppression de `dangerouslySetInnerHTML` |
| F | Cookie non-httpOnly | A05/A07 | Moyen | `httpOnly:true` + `Secure` + `SameSite:lax` |
| G | CSRF sur le profil | A01 | Moyen | Jeton anti-CSRF (*double-submit cookie*) |
| H | Injection SQL (notes) | A03 | Critique | Requêtes paramétrées sur GET et POST |
| I | Secret commité dans Git | A05 | Élevé | Variable d'environnement (`.env.local`) |
| J | Absence de validation | A03/A04 | Faible | **Zod** (`safeParse`) → 400 si données invalides |
| K | Absence de rate limiting | A07 | Moyen | Limiteur en mémoire (5 tentatives / minute / IP) |

> En production, plusieurs de ces parades se délègueraient à la plateforme : Row Level Security côté base de données pour le contrôle d'accès, un store partagé (Redis/Upstash) pour le rate limiting, HTTPS systématique via l'hébergeur.

### Étape 4 — Durcissement HTTP + Dependabot

Ajout des en-têtes de sécurité dans `next.config.ts` (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`) et mise en place de Dependabot pour la veille hebdomadaire des dépendances npm et des actions GitHub.

### Étape 5 — Pipeline CI/CD bloquant

Mise en place d'un workflow GitHub Actions (`.github/workflows/security.yml`) avec deux jobs en parallèle : **ESLint + npm audit** et **Semgrep (SAST)** avec règle maison ciblant les injections SQL via alasql. Branch protection sur `main` : les deux checks doivent être verts avant tout merge, push direct refusé même pour le mainteneur.

**Démo de blocage :** réintroduction volontaire d'une injection SQL sur une branche dédiée → PR #5 créée → check Semgrep rouge → merge bloqué. Preuve que le pipeline fonctionne comme garde-fou automatique.

---

## 🧠 Ce que ce projet illustre

Malgré la diversité des failles couvertes, les correctifs reposent sur une poignée de principes réutilisables :

- **Séparer le code et les données** : jamais de SQL construit par concaténation, jamais de HTML utilisateur injecté brut.
- **Valider** toute entrée côté serveur avant de la traiter (Zod, garde-frontière).
- **Vérifier les droits côté serveur**, jamais côté client, et sur chaque requête.
- **Moindre privilège** : ne renvoyer que les données strictement nécessaires.
- **Secure by default** : un cookie non sécurisé, une erreur trop bavarde ou un endpoint sans limite de débit sont des choix — la sécurité doit être l'option par défaut.
- **Automatiser la détection** : un correctif sans CI qui le vérifie peut régresser silencieusement.

## 📂 Structure du projet

```
mininotes/
├── app/
│   ├── api/
│   │   ├── login/          → authentification
│   │   ├── notes/          → CRUD notes (contrôle d'accès + validation)
│   │   ├── notes/[id]/     → lecture d'une note (anti-IDOR)
│   │   └── profil/         → mise à jour profil (protection CSRF)
│   └── commentaires/       → page publique (XSS corrigé)
├── lib/
│   ├── sqldb.ts            → moteur SQL en mémoire (alasql) + seed
│   ├── config.ts           → configuration (secret via .env.local)
│   ├── rate-limit.ts       → limiteur de tentatives en mémoire
├── regles/
│   └── sqli.yml            → règle Semgrep maison (détection SQLi alasql)
├── next.config.ts          → en-têtes de sécurité HTTP
├── eslint.config.mjs       → configuration ESLint (flat config)
├── .env.example            → modèle de configuration (commité, sans valeurs)
├── RAPPORT.md              → rapport de sécurité complet
└── .github/
    ├── dependabot.yml      → veille hebdomadaire npm + github-actions
    └── workflows/
        └── security.yml    → pipeline bloquant : ESLint + npm audit + Semgrep
```

---

## 📌 Avancement

- [x] Étape 1 — Construction de l'application vulnérable + exploitation des failles
- [x] Étape 2 — Audit automatique (npm audit, ESLint, Semgrep)
- [x] Étape 3 — Correction des 11 failles (avec preuves avant/après)
- [x] Étape 4 — Durcissement (en-têtes HTTP + Dependabot)
- [x] Étape 5 — Pipeline CI/CD bloquant + branch protection + démo de blocage

---

*Projet réalisé dans le cadre d'une formation en sécurité applicative (OWASP & Secure Coding) — Sandrine MERITEL, juin 2026. Toute vulnérabilité présente dans l'historique Git est intentionnelle et documentée à des fins pédagogiques.*
