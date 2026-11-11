# ProxySmith

Créez des proxies **Magic: The Gathering** à partir du nom d'une carte, avec **votre propre
illustration** — aucun artwork officiel n'est récupéré ni affiché.

> État actuel : MVP local (recherche, édition, upload d'illustration, export PNG 300 DPI et
> planche PDF A4 9-up). Voir [`PLAN.md`](./PLAN.md) pour la feuille de route complète.

## Fonctionnalités

- Recherche d'une carte par nom, en français ou en anglais, via l'API Scryfall.
- Remplissage automatique : nom imprimé, coût de mana, ligne de type, texte oracle, force/endurance, loyauté.
- Reclassement local des résultats (correspondance exacte, puis préfixe, puis contenu).
- Trois templates originaux, inspirés des layouts officiels sans reprendre leurs assets :
  - **Signature** (clair ou sombre) : design minimal et contemporain.
  - **1993** : old school, cadre embossé, parchemin texturé et typographie Garamond.
  - **2026** : plein cadre sombre, illustration bord à bord, dégradé bicolore et P/T en pastille.
- Couleur de cadre libre (Auto, WUBRG, incolore, or), indépendante de l'identité de la carte.
- Accent de couleur adapté à l'identité de la carte sur les trois templates.
- Symboles de mana rendus avec la police `mana-font`.
- Champs entièrement éditables.
- Import d'illustration (PNG/JPG/WebP, 20 Mo max) avec zoom et recadrage.
- Export **PNG 750 × 1050 px à 300 DPI** (63,5 × 88,9 mm, coins arrondis), marqué `PROXY`.
- Export **PDF A4 9-up** : 9 exemplaires, traits de coupe, à imprimer à 100 %.
- Illustration composée directement sur le canvas d'export : le rendu est identique à l'aperçu,
  y compris avec zoom et décalage.
- 100 % local : aucun compte, aucune donnée envoyée à un serveur autre que Scryfall.

## Démarrage

Prérequis : Node.js 22+ (`.nvmrc` fourni ; `nvm use` pour aligner la version locale).

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173).

```bash
npm run build      # typecheck + build de production
npm run typecheck  # TypeScript uniquement
npm test           # tests unitaires (Vitest)
npm run smoke      # parcours E2E Playwright (serveur dev requis)
```

Le script `npm run smoke` utilise Chrome installé sur la machine, génère des captures dans
`tmp/`, et vérifie le classement de recherche, l'auto-fit du texte (dont une carte à texte long sur
les trois templates), les symboles de mana (dont `{T}`), les variantes Signature, le dégradé
bicolore 2026, le relief et le parchemin 1993, la couleur de cadre imposée, l'upload d'art, la
présence de l'illustration dans l'export, le PNG 300 DPI et la planche PDF A4. Il nécessite que
`npm run dev` tourne déjà.

## Templates de carte

Le sélecteur **Design de carte** du panneau de droite propose trois rendus, appliqués à l'identique
à l'aperçu, au PNG et au PDF. Le choix est mémorisé dans `localStorage` (`proxysmith:template`).

| Template | Style | Particularités |
|---|---|---|
| **Signature** | Minimal, clair ou sombre | Cadre fin, accent coloré, variante sombre mémorisée |
| **1993** | Old school | Cadre embossé (lumière haut/gauche, ombre bas/droite), plaque de titre en relief, fenêtre d'art en creux, parchemin texturé, or pour les multicolores, Garamond et small caps |
| **2026** | Contemporain | Fond sombre, illustration pleine largeur, dégradé bicolore sur le titre, le type et la pastille P/T |

Les trois respectent la même géométrie : carte 750 × 1050 px, zones titre / illustration / type /
texte / bas sans chevauchement, et auto-fit du texte oracle.

### Couleur du cadre

Le réglage **Couleur du cadre** permet de sortir de l'identité de la carte : **Automatique**,
Blanc, Bleu, Noir, Rouge, Vert, Incolore ou Or. Le choix s'applique aux trois templates et est
mémorisé dans `localStorage` (`proxysmith:accent`).

- En automatique, les cartes monocolores reprennent leur couleur ; les multicolores utilisent l'or
  sur le template 1993.
- Sur le template 2026, une carte bicolore en automatique affiche un vrai dégradé entre ses deux
  couleurs (titre, liseré, bandeau de type, pastille P/T).
- Une couleur imposée reste monochrome sur les trois templates.

## Stack

