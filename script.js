// ============================================================
// DBL Games — app logic
// Combined catalog (curated + generated), chunked grid render,
// search, categories, player view, ?g= routing, favorites,
// recently played, random game.
// ============================================================

(function () {
  "use strict";

  // ---------- catalog ----------
  const slugify = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const CATALOG = GAMES.map(g => ({
    title: g.title, cat: g.cat, featured: !!g.featured,
    embed: g.embed, img: g.img, slug: g.slug
  }));
  if (typeof MORE_GAMES !== "undefined") {
    const have = new Set(CATALOG.map(g => g.slug));
    for (const m of MORE_GAMES) {
      const slug = slugify(m.t);
      if (have.has(slug)) continue;
      have.add(slug);
      CATALOG.push({
        title: m.t, cat: m.c, featured: false, slug,
        embed: "https://html5.gamemonetize.co/" + m.h + "/",
        img: "https://img.gamemonetize.com/" + m.h + "/512x384.jpg"
      });
    }
  }
  const BY_SLUG = new Map(CATALOG.map(g => [g.slug, g]));

  // ---------- dom ----------
  const grid        = document.getElementById("gameGrid");
  const relatedGrid = document.getElementById("relatedGrid");
  const recentGrid  = document.getElementById("recentGrid");
  const recentWrap  = document.getElementById("recentWrap");
  const favGrid     = document.getElementById("favGrid");
  const favWrap     = document.getElementById("favWrap");
  const noResults   = document.getElementById("noResults");
  const home        = document.getElementById("home");
  const player      = document.getElementById("player");
  const frame       = document.getElementById("gameFrame");
  const playerTitle = document.getElementById("playerTitle");
  const searchInput = document.getElementById("searchInput");
  const catBar      = document.getElementById("catBar");
  const sentinel    = document.getElementById("loadMore");
  const favBtn      = document.getElementById("favBtn");
  const metaDesc    = document.querySelector('meta[name="description"]');

  const CHUNK = 120;
  let activeCat = "all";
  let query = "";
  let filtered = [];
  let rendered = 0;
  let currentGame = null;

  // ---------- storage helpers ----------
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // ---------- tile factory ----------
  function makeTile(game, { small = false } = {}) {
    const tile = document.createElement("a");
    tile.className = "tile" + (game.featured && !small ? " featured" : "");
    tile.href = "?g=" + game.slug;
    tile.setAttribute("aria-label", "Play " + game.title);
    tile.addEventListener("click", (e) => {
      e.preventDefault();
      openBySlug(game.slug, true);
    });

    const img = document.createElement("img");
    img.src = game.img;
    img.alt = game.title;
    img.loading = "lazy";
    img.onerror = () => { img.remove(); tile.classList.add("no-img"); };

    const name = document.createElement("div");
    name.className = "tile-name";
    name.textContent = game.title;

    const badge = document.createElement("span");
    badge.className = "play-badge";
    badge.textContent = "PLAY";

    tile.append(img, name, badge);
    return tile;
  }

  // ---------- grid rendering (chunked) ----------
  function computeFiltered() {
    const q = query.trim().toLowerCase();
    filtered = CATALOG.filter(g =>
      (activeCat === "all" || g.cat === activeCat) &&
      (!q || g.title.toLowerCase().includes(q))
    );
  }
  function renderChunk() {
    const frag = document.createDocumentFragment();
    const end = Math.min(rendered + CHUNK, filtered.length);
    for (let i = rendered; i < end; i++) frag.appendChild(makeTile(filtered[i]));
    rendered = end;
    grid.appendChild(frag);
    sentinel.hidden = rendered >= filtered.length;
  }
  function renderGrid() {
    computeFiltered();
    grid.innerHTML = "";
    rendered = 0;
    renderChunk();
    noResults.hidden = filtered.length > 0;
    renderRows();
  }
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && rendered < filtered.length) renderChunk();
  }, { rootMargin: "600px" }).observe(sentinel);

  // ---------- spotlight banner ----------
  const spotlight = document.getElementById("spotlight");
  const spotlightRow = document.getElementById("spotlightRow");
  let spotList = "reviewed";

  function makeSpotCard(game, rank) {
    const card = document.createElement("a");
    card.className = "spot-card";
    card.href = "?g=" + game.slug;
    card.setAttribute("aria-label", "Play " + game.title);
    card.addEventListener("click", (e) => {
      e.preventDefault();
      openBySlug(game.slug, true);
    });
    const img = document.createElement("img");
    img.src = game.img;
    img.alt = game.title;
    img.loading = "lazy";
    const info = document.createElement("div");
    info.className = "spot-info";
    const num = document.createElement("span");
    num.className = "spot-rank";
    num.textContent = "#" + rank;
    const name = document.createElement("span");
    name.className = "spot-name";
    name.textContent = game.title;
    const play = document.createElement("span");
    play.className = "spot-play";
    play.textContent = "▶ Play";
    info.append(num, name, play);
    card.append(img, info);
    return card;
  }
  function renderSpotlight() {
    if (typeof SPOTLIGHT === "undefined") { spotlight.hidden = true; return; }
    const slugs = SPOTLIGHT[spotList] || [];
    const games = slugs.map(s => BY_SLUG.get(s)).filter(Boolean);
    spotlight.hidden = games.length === 0 || activeCat !== "all" || !!query.trim();
    if (spotlight.hidden) return;
    spotlightRow.innerHTML = "";
    games.forEach((g, i) => spotlightRow.appendChild(makeSpotCard(g, i + 1)));
    spotlightRow.scrollLeft = 0;
  }
  document.querySelectorAll(".spot-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      spotList = tab.dataset.list;
      document.querySelectorAll(".spot-tab").forEach(t =>
        t.classList.toggle("active", t === tab));
      renderSpotlight();
    });
  });

  // ---------- recent + favorites rows ----------
  function renderRow(key, wrap, rowGrid) {
    const items = store.get(key).map(s => BY_SLUG.get(s)).filter(Boolean);
    const show = items.length > 0 && activeCat === "all" && !query.trim();
    wrap.hidden = !show;
    if (!show) return;
    rowGrid.innerHTML = "";
    items.forEach(g => rowGrid.appendChild(makeTile(g, { small: true })));
  }
  function renderRows() {
    renderSpotlight();
    renderRow("dblg-recent", recentWrap, recentGrid);
    renderRow("dblg-favs", favWrap, favGrid);
  }
  function pushRecent(slug) {
    const rec = store.get("dblg-recent").filter(s => s !== slug);
    rec.unshift(slug);
    store.set("dblg-recent", rec.slice(0, 8));
  }

  // ---------- favorites ----------
  function isFav(slug) { return store.get("dblg-favs").includes(slug); }
  function syncFavBtn() {
    if (!currentGame) return;
    favBtn.textContent = isFav(currentGame.slug) ? "★ Favorited" : "☆ Favorite";
  }
  favBtn.addEventListener("click", () => {
    if (!currentGame) return;
    let favs = store.get("dblg-favs");
    favs = favs.includes(currentGame.slug)
      ? favs.filter(s => s !== currentGame.slug)
      : [currentGame.slug, ...favs].slice(0, 16);
    store.set("dblg-favs", favs);
    syncFavBtn();
  });

  // ---------- player ----------
  function openGame(game, pushState) {
    currentGame = game;
    playerTitle.textContent = game.title;
    frame.src = game.embed;
    home.hidden = true;
    player.hidden = false;
    document.title = game.title + " unblocked — DBL Games";
    if (metaDesc) metaDesc.setAttribute("content",
      "Play " + game.title + " unblocked online for free at DBL Games. No download needed.");
    window.scrollTo({ top: 0 });
    pushRecent(game.slug);
    syncFavBtn();
    if (pushState) history.pushState({ g: game.slug }, "", "?g=" + game.slug);

    const pool = CATALOG.filter(g => g.slug !== game.slug);
    const related = pool.filter(g => g.cat === game.cat).slice(0, 8);
    let i = 0;
    while (related.length < 8 && i < pool.length) {
      if (pool[i].cat !== game.cat) related.push(pool[i]);
      i++;
    }
    relatedGrid.innerHTML = "";
    related.forEach(g => relatedGrid.appendChild(makeTile(g, { small: true })));
  }
  function closeGame(pushState) {
    currentGame = null;
    frame.src = "about:blank"; // stop game audio/CPU
    player.hidden = true;
    home.hidden = false;
    document.title = "DBL Games — play free unblocked games online";
    if (metaDesc) metaDesc.setAttribute("content",
      "Play " + CATALOG.length + "+ free unblocked games online. Driving, shooting, arcade, puzzle, brain training, clicker, minecraft and 2 player games. No downloads.");
    if (pushState) history.pushState({}, "", location.pathname);
    renderRows();
  }
  function openBySlug(slug, pushState) {
    const game = BY_SLUG.get(slug);
    if (game) openGame(game, pushState);
    else closeGame(pushState);
  }

  // ---------- routing: ?g=slug (legacy #play= also honored) ----------
  function route() {
    const qs = new URLSearchParams(location.search).get("g");
    const legacy = (location.hash.match(/^#play=([\w-]+)$/) || [])[1];
    const slug = qs || legacy;
    if (slug && BY_SLUG.has(slug)) openGame(BY_SLUG.get(slug), false);
    else closeGame(false);
  }
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);

  // ---------- events ----------
  document.getElementById("backBtn").addEventListener("click", () => closeGame(true));
  document.getElementById("logoLink").addEventListener("click", (e) => {
    e.preventDefault();
    activeCat = "all";
    query = "";
    searchInput.value = "";
    syncChips();
    closeGame(true);
    renderGrid();
  });

  document.getElementById("randomBtn").addEventListener("click", () => {
    const g = CATALOG[Math.floor(Math.random() * CATALOG.length)];
    openGame(g, true);
  });

  document.getElementById("fsBtn").addEventListener("click", () => {
    const wrap = document.getElementById("frameWrap");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
    else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
  });

  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    if (!player.hidden) closeGame(true);
    renderGrid();
  });

  function syncChips() {
    catBar.querySelectorAll(".cat-chip").forEach(c =>
      c.classList.toggle("active", c.dataset.cat === activeCat));
  }
  catBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    activeCat = chip.dataset.cat;
    syncChips();
    if (!player.hidden) closeGame(true);
    renderGrid();
  });

  // ---------- boot ----------
  const counter = document.getElementById("gameCount");
  if (counter) counter.textContent = CATALOG.length + " games and counting";
  renderGrid();
  route(); // supports direct links: /?g=drift-king
})();
