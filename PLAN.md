# ProxySmith — Plan d'implémentation MVP

Créer une carte proxy Magic: The Gathering à partir de son nom, sans réutiliser l'artwork officiel :
l'utilisateur importe une illustration personnelle (génération IA prévue en v1.1), puis imprime sa carte.

---

## 1. Périmètre du MVP

**Inclus**

- Recherche d'une carte par nom (français ou anglais), avec autocomplétion.
- Remplissage automatique : nom imprimé, coût de mana, type, texte oracle, force/endurance ou loyauté.
- Aucun artwork officiel récupéré ou affiché.
- Ajout d'une illustration par upload (drag & drop, recadrage/zoom).
- Aperçu carte en temps réel, 3 templates originaux (Signature clair/sombre, 1993 old school, 2026 moderne).
- Export PNG 300 DPI + PDF A4 prêt à imprimer (planche de 9 cartes avec traits de coupe).
- 100 % local : pas de compte, pas de base de données serveur.

**Exclu de la v1** (backlog)

- Import de deck / création en lot.
- Cartes double-face, planeswalkers multi-faces, cartes à layout spécial.
- Effets foil, textures avancées, éditeur libre de template.
- Synchronisation cloud, partage communautaire, impression directe.
- Application mobile.
- **Génération d'illustration IA** → reportée en v1.1. L'interface `ArtProvider` est conservée dans
  l'architecture pour brancher un provider (cloud ou ComfyUI local) sans refonte.

**Critères d'acceptation**

1. Je tape « foudre » → je sélectionne « Foudre » → tous les champs sont remplis correctement.
2. La carte s'affiche sans illustration officielle ; je peux uploader une image et la recadrer.
3. Je peux recadrer mon illustration (zoom, position) et la voir dans l'aperçu.
4. J'exporte un PNG 750 × 1050 px à 300 DPI et, à terme, un PDF A4 de 9 cartes imprimable à l'échelle 100 %.
5. Le texte long (ex. carte à 10 lignes) reste lisible et contenu dans la boîte de texte.
6. La génération d'illustration est proposée en v1.1 sans modifier le reste du parcours.

---

## 2. Stack recommandée

**Web-first (PWA), emballage desktop ensuite**

| Brique | Choix | Pourquoi |
|---|---|---|
| UI | React 19 + TypeScript + Vite | Rapide, écosystème, build simple |
| Styles | Tailwind CSS + design tokens | Prototypage rapide |
| État | Zustand | Léger, adapté à un éditeur local |
| Données distantes | TanStack Query | Cache, retries, gestion 429 |
| Stockage local | IndexedDB (`idb`) | Proxies sauvegardées + cache cartes + images |
| Rendu carte | DOM/CSS à taille fixe + `html-to-image` | Itération rapide, export 300 DPI |
| Export PDF | `pdf-lib` | Planches A4, traits de coupe, 100 % client |
| PWA | `vite-plugin-pwa` | Installable + offline partiel |
| Tests | Vitest + Playwright + snapshots visuels | Non-régression du rendu |
| Desktop (phase ultérieure) | Tauri 2 | Réutilise 100 % du front, binaire léger |

**Pourquoi web-first ici** : Node 22 est disponible, Rust/Cargo ne le sont pas encore. Le navigateur
gère nativement l'impression et les fichiers, et la PWA couvre le besoin « sur mon ordinateur ».
Tauri sera ajouté en phase 6 sans refonte (accès fichiers natif, raccourci bureau, keychain pour les clés API).
Alternative si Tauri pose problème : Electron. Alternative si un backend devient nécessaire : Next.js.

**Structure de repo envisagée**

```
proxysmith/
├── src/
│   ├── app/                 # routes, layout, thème
│   ├── features/
│   │   ├── search/          # barre de recherche + résultats
│   │   ├── card/            # éditeur, formulaire, aperçu
│   │   ├── art/             # upload, crop, génération
│   │   └── export/          # PNG, PDF, planche
│   ├── lib/
│   │   ├── scryfall/        # client API + normalisation
│   │   ├── render/          # mesures, auto-fit, templates
│   │   └── storage/         # IndexedDB
│   └── stores/
├── public/fonts/            # polices OFL embarquées
└── PLAN.md
```

---

## 3. Source de données : API Scryfall

