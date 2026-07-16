// ============================================================
// deathbyleisuregames — app logic
// Grid rendering, search, category filter, player view,
// hash routing (#play=slug), recently played (localStorage).
// ============================================================

(function () {
  "use strict";

  const grid        = document.getElementById("gameGrid");
  const relatedGrid = document.getElementById("relatedGrid");
  const recentGrid  = document.getElementById("recentGrid");
  const recentWrap  = document.getElementById("recentWrap");
  const noResults   = document.getElementById("noResults");
  const home        = document.getElementById("home");
  const player      = document.getElementById("player");
  const frame       = document.getElementById("gameFrame");
  const playerTitle = document.getElementById("playerTitle");
  const searchInput = document.getElementById("searchInput");
  const catBar      = document.getElementById("catBar");

  let activeCat = "all";
  let query = "";

  // ---------- tile factory ----------
  function makeTile(game, { small = false } = {}) {
    const tile = document.createElement("a");
    tile.className = "tile" + (game.featured && !small ? " featured" : "");
    tile.href = "#play=" + game.slug;
    tile.setAttribute("aria-label", "Play " + game.title);

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

  // ---------- grid rendering ----------
  function renderGrid() {
    grid.innerHTML = "";
    const q = query.trim().toLowerCase();
    const list = GAMES.filter(g =>
      (activeCat === "all" || g.cat === activeCat) &&
      (!q || g.title.toLowerCase().includes(q))
    );
    list.forEach(g => grid.appendChild(makeTile(g)));
    noResults.hidden = list.length > 0;
    renderRecent();
  }

  // ---------- recently played ----------
  function getRecent() {
    try { return JSON.parse(localStorage.getItem("dblg-recent") || "[]"); }
    catch { return []; }
  }
  function pushRecent(slug) {
    const rec = getRecent().filter(s => s !== slug);
    rec.unshift(slug);
    try { localStorage.setItem("dblg-recent", JSON.stringify(rec.slice(0, 8))); }
    catch { /* storage unavailable — fine */ }
  }
  function renderRecent() {
    const rec = getRecent()
      .map(s => GAMES.find(g => g.slug === s))
      .filter(Boolean);
    const show = rec.length > 0 && activeCat === "all" && !query.trim();
    recentWrap.hidden = !show;
    if (!show) return;
    recentGrid.innerHTML = "";
    rec.forEach(g => recentGrid.appendChild(makeTile(g, { small: true })));
  }

  // ---------- player ----------
  function openGame(game) {
    playerTitle.textContent = game.title;
    frame.src = game.embed;
    home.hidden = true;
    player.hidden = false;
    document.title = game.title + " — DBL Games";
    window.scrollTo({ top: 0 });
    pushRecent(game.slug);

    // related: same category first, then fill with others
    const pool = GAMES.filter(g => g.slug !== game.slug);
    const related = pool.filter(g => g.cat === game.cat)
      .concat(pool.filter(g => g.cat !== game.cat))
      .slice(0, 8);
    relatedGrid.innerHTML = "";
    related.forEach(g => relatedGrid.appendChild(makeTile(g, { small: true })));
  }

  function closeGame() {
    frame.src = "about:blank"; // stop game audio/CPU
    player.hidden = true;
    home.hidden = false;
    document.title = "DBL Games — play free unblocked games online";
    renderRecent();
  }

  // ---------- hash routing ----------
  function route() {
    const m = location.hash.match(/^#play=([\w-]+)$/);
    const game = m && GAMES.find(g => g.slug === m[1]);
    if (game) openGame(game);
    else closeGame();
  }
  window.addEventListener("hashchange", route);

  // ---------- events ----------
  document.getElementById("backBtn").addEventListener("click", () => {
    location.hash = "";
  });
  document.getElementById("logoLink").addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = "";
    activeCat = "all";
    query = "";
    searchInput.value = "";
    syncChips();
    renderGrid();
  });

  document.getElementById("fsBtn").addEventListener("click", () => {
    const wrap = document.getElementById("frameWrap");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
    else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
  });

  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    if (!player.hidden) location.hash = ""; // typing returns to grid
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
    if (!player.hidden) location.hash = "";
    renderGrid();
  });

  // ---------- boot ----------
  renderGrid();
  route(); // handle direct links like index.html#play=drift-king
})();
