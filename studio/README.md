# EPHEC Content Studio

Espace de production éditoriale pour la communication de l'EPHEC : **cycles**, **sessions**, **publications** et leurs **fichiers**, organisés dans un board visuel.

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix · dnd-kit · Motion · Lucide
- Supabase Auth + PostgreSQL (RLS) + Storage privé — ou, en développement, PGlite + disque local

## Démarrage local

```bash
npm install
```

```bash
npm run dev
```

Ouvrez http://localhost:3100. Sans configuration Supabase, l'application tourne en **mode local** : base PGlite et fichiers dans `./data`, identifiants affichés sur la page de connexion (`studio@ephec.local` / `Studio-EPHEC-2026!`). Le board vide propose « Charger un exemple ».

## Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

- `npm test` : fuseau Europe/Bruxelles et changements d'heure, recherche combinée, intégrité du schéma (session d'un autre cycle refusée, « Programmé » sans date refusé).
- `npm run test:e2e` : démarre un serveur de production sur une base vierge et joue les scénarios A, B, C, D, F, G, H dans Chromium (19 vérifications). Le scénario E (rétroplanning) relève de la phase 2.

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Supabase (région UE), Vercel, variables, migrations, sauvegardes |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Parcours, composants, modèle de données, sécurité, décisions |
| [docs/ETAT.md](docs/ETAT.md) | Ce qui est livré, ce qui ne l'est pas encore, limites connues |
| [.env.example](.env.example) | Variables d'environnement |
