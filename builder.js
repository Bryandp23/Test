// Espace « Je crée mon projet » : choix du type de projet, sélection des éléments du dico,
// options, puis génération d'un prompt complet qui demande à l'IA tout le code.

// Position par défaut des sections dans la page (du haut vers le bas).
const ORDER = {
  navbar: 10, hamburger: 11, dropdown: 12, search: 13, breadcrumb: 20,
  hero: 30, carousel: 32, cta: 40, card: 50, tabs: 52, pagination: 54,
  reviews: 60, pricing: 65, accordion: 70, booking: 75, form: 80, map: 82,
  newsletter: 90, footer: 100,
};
// Éléments qui ne sont pas une « bande » de la page mais s'affichent par-dessus ou dans un coin.
const EXTRA = new Set(["modal", "toast", "tooltip", "cookie", "fab", "backtotop", "chat", "drawer",
  "bottomnav", "bottomsheet", "spinner", "skeleton", "badge", "toggle"]);

// Les notions de base ne sont pas des sections : on les traduit en consignes techniques.
const TECH = {
  frontend: "Uniquement du front-end : aucune partie serveur.",
  backend: "Indique en commentaire, dans le code, chaque endroit où il faudra brancher le back-end (enregistrement des données, envoi d'emails).",
  database: "À la fin, propose une structure de base de données simple (tables et colonnes) pour les données du projet.",
  api: "Isole chaque appel d'API dans une fonction dédiée qui renvoie pour l'instant des données d'exemple.",
  responsive: "Soigne particulièrement le responsive : vérifie chaque section à 375 px, 768 px et 1280 px de large.",
  wireframe: "Avant le code, donne le plan de la page en texte (une ligne par section).",
  uxui: "Applique les bonnes pratiques UX : hiérarchie visuelle claire, une action principale bien visible, boutons assez grands pour le doigt.",
  cms: "Structure les contenus pour qu'ils soient faciles à reprendre ensuite dans un CMS comme WordPress.",
  seo: "SEO de base : balise title, meta description, un seul H1, hiérarchie H2/H3 logique, attribut alt sur chaque image.",
  https: "Aucune ressource chargée en http:// (uniquement https://).",
  domain: "À la fin, explique en 5 étapes maximum comment relier le projet à mon nom de domaine.",
  hosting: "À la fin, explique en 5 étapes maximum comment héberger gratuitement ce projet.",
  deploy: "À la fin, explique en 5 étapes maximum comment mettre le projet en ligne gratuitement (GitHub Pages ou Netlify).",
  bug: "Le code ne doit produire aucune erreur dans la console du navigateur.",
  webapp: "Rends le projet installable comme une application (PWA) : fichier manifest et service worker minimal.",
};
const TECH_WITH_TEXT = new Set(["database", "wireframe", "domain", "hosting", "deploy"]);

// Formulation adaptée au constructeur pour les fiches dont le prompt du dico est une question.
const BUILD_PROMPT = {
  palette: "Définis une palette cohérente avec le projet (couleur principale, secondaire, accent, gris, fond), centralisée dans des variables, avec un contraste suffisant pour le texte.",
  typo: "Associe 2 polices Google Fonts adaptées au style (une pour les titres, une pour le texte), avec une échelle de tailles claire et un interligne confortable.",
};
const promptOf = i => BUILD_PROMPT[i.id] || i.prompt;

const GROUPS = [
  ["section", "🧱 Sections (de haut en bas)", "Structure, de haut en bas"],
  ["extra", "🪟 Éléments complémentaires", "Éléments complémentaires (superposés, flottants ou intégrés)"],
  ["feature", "⚙️ Fonctionnalités", "Fonctionnalités"],
  ["page", "📄 Autres pages / écrans", "Autres pages ou écrans à créer"],
  ["design", "🎨 Design", "Design"],
  ["tech", "🛠️ Consignes techniques", "Consignes techniques supplémentaires"],
];
const TAGS = { section: "structure", extra: "complements", feature: "fonctionnalites", page: "pages", design: "design", tech: "consignes_techniques" };

