(function () {
  const STORAGE_KEY = "terraria-achievements-progress";

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  let progress = loadProgress();

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function rarityClass(rarity) {
    if (rarity >= 30) return "rarity-common";
    if (rarity >= 10) return "rarity-uncommon";
    if (rarity >= 2) return "rarity-rare";
    return "rarity-ultra";
  }

  const state = {
    search: "",
    filter: "all", // all | todo | done
    sort: "rarity-desc",
  };

  const categoriesContainer = document.getElementById("categoriesContainer");
  const sideCategoryList = document.getElementById("sideCategoryList");
  const noResults = document.getElementById("noResults");
  const overallFill = document.getElementById("overallFill");
  const overallLabel = document.getElementById("overallLabel");

  function sortAchievements(list) {
    const copy = [...list];
    if (state.sort === "rarity-desc") copy.sort((a, b) => b.rarity - a.rarity);
    else if (state.sort === "rarity-asc") copy.sort((a, b) => a.rarity - b.rarity);
    else copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }

  function matchesSearch(ach) {
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    return ach.name.toLowerCase().includes(q) || ach.desc.toLowerCase().includes(q);
  }

  function matchesFilter(ach) {
    const done = !!progress[ach.id];
    if (state.filter === "todo") return !done;
    if (state.filter === "done") return done;
    return true;
  }

  function render() {
    categoriesContainer.innerHTML = "";
    sideCategoryList.innerHTML = "";

    let totalDone = 0;
    let anyVisible = false;

    CATEGORIES.forEach((cat) => {
      const allInCat = ACHIEVEMENTS.filter((a) => a.category === cat.id);
      const doneInCat = allInCat.filter((a) => progress[a.id]).length;
      totalDone += doneInCat;

      const visible = sortAchievements(
        allInCat.filter((a) => matchesSearch(a) && matchesFilter(a))
      );

      // Sidebar entry (always shown, reflects real progress regardless of filters)
      const pct = allInCat.length ? Math.round((doneInCat / allInCat.length) * 100) : 0;
      const sideLink = document.createElement("a");
      sideLink.className = "side-cat";
      sideLink.href = `#cat-${cat.id}`;
      sideLink.innerHTML = `
        <div class="side-cat-row">
          <span>${cat.emoji} ${cat.title}</span>
          <span class="side-cat-count">${doneInCat}/${allInCat.length}</span>
        </div>
        <div class="side-cat-bar"><div class="side-cat-bar-fill" style="width:${pct}%"></div></div>
      `;
      sideCategoryList.appendChild(sideLink);

      if (!visible.length) return;
      anyVisible = true;

      const section = document.createElement("section");
      section.className = "category-section";
      section.id = `cat-${cat.id}`;

      const header = document.createElement("div");
      header.className = "category-header";
      header.innerHTML = `
        <h2>${cat.emoji} ${cat.title}</h2>
        <span class="cat-progress">${doneInCat} / ${allInCat.length}</span>
      `;
      section.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "achievement-grid";

      visible.forEach((ach) => {
        const done = !!progress[ach.id];
        const card = document.createElement("div");
        card.className = "ach-card" + (done ? " done" : "");
        card.innerHTML = `
          <img class="ach-icon" src="${ach.icon}" alt="" loading="lazy">
          <div class="ach-body">
            <div class="ach-title-row">
              <span class="ach-name">${ach.name}</span>
              <span class="ach-rarity ${rarityClass(ach.rarity)}">${ach.rarity}%</span>
            </div>
            <div class="ach-desc">${ach.desc}</div>
          </div>
          <input type="checkbox" class="ach-check" ${done ? "checked" : ""} aria-label="Mark ${ach.name} obtained">
        `;
        const checkbox = card.querySelector(".ach-check");
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) progress[ach.id] = true;
          else delete progress[ach.id];
          saveProgress();
          render();
        });
        grid.appendChild(card);
      });

      section.appendChild(grid);
      categoriesContainer.appendChild(section);
    });

    noResults.hidden = anyVisible;

    const totalAll = ACHIEVEMENTS.length;
    const overallPct = Math.round((totalDone / totalAll) * 100);
    overallFill.style.width = overallPct + "%";
    overallLabel.textContent = `${totalDone} / ${totalAll} (${overallPct}%)`;
  }

  // Controls
  document.getElementById("searchBox").addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    render();
  });

  document.getElementById("sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  document.getElementById("filterGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Clear all checked achievements? This cannot be undone.")) {
      progress = {};
      saveProgress();
      render();
    }
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "terraria-achievements-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (typeof imported !== "object" || imported === null) throw new Error("bad format");
        progress = imported;
        saveProgress();
        render();
      } catch {
        alert("That file doesn't look like a valid progress export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // Steam sync
  const STEAM_ID_STORAGE = "terraria-steam-id64";

  function normalizeName(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  // Accepts a full profile URL, a bare vanity name, or a raw 17-digit SteamID64,
  // and returns { kind: "id" | "vanity", value } for building the achievements URL.
  function parseSteamIdentifier(raw) {
    let s = raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const profilesMatch = s.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
    if (profilesMatch) return { kind: "id", value: profilesMatch[1] };
    const idMatch = s.match(/steamcommunity\.com\/id\/([^/]+)/i);
    if (idMatch) return { kind: "vanity", value: idMatch[1] };
    if (/^\d{17}$/.test(s)) return { kind: "id", value: s };
    if (s && !s.includes("/")) return { kind: "vanity", value: s };
    return null;
  }

  const nameIndex = new Map(ACHIEVEMENTS.map((a) => [normalizeName(a.name), a.id]));

  const WORKER_URL = "https://terraria-achievement-tracker.kennethphamdao.workers.dev/";

  const steamModalBackdrop = document.getElementById("steamModalBackdrop");
  const steamId64Input = document.getElementById("steamId64");
  const steamSyncResult = document.getElementById("steamSyncResult");
  const syncNowBtn = document.getElementById("syncNowBtn");

  steamId64Input.value = localStorage.getItem(STEAM_ID_STORAGE) || "";

  function openSteamModal() {
    steamModalBackdrop.hidden = false;
  }
  function closeSteamModal() {
    steamModalBackdrop.hidden = true;
  }

  document.getElementById("steamSyncBtn").addEventListener("click", () => {
    openSteamModal();
    if (window.innerWidth <= 860) sidebar.classList.remove("open");
  });
  document.getElementById("steamModalClose").addEventListener("click", closeSteamModal);
  steamModalBackdrop.addEventListener("click", (e) => {
    if (e.target === steamModalBackdrop) closeSteamModal();
  });

  syncNowBtn.addEventListener("click", async () => {
    const raw = steamId64Input.value;
    const parsed = parseSteamIdentifier(raw);
    if (!parsed) {
      steamSyncResult.textContent = "Enter your Steam profile URL, custom name, or SteamID64 first.";
      return;
    }
    localStorage.setItem(STEAM_ID_STORAGE, raw.trim());

    syncNowBtn.disabled = true;
    syncNowBtn.textContent = "Syncing…";
    steamSyncResult.textContent = "";

    let raw_xml;
    try {
      const resp = await fetch(`${WORKER_URL}?id=${encodeURIComponent(parsed.value)}`);
      raw_xml = await resp.text();
      if (!resp.ok) {
        let msg = "Sync failed.";
        try {
          msg = JSON.parse(raw_xml).error || msg;
        } catch {}
        steamSyncResult.textContent = `Sync failed: ${msg}`;
        return;
      }
    } catch {
      steamSyncResult.textContent = "Couldn't reach the sync service. Check your connection and try again.";
      return;
    } finally {
      syncNowBtn.disabled = false;
      syncNowBtn.textContent = "🔄 Sync now";
    }

    const doc = new DOMParser().parseFromString(raw_xml, "text/xml");
    if (doc.querySelector("parsererror")) {
      const steamError = raw_xml.match(/profile_fatalerror_message">([^<]+)</)?.[1];
      steamSyncResult.textContent = steamError
        ? `Steam says: "${steamError.trim()}" — check that the profile isn't private and that Game details is set to Public.`
        : "Steam returned something unexpected. Double-check the profile link/ID and try again.";
      return;
    }

    const privacyState = doc.querySelector("privacyState")?.textContent;
    const achievementEls = doc.querySelectorAll("achievements > achievement");
    if (!achievementEls.length) {
      steamSyncResult.textContent =
        privacyState && privacyState !== "public"
          ? "That profile's game details aren't public, so Steam didn't include achievement data."
          : "Couldn't find achievement data for that profile. Make sure it owns Terraria.";
      return;
    }

    let matched = 0;
    let newlyDone = 0;
    let unmatched = 0;
    achievementEls.forEach((el) => {
      if (el.getAttribute("closed") !== "1") return;
      const label = el.querySelector("name")?.textContent || el.querySelector("apiname")?.textContent || "";
      const id = nameIndex.get(normalizeName(label));
      if (!id) {
        unmatched++;
        return;
      }
      matched++;
      if (!progress[id]) {
        progress[id] = true;
        newlyDone++;
      }
    });

    saveProgress();
    render();

    steamSyncResult.textContent =
      `Synced! ${matched} unlocked achievements matched (${newlyDone} newly checked off)` +
      (unmatched ? `, ${unmatched} unmatched.` : ".");
  });

  // Mobile drawer
  const sidebar = document.getElementById("sidebar");
  const drawerToggle = document.getElementById("drawerToggle");
  drawerToggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    drawerToggle.setAttribute("aria-expanded", String(open));
  });
  sideCategoryList.addEventListener("click", (e) => {
    if (e.target.closest(".side-cat") && window.innerWidth <= 860) {
      sidebar.classList.remove("open");
    }
  });

  render();
})();