**Choix : [Scryfall API](https://scryfall.com/docs/api)** — gratuite, sans clé, complète, maintenue,
avec données localisées (FR), symboles de mana et export bulk pour l'offline.

Endpoints utiles :

- `GET /cards/named?fuzzy=foudre&lang=fr` → recherche floue, renvoie `printed_name`.
- `GET /cards/search?q=foudre lang:fr&unique=cards` → liste de résultats pour l'autocomplétion.
- `GET /symbology` → table des symboles (alternative : police `mana-font`).
- `GET /bulk-data` → dump `oracle-cards` (~25 Mo gzip) pour une recherche offline (phase 2).

Contraintes à respecter :

- Headers obligatoires : `User-Agent: ProxySmith/0.1` et `Accept: application/json`.
- Limite : **2 requêtes/s** sur `/cards/named` et `/cards/search` → debounce 500 ms + cache 24 h.
- Gérer `404` (carte introuvable), `429` (backoff 30 s minimum), et les timeouts.
- Ne jamais relayer en masse les données Scryfall : l'app doit apporter de la valeur ajoutée.
- Ne pas utiliser les images de cartes Scryfall dans les proxies.

Modèle normalisé :

```ts
type CardData = {
  id: string;
  name: string;              // nom anglais
  printedName: string;       // nom localisé (fallback: name)
  manaCost: string;          // "{2}{R}"
  cmc: number;
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors: string[];
  colorIdentity: string[];
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  layout: string;
  lang: string;
  isFrontFaceOnly: boolean;  // double-face : v1 = face avant uniquement
};
```

Fallback : si Scryfall est indisponible, proposer la saisie manuelle des champs (déjà nécessaire
pour les cartes custom) — aucun blocage.

---

## 4. Rendu de la carte

**Spécifications d'impression**

- Format réel : 63 × 88 mm ; fichier d'impression 63,5 × 88,9 mm (2,5 × 3,5 in, 300 DPI).
- Zone de travail : 750 × 1050 px à 300 DPI (63,5 × 88,9 mm).
- Traits de coupe dans le PDF ; marges de sécurité ~4 mm.
- PDF A4 (210 × 297 mm) : grille 3 × 3 jointive, 9 cartes, traits de coupe dans les marges.
- Impression conseillée : 100 % / « taille réelle », papier 200–300 g, ou sleeve + carte réelle.

**Templates v1 (dessins originaux, aucun asset WotC)**

1. `signature` : design minimal actuel, variante claire (`minimal`) ou sombre (`dark`), accent coloré
   selon l'identité de couleur.
2. `classic` : inspiré des cartes de 1993 — cadre embossé (lumière haut/gauche, ombre bas/droite),
   plaque de titre en relief, fenêtre d'art en creux, parchemin texturé, or pour les multicolores,
   typographie Garamond et small caps.
3. `modern` : inspiré des cartes de 2026 — fond sombre, illustration pleine largeur, dégradé bicolore
   sur le titre, la ligne de type et la pastille de force/endurance.

Le template est sélectionnable dans l'éditeur et mémorisé dans `localStorage`. Les trois partagent
la même géométrie et le même auto-fit, et sont appliqués à l'identique à l'aperçu, au PNG et au PDF.

Le réglage **Couleur du cadre** (`proxysmith:accent`) permet d'imposer une couleur indépendamment de
l'identité de la carte : Auto, W, U, B, R, G, incolore ou or. En automatique, 1993 passe les cartes
multicolores en or et 2026 affiche un dégradé entre les deux couleurs de la carte.

Zones : titre, coût de mana, illustration, ligne de type, boîte de texte, force/endurance ou loyauté,
ligne de collection (`PROXY · set · numéro`). Mention « PROXY » activée par défaut (traçabilité,
évite toute confusion avec une carte officielle).

**Détails techniques**

- Symboles de mana : police OFL [`mana-font`](https://github.com/andrewgioia/mana) (glyphes © WotC,
  usage fan content) ou SVG locaux. Pas d'appel réseau au moment du rendu.
- Polices : uniquement des polices OFL (ex. Cinzel pour les titres, EB Garamond/Crimson Pro pour le texte).
  Ne pas embarquer Beleren/MPlantin (propriétaires).
- Auto-fit : mesure du conteneur + réduction progressive de la taille de police (texte oracle
  15–30 px, titre 20–42 px sur la zone de travail) jusqu'à ce que le contenu tienne ; jamais de
  débordement.
- Aperçu et export utilisent **le même composant** à la même résolution pour éviter les surprises.
- Rendu déterministe (pas de `vh/vw`, pas de dépendance à la taille de fenêtre).

---

## 5. Artwork (v1 : upload uniquement)

> Décision validée : la génération IA est reportée en v1.1. On garde dès maintenant l'interface
> `ArtProvider` et le prompt builder dans le code, mais l'UI n'expose que l'upload.

**Upload**

- Drag & drop ou sélecteur, formats PNG/JPG/WebP, limite ~20 Mo.
- Recadrage avec zoom/déplacement, ratio verrouillé sur la zone d'illustration.
- Stockage en data URL dans l'état pour la v0.1 ; migration IndexedDB prévue avec la persistance.
  L'image est embarquée dans le PNG exporté.

### Génération IA — v1.1 (non bloquante)

Interface unique, providers interchangeables :

```ts
interface ArtProvider {
  id: string;
  label: string;
  generate(input: { prompt: string; aspect: '2:3'; seed?: number }): Promise<Blob>;
}
```

- Providers possibles : OpenAI Images, Google Imagen, Replicate (Flux), fal.ai, ou ComfyUI local.
- Prompt construit depuis la carte, éditable par l'utilisateur :
  `"{nom}, {type}, {résumé du texte}, fantasy illustration, painted, no text, no watermark, full bleed, portrait 2:3"`.
- Presets de style : peinture fantasy, aquarelle, comics, sombre, rétro.
- Mode démo sans clé API : 2–3 illustrations placeholder pour tester le parcours.
- Clé API stockée localement avec avertissement ; en desktop, utiliser le keychain via Tauri.
- **Point d'attention CORS** : les appels navigateur directs vers certains providers sont bloqués.
  Prévoir soit un provider compatible CORS, soit un mini-proxy serverless (Cloudflare Worker) qui ne
  stocke aucune clé côté client, soit une commande Rust en mode Tauri.

---

## 6. Découpage et estimation (solo)

| Lot | Contenu | Durée | Statut |
|---|---|---|---|
| 0 | Scaffold Vite/React/TS/Tailwind, tokens | 0,5 j | ✅ |
| 1 | Client Scryfall, recherche debouncée, classement, cache, tests | 1 j | ✅ |
| 2 | Template de carte + mana-font + auto-fit + 3 designs | 2,5 j | ✅ |
| 3 | Formulaire d'édition synchronisé avec l'aperçu | 0,5 j | ✅ |
| 4 | Upload + recadrage d'illustration | 1 j | ✅ |
| 5 | Export PNG et PDF 9-up, traits de coupe, calibrage impression | 1 j | ✅ PNG + PDF livrés, test papier à faire |
| 6 | PWA, sauvegarde locale, tests E2E, README, disclaimer | 1 j | 🟡 README + smoke faits, PWA/persistance à faire |
| 7 | Emballage Tauri | 1–2 j | ⏳ |
| **Total** | **MVP upload + impression** | **~7 j** | |

Jalon démontrable dès le lot 2 : recherche → carte rendue sans artwork. ✅
Jalon « imprimable » dès le lot 5 : PNG 300 DPI et planche PDF A4 9-up validés. ✅
Test d'impression papier restant à faire.
Génération IA : +1,5 j en v1.1 (provider cloud ou ComfyUI local, mode démo, réglages clé API).

---

## 7. Risques et parades

| Risque | Parade |
|---|---|
| Droits : texte oracle, symboles, cadres | Usage personnel, app gratuite, cadres originaux, mention PROXY, disclaimer, pas d'images officielles |
| Scryfall 429 / indisponibilité | Debounce, cache 24 h, backoff, saisie manuelle en fallback, bulk data ensuite |
| CORS / fuite de clé API en web | Proxy serverless ou Tauri ; ne jamais committer de clé |
| Texte long illisible | Auto-fit + tests visuels sur cartes extrêmes (ex. « Dance of the Dead ») |
| Rendu écran ≠ impression | Même composant, export 300 DPI, test d'impression réel, traits de coupe |
| Polices propriétaires | Uniquement OFL ; vérifier les licences avant embarquement |
| Cartes double-face / layouts spéciaux | Détecter `card_faces`, v1 = face avant, message explicite |

**Note juridique** : les noms, textes et symboles Magic sont la propriété de Wizards of the Coast.
Le projet s'inscrit dans le cadre du Fan Content Policy, à but non commercial. Les proxies produits
sont destinés à un usage personnel (test, collection), ne doivent pas être vendus ni présentés comme
des cartes officielles. L'artwork généré reste soumis aux conditions du provider choisi.

---

## 8. Prochaines étapes

1. Scaffold du projet + écran de recherche (lot 0). ✅
2. Brancher Scryfall et afficher la première carte (lot 1). ✅
3. Upload d'illustration + aperçu des trois templates (lots 2–4). ✅
4. Faire un test d'impression réel de la planche PDF 9-up (lot 5).
5. PWA + persistance locale des proxies (lot 6).
6. Emballage Tauri (lot 7).
7. Génération d'illustration IA (v1.1).

### Décisions validées

- **Cible** : PWA web-first, puis Tauri 2 pour macOS/Windows/Linux.
- **Génération d'art** : upload uniquement en v1 ; génération IA reportée en v1.1 (interface prête).
- **Direction visuelle** : trois templates originaux (Signature clair/sombre, 1993, 2026), sans asset WotC.
- **Couleur de cadre** : automatique par identité, avec surcharge manuelle (WUBRG, incolore, or) mémorisée.