const TECH_TEXT = {
  single: "HTML, CSS et JavaScript « vanilla » dans un seul fichier index.html (CSS dans <style>, JavaScript dans <script>), sans framework ni bibliothèque externe : je dois pouvoir l'ouvrir directement dans mon navigateur.",
  separate: "HTML, CSS et JavaScript « vanilla » en 3 fichiers séparés (index.html, style.css, script.js), sans framework ni bibliothèque externe.",
  react: "React (composants fonctionnels et hooks) avec Tailwind CSS, un composant par section, plus un composant App qui les assemble.",
  rn: "React Native avec Expo, un composant par section ou écran, prêt à tester sur téléphone avec l'application Expo Go.",
};
const TECH_LABEL = { single: "HTML/CSS/JS en 1 fichier", separate: "HTML/CSS/JS en 3 fichiers", react: "React + Tailwind", rn: "React Native (Expo)" };

// Les trois types de projets proposés à l'étape 1.
const KINDS = {
  site: {
    icon: "🌐", label: "Un site web", sub: "Site vitrine, boutique, blog, landing page…",
    role: "un développeur front-end et designer web expérimenté",
    objective: "une page web complète et fonctionnelle",
    types: { "un site vitrine": "Site vitrine", "une landing page": "Landing page", "une boutique en ligne": "Boutique en ligne", "un blog": "Blog", "un portfolio": "Portfolio" },
    techs: ["single", "separate", "react"],
    cats: ["nav", "content", "interact", "form", "feature", "feedback", "pages", "style", "layout", "anim", "bases", "mobile"],
    recipes: {
      "🏪 Site vitrine": ["navbar", "hamburger", "hero", "card", "reviews", "form", "map", "footer", "backtotop", "responsive", "seo"],
      "🎯 Landing page": ["navbar", "hero", "card", "reviews", "pricing", "accordion", "cta", "footer", "scrollreveal", "fold"],
      "🛍️ Boutique": ["navbar", "hamburger", "search", "badge", "carousel", "card", "pagination", "footer", "cookie", "productpage", "checkout", "payment"],
      "🍽️ Restaurant": ["navbar", "hamburger", "hero", "carousel", "tabs", "reviews", "booking", "map", "footer", "palette", "typo"],
    },
  },
  webapp: {
    icon: "💻", label: "Une application web", sub: "Outil en ligne, espace client, tableau de bord…",
    role: "un développeur front-end et designer UI expérimenté, spécialiste des applications web",
    objective: "l'interface complète et fonctionnelle (écran principal)",
    types: { "un outil en ligne": "Outil en ligne", "un espace client": "Espace client", "un tableau de bord de gestion": "Tableau de bord", "une plateforme de réservation": "Plateforme de réservation" },
    techs: ["single", "separate", "react"],
    cats: ["nav", "interact", "content", "form", "feedback", "feature", "pages", "style", "layout", "anim", "bases", "mobile"],
    recipes: {
      "📊 Tableau de bord": ["navbar", "search", "card", "tabs", "pagination", "drawer", "modal", "toast", "dashboard", "auth", "darkmode"],
      "📅 Prise de rendez-vous": ["navbar", "hamburger", "hero", "booking", "form", "footer", "toast", "auth", "account"],
      "🧑‍💼 Espace client": ["navbar", "breadcrumb", "tabs", "card", "form", "footer", "toast", "badge", "auth", "account"],
    },
  },
  mobile: {
    icon: "📱", label: "Une appli mobile", sub: "Application pour téléphone, installable",
    role: "un développeur d'applications mobiles et designer UI expérimenté",
    objective: "l'écran principal complet et fonctionnel",
    types: { "une application mobile installable (PWA)": "PWA (installable, sans store)", "une application mobile pour les stores": "Appli pour l'App Store / Google Play" },
    techs: ["single", "react", "rn"],
    cats: ["mobile", "nav", "interact", "content", "form", "feedback", "feature", "style", "anim", "layout", "bases", "pages"],
    recipes: {
      "📱 Appli de base": ["bottomnav", "fab", "bottomsheet", "onboarding", "pulltorefresh", "swipe", "push", "webapp"],
      "🛒 Appli de commande": ["bottomnav", "search", "card", "badge", "bottomsheet", "toast", "onboarding", "payment", "push"],
      "📝 Appli de notes": ["bottomnav", "search", "card", "fab", "swipe", "toast", "darkmode", "auth"],
    },
  },
};

