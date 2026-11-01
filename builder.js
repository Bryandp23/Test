// Constructeur de page : sélection de plusieurs fiches du dico, puis génération
// d'un prompt complet qui demande à l'IA le code HTML/CSS/JS d'une page contenant
// toutes ces sections, dans le bon ordre.

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
  database: "À la fin, propose une structure de base de données simple (tables et colonnes) pour les données du site.",
  api: "Isole chaque appel d'API dans une fonction dédiée qui renvoie pour l'instant des données d'exemple.",
  responsive: "Soigne particulièrement le responsive : vérifie chaque section à 375 px, 768 px et 1280 px de large.",
  wireframe: "Avant le code, donne le plan de la page en texte (une ligne par section).",
  uxui: "Applique les bonnes pratiques UX : hiérarchie visuelle claire, une action principale bien visible, boutons assez grands pour le doigt.",
  cms: "Structure les contenus pour qu'ils soient faciles à reprendre ensuite dans un CMS comme WordPress.",
  seo: "SEO de base : balise title, meta description, un seul H1, hiérarchie H2/H3 logique, attribut alt sur chaque image.",
  https: "Aucune ressource chargée en http:// (uniquement https://).",
  domain: "À la fin, explique en 5 étapes maximum comment relier la page à mon nom de domaine.",
  hosting: "À la fin, explique en 5 étapes maximum comment héberger gratuitement cette page.",
  deploy: "À la fin, explique en 5 étapes maximum comment mettre la page en ligne gratuitement (GitHub Pages ou Netlify).",
  bug: "Le code ne doit produire aucune erreur dans la console du navigateur.",
  webapp: "Rends la page installable comme une application (PWA) : fichier manifest et service worker minimal.",
};
// Formulation adaptée au constructeur pour les fiches dont le prompt du dico est une question.
const BUILD_PROMPT = {
  palette: "Définis une palette cohérente avec le projet (couleur principale, secondaire, accent, gris, fond), appliquée via des variables CSS, avec un contraste suffisant pour le texte.",
  typo: "Associe 2 polices Google Fonts adaptées au style (une pour les titres, une pour le texte), avec une échelle de tailles claire et un interligne confortable.",
};
const promptOf = i => BUILD_PROMPT[i.id] || i.prompt;

const TECH_WITH_TEXT = new Set(["database", "wireframe", "domain", "hosting", "deploy"]);

const GROUPS = [
  ["section", "🧱 Sections de la page (de haut en bas)", "Structure de la page, de haut en bas"],
  ["extra", "🪟 Éléments complémentaires", "Éléments complémentaires (superposés, flottants ou intégrés)"],
  ["feature", "⚙️ Fonctionnalités", "Fonctionnalités"],
  ["page", "📄 Autres pages", "Autres pages à créer"],
  ["design", "🎨 Consignes de design", "Design"],
  ["tech", "🛠️ Consignes techniques", "Consignes techniques supplémentaires"],
];

const RECIPES = {
  "🏪 Site vitrine": ["navbar", "hamburger", "hero", "card", "reviews", "form", "map", "footer", "backtotop", "responsive", "seo"],
  "🎯 Landing page": ["navbar", "hero", "card", "reviews", "pricing", "accordion", "cta", "footer", "scrollreveal", "fold"],
  "🛍️ Boutique": ["navbar", "hamburger", "search", "badge", "carousel", "card", "pagination", "footer", "cookie", "productpage", "checkout", "payment"],
  "🍽️ Restaurant": ["navbar", "hamburger", "hero", "carousel", "tabs", "reviews", "booking", "map", "footer", "palette", "typo"],
  "📱 Appli mobile": ["bottomnav", "fab", "bottomsheet", "onboarding", "pulltorefresh", "swipe", "push", "webapp"],
};