| Brique | Choix |
|---|---|
| UI | React 19 + TypeScript + Vite |
| Styles | Tailwind CSS 4 |
| État | Zustand |
| Recherche / cache | TanStack Query |
| Rendu carte | DOM/CSS à taille fixe |
| Export | `html-to-image` + canvas + `pdf-lib` |
| Symboles | `mana-font` |
| Polices | Cinzel + EB Garamond (`@fontsource`, licence OFL) |
| Tests | Vitest + Playwright |

Le rendu de la carte est un composant DOM de **750 × 1050 px** (échelle 1:1, 300 DPI), simplement
réduit visuellement dans l'aperçu. L'export rend ce même nœud sans transformation, puis compose
l'illustration sur un canvas avec les mêmes paramètres de cadrage : le résultat est identique à
l'écran et l'image est toujours présente, quel que soit le navigateur.

## Données et API

L'API [Scryfall](https://scryfall.com/docs/api) est gratuite et ne nécessite pas de clé.

```http
GET https://api.scryfall.com/cards/search?q=foudre+lang:fr&unique=cards&order=name
Accept: application/json
```

- Les recherches sont temporisées (450 ms) et espacées d'au moins 500 ms côté client.
- Les résultats français sont privilégiés, avec repli sur toutes les langues.
- En navigateur, on ne définit pas `User-Agent` (interdit par `fetch`) ; Scryfall demande de conserver
  celui du navigateur.
- Un cache TanStack Query de 24 h limite les appels.

## Limites connues (v0.1)

- La ligne de type utilise en priorité `printed_type_line` localisé par Scryfall, avec repli sur la
  version anglaise ; elle est modifiable dans l'éditeur.
- Le PDF 9-up n'a pas encore été validé par un test d'impression réel sur papier.
- Génération d'illustration IA reportée en v1.1.
- Cartes double-face : seule la face avant est utilisée.
- Pas de persistance entre les rechargements (hors préférences de template, variante et couleur de cadre).
- Emballage Tauri (macOS/Windows/Linux) pas encore ajouté.

## Structure

```
src/
├── components/      # recherche, aperçu, éditeur, upload
├── hooks/           # debounce
├── lib/             # client Scryfall, mana, export
├── store/           # état Zustand
├── App.tsx
├── index.css        # thème + rendu de la carte
└── main.tsx
scripts/smoke.mjs    # parcours E2E Playwright
public/favicon.svg
PLAN.md              # plan d'implémentation et roadmap
```

## Contribuer

Le projet suit Gitflow : `master` (production), `develop` (intégration), et des branches
`feature/<sujet>` ou `bugfix/<sujet>` créées depuis `develop`. Toute modification passe par une pull
request vers `develop` (ou vers `master` pour `release/*` et `hotfix/*`), avec la CI verte
(`typecheck`, tests, build).

Le contrôle des noms de branche et des messages de commit est **non bloquant** : le workflow
`Conventions` produit des avertissements, mais ne peut pas empêcher une fusion. Les tests de fumée
Playwright (`npm run smoke`) et Lighthouse restent locaux car ils nécessitent un navigateur et un
serveur.

Le modèle de PR, les workflows et la checklist des réglages GitHub à appliquer manuellement sont
dans [`.github/`](./.github/). Les conventions de commit (gitmoji + Conventional Commits), de
vérification et de fusion (`--no-ff`) sont détaillées dans [`AGENTS.md`](./AGENTS.md).

## Impression

- Imprimer à **100 %** (« taille réelle »), sans ajustement automatique.
- Papier 200–300 g recommandé, ou glisser le proxy dans une sleeve avec une carte réelle derrière.
- Le PNG fait 750 × 1050 px pour 63,5 × 88,9 mm, avec coins arrondis.
- La planche PDF place 9 cartes jointives sur une A4, avec des traits de coupe dans les marges.
- Calibrer l'imprimante avec une première planche avant de lancer une série.

## Mention légale

Magic: The Gathering, ses noms de cartes, ses textes et ses symboles sont la propriété de Wizards of
the Coast. Ce projet est un outil personnel, non officiel et non commercial, destiné à créer des
proxies pour tester ou collectionner. Ne vendez pas les cartes produites et ne les présentez pas
comme des cartes officielles. Les polices Cinzel et EB Garamond sont sous licence OFL ; la police
`mana-font` est sous OFL, ses glyphes de mana restant des marques de Wizards of the Coast.
