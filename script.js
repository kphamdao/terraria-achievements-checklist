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
  const STEAM_KEY_STORAGE = "terraria-steam-apikey";
  const STEAM_ID_STORAGE = "terraria-steam-id64";

  function normalizeName(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  const nameIndex = new Map(ACHIEVEMENTS.map((a) => [normalizeName(a.name), a.id]));

  const steamModalBackdrop = document.getElementById("steamModalBackdrop");
  const steamApiKeyInput = document.getElementById("steamApiKey");
  const steamId64Input = document.getElementById("steamId64");
  const steamPasteBox = document.getElementById("steamPasteBox");
  const steamSyncResult = document.getElementById("steamSyncResult");

  steamApiKeyInput.value = localStorage.getItem(STEAM_KEY_STORAGE) || "";
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

  document.getElementById("openSteamDataBtn").addEventListener("click", () => {
    const key = steamApiKeyInput.value.trim();
    const id = steamId64Input.value.trim();
    if (!key || !/^\d{17}$/.test(id)) {
      steamSyncResult.textContent = "Enter a valid API key and a 17-digit SteamID64 first.";
      return;
    }
    localStorage.setItem(STEAM_KEY_STORAGE, key);
    localStorage.setItem(STEAM_ID_STORAGE, id);
    const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=105600&key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(id)}&l=english`;
    window.open(url, "_blank", "noopener");
    steamSyncResult.textContent = "";
  });

  document.getElementById("importSteamJsonBtn").addEventListener("click", () => {
    const raw = steamPasteBox.value.trim();
    if (!raw) {
      steamSyncResult.textContent = "Paste the JSON from the Steam tab first.";
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      steamSyncResult.textContent = "That doesn't look like valid JSON.";
      return;
    }
    const achievements = data?.playerstats?.achievements;
    if (!data?.playerstats?.success || !Array.isArray(achievements)) {
      const err = data?.playerstats?.error;
      steamSyncResult.textContent = err
        ? `Steam returned an error: ${err}`
        : "Couldn't find achievement data in that JSON.";
      return;
    }

    let matched = 0;
    let newlyDone = 0;
    let unmatched = 0;
    achievements.forEach((entry) => {
      if (!entry.achieved) return;
      const label = entry.name || entry.apiname || "";
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