const OPTS = {
  target: { label: "IA utilisée", choices: { claude: "Claude", chatgpt: "ChatGPT", other: "Autre IA" } },
  type: { label: "Type de projet", choices: { "un site vitrine": "Site vitrine", "une landing page": "Landing page", "une boutique en ligne": "Boutique en ligne", "un blog": "Blog", "un portfolio": "Portfolio", "une application web": "Application web" } },
  tech: { label: "Technologie", choices: { single: "HTML/CSS/JS en 1 fichier", separate: "HTML/CSS/JS en 3 fichiers", react: "React + Tailwind" } },
  style: { label: "Style", choices: { "": "Laisser l'IA choisir", "moderne et épuré": "Moderne et épuré", "chaleureux et convivial": "Chaleureux", "luxe et élégant": "Luxe et élégant", "coloré et ludique": "Coloré et ludique", "professionnel et sobre": "Professionnel", "minimaliste": "Minimaliste" } },
};

const TECH_TEXT = {
  single: "HTML, CSS et JavaScript « vanilla » dans un seul fichier index.html (CSS dans <style>, JavaScript dans <script>), sans framework ni bibliothèque externe : je dois pouvoir l'ouvrir directement dans mon navigateur.",
  separate: "HTML, CSS et JavaScript « vanilla » en 3 fichiers séparés (index.html, style.css, script.js), sans framework ni bibliothèque externe.",
  react: "React (composants fonctionnels et hooks) avec Tailwind CSS, un composant par section, plus un composant App qui les assemble.",
};

const B = {
  sel: [],
  opt: { target: "claude", type: "un site vitrine", tech: "single", style: "", colors: "", ctx: "", content: "demo", missing: "choose", codeOnly: true },
};

const byId = id => DICO.find(x => x.id === id);

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
    if (!(B.opt.type in OPTS.type.choices)) B.opt.type = "un site vitrine";
  } catch (e) { /* stockage indisponible */ }
}

const isSel = id => B.sel.includes(id);

// Ajoute une section à sa place logique (le footer reste en bas, la navbar en haut…).
function addSel(id) {
  if (isSel(id)) return;
  const i = byId(id);
  if (roleOf(i) === "section") {
    const at = B.sel.findIndex(x => roleOf(byId(x)) === "section" && orderOf(x) > orderOf(id));
    if (at >= 0) { B.sel.splice(at, 0, id); return; }
  }
  B.sel.push(id);
}
function toggleSel(id) {
  isSel(id) ? B.sel.splice(B.sel.indexOf(id), 1) : addSel(id);
  saveB(); updateBar(); render();
}

function moveSel(id, dir) {
  const sections = B.sel.filter(x => roleOf(byId(x)) === "section");
  const k = sections.indexOf(id), other = sections[k + dir];
  if (other === undefined) return;
  const a = B.sel.indexOf(id), b = B.sel.indexOf(other);
  [B.sel[a], B.sel[b]] = [B.sel[b], B.sel[a]];
}

function updateBar() {
  $("#bar").classList.toggle("show", B.sel.length > 0);
  $("#barCount").textContent = `${B.sel.length} élément${B.sel.length > 1 ? "s" : ""}`;
  $("#barList").textContent = B.sel.map(id => byId(id).name).join(" · ");
}

function grouped() {
  const g = {};
  for (const id of B.sel) { const i = byId(id); (g[roleOf(i)] ||= []).push(i); }
  return g;
}