// Ambiances proposées à l'étape 4 (valeur envoyée à l'IA → libellé, aperçu).
const STYLES = {
  "": ["✨ L'IA choisit", "conic-gradient(from 90deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)"],
  "moderne et épuré": ["Moderne", "linear-gradient(135deg, #ffffff 0 50%, #6366f1 50%)"],
  "chaleureux et convivial": ["Chaleureux", "linear-gradient(135deg, #fde68a, #f97316)"],
  "luxe et élégant": ["Luxe", "linear-gradient(135deg, #111 0 60%, #d4af37 60%)"],
  "coloré et ludique": ["Ludique", "linear-gradient(135deg, #f472b6, #facc15, #22d3ee)"],
  "professionnel et sobre": ["Pro & sobre", "linear-gradient(135deg, #1e3a8a, #64748b)"],
  "minimaliste": ["Minimaliste", "linear-gradient(135deg, #fafafa, #d4d4d8)"],
};
// Palettes toutes prêtes (texte envoyé à l'IA → couleurs d'aperçu).
const PALETTES = {
  "bleu nuit et blanc, accent orange": ["#1e3a8a", "#ffffff", "#f97316"],
  "vert sapin et crème": ["#14532d", "#fef3c7", "#a3e635"],
  "noir et doré": ["#0a0a0a", "#d4af37", "#f5f5f4"],
  "tons pastel (rose, lavande, menthe)": ["#fbcfe8", "#ddd6fe", "#bbf7d0"],
  "rouge vif et blanc": ["#dc2626", "#ffffff", "#1f2937"],
  "terracotta, beige et vert olive": ["#c2410c", "#f5f0e6", "#65a30d"],
};
const TARGETS = { claude: "Claude", chatgpt: "ChatGPT", other: "Autre IA" };
// Éléments les plus utiles en premier, selon le type de projet.
const ESSENTIALS = {
  site: ["navbar", "hamburger", "hero", "carousel", "card", "cta", "reviews", "accordion", "form", "map", "footer", "cookie"],
  webapp: ["navbar", "drawer", "dashboard", "card", "tabs", "search", "modal", "toast", "form", "auth", "account", "darkmode"],
  mobile: ["bottomnav", "fab", "onboarding", "card", "search", "bottomsheet", "swipe", "pulltorefresh", "toast", "push", "auth", "darkmode"],
};
const STEPS = ["Type", "Modèle", "Éléments", "Projet", "Prompt"];

const B = {
  sel: [],
  opt: { kind: "site", target: "claude", type: "un site vitrine", tech: "single", style: "", colors: "", ctx: "", content: "demo", missing: "choose", codeOnly: true },
};
const ui = { step: 1, q: "", cat: "ess" };

const byId = id => DICO.find(x => x.id === id);
const kind = () => KINDS[B.opt.kind] || KINDS.site;

function roleOf(i) {
  if (i.cat === "bases") return "tech";
  if (i.cat === "pages") return "page";
  if (["style", "anim", "layout"].includes(i.cat)) return "design";
  if (EXTRA.has(i.id)) return "extra";
  if (i.id in ORDER || ["nav", "content", "interact", "form"].includes(i.cat)) return "section";
  return "feature";
}
const orderOf = id => ORDER[id] ?? 50;

function saveB() {
  try { localStorage.setItem("dico-builder", JSON.stringify(B)); } catch (e) { /* stockage indisponible */ }
}
function loadB() {
  try {
    const s = JSON.parse(localStorage.getItem("dico-builder") || "null");
    if (s) { B.sel = (s.sel || []).filter(byId); Object.assign(B.opt, s.opt || {}); }
  } catch (e) { /* stockage indisponible */ }
  fixOptions();
}
// Garde le type et la technologie cohérents avec le type de projet choisi.
function fixOptions() {
  if (!KINDS[B.opt.kind]) B.opt.kind = "site";
  const k = kind();
  if (!(B.opt.type in k.types)) B.opt.type = Object.keys(k.types)[0];
  if (!k.techs.includes(B.opt.tech)) B.opt.tech = k.techs[0];
}

const isSel = id => B.sel.includes(id);

// Ajoute une section à sa place logique (le footer reste en bas, la navbar en haut…).
function addSel(id) {
  if (isSel(id)) return;
  if (roleOf(byId(id)) === "section") {
    const at = B.sel.findIndex(x => roleOf(byId(x)) === "section" && orderOf(x) > orderOf(id));
    if (at >= 0) { B.sel.splice(at, 0, id); return; }
  }
  B.sel.push(id);
}
function toggleSel(id) {
  isSel(id) ? B.sel.splice(B.sel.indexOf(id), 1) : addSel(id);
  selChanged();
}
function moveSel(id, dir) {
  const sections = B.sel.filter(x => roleOf(byId(x)) === "section");
  const other = sections[sections.indexOf(id) + dir];
  if (other === undefined) return;
  const a = B.sel.indexOf(id), b = B.sel.indexOf(other);
  [B.sel[a], B.sel[b]] = [B.sel[b], B.sel[a]];
}
function selChanged() {
  saveB();
  updateBadge();
  if ($("#picker")) { renderPicker(); renderSide(); }
  if ($("#wzStatus")) updateFoot();
}
function updateBadge() {
  const b = $("#navCount");
  b.textContent = B.sel.length;
  b.style.display = B.sel.length ? "inline-block" : "none";
}

function grouped() {
  const g = {};
  for (const id of B.sel) { const i = byId(id); (g[roleOf(i)] ||= []).push(i); }
  return g;
}

// ---------------------------------------------------------------- prompt
function generatePrompt() {
  const o = B.opt, k = kind(), g = grouped();
  if (!B.sel.length) return "Choisis au moins un élément (étape 3) pour générer le prompt.";
  const claude = o.target === "claude";
  const block = (tag, title, body) => claude ? `<${tag}>\n${body}\n</${tag}>` : `## ${title}\n${body}`;
  const parts = [];

  parts.push(block("role", "Rôle", `Tu es ${k.role}.`));
  parts.push(block("objectif", "Objectif",
    `Crée ${k.objective} : ${o.type}` + (o.ctx.trim() ? ` pour le projet suivant : ${o.ctx.trim()}` : ".") +
    `\nLe résultat doit contenir tous les éléments ci-dessous. La position des sections est donnée par l'ordre de la liste : elle prime sur les indications de position écrites dans les descriptions.`));

  for (const [key, , title] of GROUPS) {
    const items = g[key];
    if (!items) continue;
    let body = key === "section"
      ? items.map((i, n) => `${n + 1}. ${i.name} (${i.en}) : ${promptOf(i)}`).join("\n")
      : key === "tech"
        ? items.map(i => `- ${TECH[i.id] || promptOf(i)}`).join("\n")
        : items.map(i => `- ${i.name} (${i.en}) : ${promptOf(i)}`).join("\n");
    if (key === "design" && designHeader(o)) body = designHeader(o) + "\n" + body;
    parts.push(block(TAGS[key], title, body));
  }
  if (!g.design && designHeader(o)) parts.push(block("design", "Design", designHeader(o)));

  const native = o.tech === "rn";
  const constraints = [
    `- Technologie : ${TECH_TEXT[o.tech]}`,
    B.opt.kind === "mobile"
      ? "- Pensé pour le téléphone avant tout (écran de 375 px), utilisable d'une main, avec les gestes tactiles habituels."
      : "- Responsive « mobile first » : parfait sur téléphone, tablette et ordinateur.",
    native
      ? "- Accessible : libellés d'accessibilité, zones tactiles d'au moins 44 px, contrastes suffisants."
      : "- Accessible : HTML sémantique (header, nav, main, section, footer), navigation au clavier, contrastes suffisants.",
    "- Images : utilise https://picsum.photos (ex. https://picsum.photos/1200/600) avec une description alternative, faciles à remplacer.",
    o.content === "demo"
      ? "- Textes : rédige des textes d'exemple réalistes en français, adaptés au projet (pas de lorem ipsum)."
      : "- Textes : mets des textes provisoires repérables, au format [À COMPLÉTER : description], que je remplacerai.",
    `- Code propre, commenté par section, avec les couleurs centralisées (${native ? "fichier de thème" : o.tech === "react" ? "configuration Tailwind" : "variables CSS"}).`,
  ];
  parts.push(block("contraintes", "Contraintes", constraints.join("\n")));

  const needsText = (g.tech || []).some(i => TECH_WITH_TEXT.has(i.id));
  const fmt = [
    o.missing === "choose"
      ? "- S'il manque une information, fais un choix raisonnable sans me poser de questions, et liste tes hypothèses en 3 lignes maximum à la fin."
      : "- Avant d'écrire le code, pose-moi au maximum 3 questions essentielles, puis attends mes réponses.",
    "- Donne le code complet en entier : rien de tronqué, pas de « … reste du code ».",
    o.codeOnly
      ? (needsText
        ? "- Pas d'explication du code (je veux économiser des tokens). Les seuls textes hors du code sont ceux demandés dans les consignes, en version très courte."
        : "- Pas d'explication du code : uniquement le code (je veux économiser des tokens).")
      : "- Après le code, explique la structure en 10 lignes maximum.",
  ];
  parts.push(block("format_reponse", "Format de la réponse", fmt.join("\n")));
  return parts.join("\n\n");
}