function generatePrompt() {
  const o = B.opt, g = grouped();
  if (!B.sel.length) return "Sélectionne au moins un élément du dico pour générer le prompt.";
  const claude = o.target === "claude";
  const block = (tag, title, body) => claude ? `<${tag}>\n${body}\n</${tag}>` : `## ${title}\n${body}`;
  const list = (items, fmt) => items.map(fmt).join("\n");
  const parts = [];

  parts.push(block("role", "Rôle", "Tu es un développeur front-end et designer web expérimenté."));
  parts.push(block("objectif", "Objectif",
    `Crée une page web complète et fonctionnelle : ${o.type}` + (o.ctx.trim() ? ` pour le projet suivant : ${o.ctx.trim()}` : ".") +
    `\nLa page doit contenir toutes les sections ci-dessous. Leur position est donnée par l'ordre de la liste : il prime sur les indications de position écrites dans les descriptions.`));

  for (const [key, , title] of GROUPS) {
    const items = g[key];
    if (!items) continue;
    let body;
    if (key === "section") body = list(items, (i, n) => `${n + 1}. ${i.name} (${i.en}) : ${promptOf(i)}`);
    else if (key === "tech") body = list(items, i => `- ${TECH[i.id] || promptOf(i)}`);
    else if (key === "page") body = list(items, i => `- ${i.name} (${i.en}) : ${promptOf(i)}`);
    else body = list(items, i => `- ${i.name} (${i.en}) : ${promptOf(i)}`);
    if (key === "design") body = designHeader(o) + "\n" + body;
    parts.push(block(key === "section" ? "structure" : key === "extra" ? "complements" : key === "feature" ? "fonctionnalites" : key === "page" ? "pages" : key === "tech" ? "consignes_techniques" : key, title, body));
  }
  if (!g.design && (o.style || o.colors.trim())) parts.push(block("design", "Design", designHeader(o)));

  const constraints = [
    `- Technologie : ${TECH_TEXT[o.tech]}`,
    "- Responsive « mobile first » : parfait sur téléphone, tablette et ordinateur.",
    "- Accessible : HTML sémantique (header, nav, main, section, footer), navigation au clavier, contrastes suffisants.",
    "- Images : utilise https://picsum.photos (ex. https://picsum.photos/1200/600) avec un attribut alt descriptif, faciles à remplacer.",
    o.content === "demo"
      ? "- Textes : rédige des textes d'exemple réalistes en français, adaptés au projet (pas de lorem ipsum)."
      : "- Textes : mets des textes provisoires repérables, au format [À COMPLÉTER : description], que je remplacerai.",
    "- Code propre, commenté par section, avec des variables CSS pour les couleurs.",
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

function planHTML(g) {
  const s = g.section || [];
  const e = [...(g.extra || []), ...(g.feature || [])];
  if (!s.length && !e.length) return `<div class="desc">Aucune section visible pour l'instant.</div>`;
  return `<div class="plan">${s.map(i => `<div class="plan-row plan-${i.id}">${i.name}</div>`).join("")}</div>` +
    (e.length ? `<div class="chips" style="margin-top:8px">${e.map(i => `<span>+ ${i.name}</span>`).join("")}</div>` : "");
}

function selectHTML(key) {
  const d = OPTS[key];
  return `<label class="f"><span>${d.label}</span><select data-opt="${key}">${Object.entries(d.choices)
    .map(([v, t]) => `<option value="${v}" ${B.opt[key] === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
}

function openBuilder() {
  const g = grouped();
  const sectionIds = (g.section || []).map(i => i.id);
  const rows = GROUPS.filter(([k]) => g[k]).map(([k, label]) => `
    <div class="b-group"><div class="b-gtitle">${label}</div>${g[k].map(i => {
      const pos = sectionIds.indexOf(i.id);
      return `<div class="b-row"><div><b>${i.name}</b> <span class="en">${i.en}</span></div><div class="b-btns">${k === "section"
        ? `<button data-act="up" data-id="${i.id}" ${pos === 0 ? "disabled" : ""} title="Monter">↑</button><button data-act="down" data-id="${i.id}" ${pos === sectionIds.length - 1 ? "disabled" : ""} title="Descendre">↓</button>`
        : ""}<button data-act="rm" data-id="${i.id}" title="Retirer">✕</button></div></div>`;
    }).join("")}</div>`).join("");

  $("#panel").classList.add("wide");
  $("#panel").innerHTML = `
    <div class="content" style="position:relative">
      <button class="close" id="x">✕</button>
      <h2>🧱 Construire ma page</h2>
      <p class="desc">Choisis tes éléments, règle quelques options, et copie un seul prompt complet. L'IA te renverra directement le code HTML, CSS et JavaScript de ta page.</p>
      <div class="b-grid">
        <div>
          <div class="label">⚡ Démarrage rapide (remplace la sélection)</div>
          <div class="chips recipes">${Object.keys(RECIPES).map(r => `<button data-act="recipe" data-id="${r}">${r}</button>`).join("")}</div>
          <div class="label">Ta sélection (${B.sel.length})</div>
          ${rows || `<div class="desc">Rien de sélectionné. Utilise un démarrage rapide ou ajoute des éléments depuis le dico (bouton ＋ sur chaque carte).</div>`}
          <div class="actions"><button class="btn ghost" data-act="more">＋ Ajouter d'autres éléments</button>${B.sel.length ? `<button class="btn ghost" data-act="clear">Tout retirer</button>` : ""}</div>
          <div class="label">Ton projet</div>
          <textarea data-opt="ctx" placeholder="Ex. : Restaurant italien « Da Marco » à Lyon, cuisine familiale, clientèle de quartier et touristes.">${B.opt.ctx}</textarea>
          <div class="f-grid">
            ${selectHTML("target")}${selectHTML("type")}${selectHTML("tech")}${selectHTML("style")}
            <label class="f"><span>Couleurs (facultatif)</span><input data-opt="colors" value="${B.opt.colors.replace(/"/g, "&quot;")}" placeholder="Ex. : vert sapin et crème"></label>
            <label class="f"><span>Textes</span><select data-opt="content"><option value="demo" ${B.opt.content === "demo" ? "selected" : ""}>Textes d'exemple rédigés par l'IA</option><option value="mine" ${B.opt.content === "mine" ? "selected" : ""}>Je mettrai mes propres textes</option></select></label>
            <label class="f"><span>S'il manque une info</span><select data-opt="missing"><option value="choose" ${B.opt.missing === "choose" ? "selected" : ""}>L'IA fait des choix (plus rapide)</option><option value="ask" ${B.opt.missing === "ask" ? "selected" : ""}>L'IA me pose des questions d'abord</option></select></label>
            <label class="f check"><input type="checkbox" data-opt="codeOnly" ${B.opt.codeOnly ? "checked" : ""}> <span>Réponse = le code seul (économise des tokens)</span></label>
          </div>
        </div>
        <div>
          <div class="label">🗺️ Plan de ta page</div>
          ${planHTML(g)}
          <div class="label">✨ Prompt généré <span id="tok" class="tok"></span></div>
          <div class="prompt" id="out"></div>
          <div class="actions"><button class="btn primary" id="cpAll" ${B.sel.length ? "" : "disabled"}>📋 Copier le prompt</button></div>
          <p class="desc">💡 Un seul message complet et structuré évite les allers-retours avec l'IA, donc les tokens perdus.${B.opt.target === "claude" ? " Le prompt utilise des balises (&lt;structure&gt;…), un format que Claude comprend particulièrement bien." : ""}</p>
        </div>
      </div>
    </div>`;
  refreshOut();
  $("#overlay").classList.add("show");
}

function refreshOut() {
  const t = generatePrompt();
  $("#out").textContent = t;
  $("#tok").textContent = B.sel.length ? `≈ ${Math.round(t.length / 4)} tokens` : "";
}

function initBuilder() {
  loadB();
  updateBar();
  $("#openBuilder").onclick = openBuilder;
  $("#clearSel").onclick = () => { B.sel = []; saveB(); updateBar(); render(); };
  const panel = $("#panel");
  panel.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (b) {
      const { act, id } = b.dataset;
      if (act === "more") return close();
      if (act === "up") moveSel(id, -1);
      if (act === "down") moveSel(id, 1);
      if (act === "rm") B.sel.splice(B.sel.indexOf(id), 1);
      if (act === "clear") B.sel = [];
      if (act === "recipe") { B.sel = []; RECIPES[id].filter(byId).forEach(addSel); }
      saveB(); updateBar(); render(); openBuilder();
      return;
    }
    if (e.target.id === "cpAll") copy(generatePrompt());
  });
  const onOpt = e => {
    const k = e.target.dataset.opt;
    if (!k) return;
    B.opt[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    saveB();
    if (k === "target") openBuilder(); else refreshOut();
  };
  const isChoice = el => el.tagName === "SELECT" || el.type === "checkbox";
  panel.addEventListener("input", e => { if (!isChoice(e.target)) onOpt(e); });
  panel.addEventListener("change", e => { if (isChoice(e.target)) onOpt(e); });
}