function designHeader(o) {
  const l = [];
  if (o.style) l.push(`- Style général : ${o.style}.`);
  if (o.colors.trim()) l.push(`- Couleurs : ${o.colors.trim()}.`);
  return l.join("\n");
}


// ---------------------------------------------------------------- affichage (parcours guidé)
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

function renderCreate() {
  $("#createView").innerHTML = `
    <div class="wz">
      <ol class="stepper" id="stepper"></ol>
      <div id="wzBody" class="wz-body"></div>
    </div>
    <div class="wz-foot"><div class="wz-foot-in">
      <div class="wz-status" id="wzStatus"></div>
      <div class="wz-nav">
        <button class="btn ghost" id="wzBack">← Retour</button>
        <button class="btn primary" id="wzNext">Continuer →</button>
      </div>
    </div></div>`;
  renderStep();
}

function go(step) {
  ui.step = Math.max(1, Math.min(STEPS.length, step));
  renderStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStep() {
  $("#stepper").innerHTML = STEPS.map((t, n) => `
    <li class="${n + 1 === ui.step ? "on" : n + 1 < ui.step ? "done" : ""}"><button data-go="${n + 1}">
      <span class="dot">${n + 1 < ui.step ? "✓" : n + 1}</span><span class="st-txt">${t}</span></button></li>`).join("");
  const body = $("#wzBody");
  body.innerHTML = [, stepKind, stepRecipe, stepElements, stepProject, stepPrompt][ui.step]();
  body.classList.remove("enter"); void body.offsetWidth; body.classList.add("enter");
  if (ui.step === 3) { renderPicker(); renderSide(); }
  if (ui.step === 5) refreshOut();
  updateFoot();
}

function updateFoot() {
  const n = B.sel.length;
  $("#wzStatus").innerHTML = `<b>Étape ${ui.step}/${STEPS.length}</b><span>${kind().icon} ${kind().label} · ${plural(n, "élément")}</span>`;
  $("#wzBack").style.visibility = ui.step === 1 ? "hidden" : "visible";
  const next = $("#wzNext");
  next.disabled = ui.step === 3 && !n;
  next.textContent = ui.step === 4 ? "Voir mon prompt ✨" : ui.step === 5 ? "📋 Copier le prompt" : "Continuer →";
  next.title = next.disabled ? "Choisis au moins un élément" : "";
}

const head = (title, sub) => `<div class="wz-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;

// Étape 1 : type de projet
function stepKind() {
  return head("Que veux-tu créer ?", "Choisis le type de projet. Tu pourras changer d'avis à tout moment.") + `
    <div class="kinds">${Object.entries(KINDS).map(([k, d]) => `
      <button class="kind ${B.opt.kind === k ? "on" : ""}" data-kind="${k}">
        <span class="kind-i">${d.icon}</span>
        <b>${d.label}</b>
        <small>${d.sub}</small>
        <span class="kind-check">✓</span>
      </button>`).join("")}</div>
    <p class="hint-box">💡 <b>Pas sûr ?</b> Un <b>site web</b> présente quelque chose (une activité, des produits). Une <b>application web</b> sert à faire quelque chose (gérer, réserver, suivre). Une <b>appli mobile</b> s'utilise sur téléphone.</p>`;
}

// Étape 2 : modèle de départ
function stepRecipe() {
  const recipes = kind().recipes;
  return head("Pars d'un modèle", "Un modèle coche pour toi les éléments les plus courants. Tu pourras en ajouter ou en retirer juste après.") + `
    <div class="recipes-grid">${Object.entries(recipes).map(([r, ids]) => {
      const names = ids.filter(byId).map(id => byId(id).name);
      const [icon, ...title] = r.split(" ");
      return `<button class="recipe" data-recipe="${esc(r)}">
        <span class="recipe-i">${icon}</span><b>${title.join(" ")}</b>
        <small>${names.slice(0, 5).join(" · ")}${names.length > 5 ? ` · +${names.length - 5}` : ""}</small>
        <span class="recipe-go">Utiliser ce modèle →</span></button>`;
    }).join("")}
      <button class="recipe blank" data-recipe="">
        <span class="recipe-i">✏️</span><b>Je choisis moi-même</b>
        <small>${B.sel.length ? `Garder ma sélection actuelle (${plural(B.sel.length, "élément")})` : "Partir d'une page blanche"}</small>
        <span class="recipe-go">Continuer →</span></button>
    </div>`;
}

// Étape 3 : choix des éléments
function stepElements() {
  const cats = [["ess", "⭐ Les essentiels"], ...kind().cats.map(c => [c, `${CAT_ICON[c]} ${catName(c)}`])];
  return head("Coche ce que tu veux voir", "Reconnais les éléments grâce aux images. Un doute sur un mot ? Clique sur <b>ⓘ</b> pour lire son explication.") + `
    <div class="el-grid">
      <div>
        <div class="search sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="pq" type="search" placeholder="Cherche avec tes mots : « menu », « payer », « images qui défilent »…" value="${esc(ui.q)}" autocomplete="off">
        </div>
        <div class="cats" id="pcats">${cats.map(([k, v]) => `<button data-pcat="${k}" class="${ui.cat === k ? "on" : ""}">${v}</button>`).join("")}</div>
        <div id="picker"></div>
      </div>
      <aside class="el-side" id="side"></aside>
    </div>`;
}

function renderPicker() {
  const q = ui.q.trim();
  let items = q ? DICO.map(i => [i, score(i, q)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i)
    : ui.cat === "ess" ? ESSENTIALS[B.opt.kind].map(byId).filter(Boolean)
    : DICO.filter(i => i.cat === ui.cat);
  document.querySelectorAll("#pcats button").forEach(b => b.classList.toggle("on", !q && b.dataset.pcat === ui.cat));
  $("#picker").innerHTML = items.length ? `<div class="pk-grid">${items.map(i => `
    <div class="pk ${isSel(i.id) ? "on" : ""}" data-toggle="${i.id}" role="checkbox" aria-checked="${isSel(i.id)}" tabindex="0">
      <div class="pk-prev"><div class="pk-zoom">${i.visual}</div></div>
      <div class="pk-body"><b>${i.name}</b><small>${i.simple}</small></div>
      <span class="pk-box">✓</span>
      <button class="pk-info" data-info="${i.id}" title="Voir l'explication" aria-label="Voir l'explication">ⓘ</button>
    </div>`).join("")}</div>`
    : `<div class="empty">🤔 Rien trouvé pour « ${esc(q)} ». Essaie d'autres mots.</div>`;
}

function renderSide() {
  const side = $("#side");
  if (!side) return;
  const g = grouped();
  const sectionIds = (g.section || []).map(i => i.id);
  const rows = (g.section || []).map((i, pos) => `
    <div class="sp-row plan-${i.id}"><span>${i.name}</span><span class="b-btns">
      <button data-act="up" data-id="${i.id}" ${pos === 0 ? "disabled" : ""} title="Monter" aria-label="Monter">↑</button>
      <button data-act="down" data-id="${i.id}" ${pos === sectionIds.length - 1 ? "disabled" : ""} title="Descendre" aria-label="Descendre">↓</button>
      <button data-act="rm" data-id="${i.id}" title="Retirer" aria-label="Retirer">✕</button></span></div>`).join("");
  const extras = GROUPS.filter(([k]) => k !== "section" && g[k]).flatMap(([k]) => g[k]);
  side.innerHTML = `
    <div class="side-card">
      <div class="side-h"><b>🗺️ Ma page</b>${B.sel.length ? `<button class="link" data-act="clear">Tout retirer</button>` : ""}</div>
      ${B.sel.length ? `
        ${rows ? `<div class="sp">${rows}</div>` : ""}
        ${extras.length ? `<div class="label">En plus</div><div class="chips x">${extras.map(i => `<span>${i.name}<button data-act="rm" data-id="${i.id}" aria-label="Retirer">✕</button></span>`).join("")}</div>` : ""}
        <p class="desc small">Les sections sont rangées automatiquement de haut en bas. Utilise ↑ ↓ pour changer l'ordre.</p>`
      : `<div class="side-empty">👈 Coche des éléments :<br>ils apparaîtront ici, à leur place sur ta page.</div>`}
    </div>`;
}

// Étape 4 : le projet
function stepProject() {
  const k = kind(), o = B.opt;
  const chip = (key, val, label, extra = "") => `<button class="opt ${o[key] === val ? "on" : ""}" data-set="${key}" data-val="${esc(val)}">${extra}${label}</button>`;
  return head("Parle-nous de ton projet", "Plus l'IA a de contexte, plus le résultat te ressemblera. Seule la première question est vraiment importante.") + `
    <div class="q-card">
      <label class="q-title" for="ctx">1. C'est pour quoi ? <span class="req">Recommandé</span></label>
      <p class="q-help">Le nom, l'activité, la ville, pour qui… en une ou deux phrases.</p>
      <textarea id="ctx" data-opt="ctx" rows="3" placeholder="Ex. : Restaurant italien « Da Marco » à Lyon, cuisine familiale, pour les familles du quartier et les touristes.">${esc(o.ctx)}</textarea>
    </div>
    <div class="q-card">
      <div class="q-title">2. Quel genre de ${B.opt.kind === "site" ? "site" : "projet"} ?</div>
      <div class="opts">${Object.entries(k.types).map(([v, t]) => chip("type", v, t)).join("")}</div>
    </div>
    <div class="q-card">
      <div class="q-title">3. Quelle ambiance ?</div>
      <div class="opts">${Object.entries(STYLES).map(([v, [t, sw]]) => chip("style", v, t, `<span class="sw" style="background:${sw}"></span>`)).join("")}</div>
    </div>
    <div class="q-card">
      <div class="q-title">4. Quelles couleurs ?</div>
      <div class="opts">${chip("colors", "", "✨ L'IA choisit")}${Object.entries(PALETTES).map(([v, cols]) =>
        chip("colors", v, v.split(",")[0].replace(/\s*\(.*/, ""), `<span class="pal">${cols.map(c => `<i style="background:${c}"></i>`).join("")}</span>`)).join("")}</div>
      <input class="q-input" data-opt="colors" value="${o.colors in PALETTES ? "" : esc(o.colors)}" placeholder="Ou écris tes couleurs : « bleu ciel et jaune », « couleurs de mon logo : #123456 »…">
    </div>
    <div class="q-card">
      <div class="q-title">5. Quelle IA vas-tu utiliser ?</div>
      <div class="opts">${Object.entries(TARGETS).map(([v, t]) => chip("target", v, t)).join("")}</div>
    </div>
    <details class="q-card adv">
      <summary>⚙️ Options avancées <span>(facultatif, les réglages par défaut conviennent très bien)</span></summary>
      <div class="adv-grid">
        <div><div class="q-sub">Technologie</div><div class="opts">${k.techs.map(t => chip("tech", t, TECH_LABEL[t])).join("")}</div></div>
        <div><div class="q-sub">Textes du ${B.opt.kind === "site" ? "site" : "projet"}</div><div class="opts">${chip("content", "demo", "Rédigés par l'IA")}${chip("content", "mine", "Je mettrai les miens")}</div></div>
        <div><div class="q-sub">S'il manque une information</div><div class="opts">${chip("missing", "choose", "L'IA fait des choix")}${chip("missing", "ask", "L'IA me pose des questions")}</div></div>
        <div><div class="q-sub">Réponse de l'IA</div><div class="opts">${chip("codeOnly", true, "Le code seul (économise des tokens)")}${chip("codeOnly", false, "Le code + une courte explication")}</div></div>
      </div>
    </details>`;
}

// Étape 5 : le prompt final
function stepPrompt() {
  const g = grouped(), s = g.section || [];
  const t = generatePrompt();
  const ai = { claude: ["Claude", "https://claude.ai/new"], chatgpt: ["ChatGPT", "https://chatgpt.com"], other: ["ton IA", ""] }[B.opt.target];
  return `
    <div class="done-hero">
      <div class="done-i">🎉</div>
      <h1>Ton prompt est prêt !</h1>
      <p>${kind().icon} ${kind().label} · ${plural(B.sel.length, "élément")} · <span id="tok"></span></p>
      <button class="btn primary lg" id="cpAll">📋 Copier mon prompt</button>
    </div>
    <div class="use">
      <div class="use-step"><span class="how-num">1</span><div><b>Copie</b> le prompt avec le bouton ci-dessus.</div></div>
      <div class="use-step"><span class="how-num">2</span><div><b>Colle-le</b> dans ${ai[1] ? `<a href="${ai[1]}" target="_blank" rel="noopener">${ai[0]} ↗</a>` : ai[0]} et envoie.</div></div>
      <div class="use-step"><span class="how-num">3</span><div><b>Enregistre</b> le code reçu dans un fichier <code>index.html</code>, puis ouvre-le dans ton navigateur.</div></div>
    </div>
    <div class="final-grid">
      <div class="side-card">
        <div class="side-h"><b>🗺️ Plan de ta page</b><button class="link" data-go="3">Modifier</button></div>
        ${s.length ? `<div class="sp">${s.map(i => `<div class="sp-row plan-${i.id}"><span>${i.name}</span></div>`).join("")}</div>` : `<p class="desc">Aucune section visible.</p>`}
        ${GROUPS.filter(([k]) => k !== "section" && g[k]).map(([k, label]) => `<div class="label">${label}</div><div class="chips">${g[k].map(i => `<span>${i.name}</span>`).join("")}</div>`).join("")}
      </div>
      <details class="side-card prompt-box" open>
        <summary><b>👀 Voir le prompt</b> <span class="desc">(tu n'as rien à modifier)</span></summary>
        <div class="prompt" id="out">${esc(t)}</div>
      </details>
    </div>
    <p class="desc center">💡 Un seul message complet au lieu de 5 à 10 allers-retours : c'est autant de tokens économisés.</p>`;
}

function refreshOut() {
  const t = generatePrompt();
  if ($("#out")) $("#out").textContent = t;
  if ($("#tok")) $("#tok").textContent = `≈ ${Math.round(t.length / 4)} tokens`;
}

function initBuilder() {
  loadB();
  updateBadge();
  const v = $("#createView");
  v.addEventListener("click", e => {
    const t = e.target;
    const info = t.closest("[data-info]");
    if (info) { e.stopPropagation(); return open(info.dataset.info); }
    const gs = t.closest("[data-go]");
    if (gs) return go(+gs.dataset.go);
    if (t.closest("#wzBack")) return go(ui.step - 1);
    if (t.closest("#wzNext")) return ui.step === 5 ? copy(generatePrompt()) : go(ui.step + 1);
    if (t.closest("#cpAll")) return copy(generatePrompt());
    const kd = t.closest("[data-kind]");
    if (kd) {
      if (B.opt.kind !== kd.dataset.kind) { B.opt.kind = kd.dataset.kind; fixOptions(); ui.cat = "ess"; saveB(); }
      return go(2);
    }
    const rc = t.closest("[data-recipe]");
    if (rc) {
      if (rc.dataset.recipe) {
        B.sel = []; kind().recipes[rc.dataset.recipe].filter(byId).forEach(addSel);
        saveB(); updateBadge(); toast("Modèle chargé ✓ Ajuste-le à ton goût");
      }
      ui.cat = "ess";
      return go(3);
    }
    const pc = t.closest("[data-pcat]");
    if (pc) { ui.cat = pc.dataset.pcat; ui.q = ""; $("#pq").value = ""; return renderPicker(); }
    const st = t.closest("[data-set]");
    if (st) {
      const key = st.dataset.set;
      B.opt[key] = key === "codeOnly" ? st.dataset.val === "true" : st.dataset.val;
      saveB();
      st.parentElement.querySelectorAll(".opt").forEach(x => x.classList.toggle("on", x === st));
      if (key === "colors") { const inp = v.querySelector('input[data-opt="colors"]'); if (inp) inp.value = ""; }
      return;
    }
    const tg = t.closest("[data-toggle]");
    if (tg) return toggleSel(tg.dataset.toggle);
    const act = t.closest("[data-act]");
    if (act) {
      const { act: a, id } = act.dataset;
      if (a === "up") moveSel(id, -1);
      if (a === "down") moveSel(id, 1);
      if (a === "rm") B.sel.splice(B.sel.indexOf(id), 1);
      if (a === "clear") B.sel = [];
      return selChanged();
    }
  });
  v.addEventListener("keydown", e => {
    const tg = e.target.closest("[data-toggle]");
    if (tg && e.target === tg && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggleSel(tg.dataset.toggle); }
  });
  v.addEventListener("input", e => {
    if (e.target.id === "pq") { ui.q = e.target.value; return renderPicker(); }
    const key = e.target.dataset.opt;
    if (!key) return;
    B.opt[key] = e.target.value;
    if (key === "colors") v.querySelectorAll('[data-set="colors"]').forEach(x => x.classList.toggle("on", x.dataset.val === e.target.value));
    saveB();
  });
}
