import { config } from "./config.js";
import { NEIGHBORHOODS_BCN, normalizeNeighborhoodSlugs } from "./neighborhoods.js";

const SESSION_KEY = "casahunt.session";
const $ = (sel) => document.querySelector(sel);

// ── Indexes over the neighborhood data ─────────────────────────────────────

const BY_SLUG = new Map(NEIGHBORHOODS_BCN.map((n) => [n.slug, n]));
const DISTRICTS = (() => {
  const map = new Map();
  for (const n of NEIGHBORHOODS_BCN) {
    if (!map.has(n.district)) map.set(n.district, []);
    map.get(n.district).push(n);
  }
  return [...map.entries()].map(([district, items]) => ({
    type: "district",
    slug: "district:" + districtSlug(district),
    name: district,
    items,
    search: (district + " " + items.map((n) => n.name).join(" ")).toLowerCase(),
  }));
})();

function districtSlug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Flat searchable index (districts + neighborhoods).
const ALL_LOCATIONS = [
  ...DISTRICTS,
  ...NEIGHBORHOODS_BCN.map((n) => ({
    type: "neighborhood",
    slug: n.slug,
    name: n.name,
    district: n.district,
    search: (n.name + " " + n.district).toLowerCase(),
  })),
];

// ── Session plumbing ────────────────────────────────────────────────────────

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
function setSession(s) {
  if (!s) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function show(view) {
  $("#auth").hidden = view !== "auth";
  $("#filters").hidden = view !== "filters";
  $("#settings").hidden = view !== "settings";
  $("#settings-btn").hidden = view === "auth";
}

const fnUrl   = (name) => `${config.supabaseUrl}/functions/v1/${name}`;
const restUrl = (path) => `${config.supabaseUrl}/rest/v1/${path}`;

async function callFn(name, body) {
  const res = await fetch(fnUrl(name), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${config.supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function callRest(path, { method = "GET", body, session } = {}) {
  const res = await fetch(restUrl(path), {
    method,
    headers: {
      "content-type": "application/json",
      "accept-profile": "casahunt",
      "content-profile": "casahunt",
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${config.supabaseAnonKey}`,
      "x-session-token": session?.token || "",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── Auth ────────────────────────────────────────────────────────────────────

const authMsg = $("#auth-msg");
$("#send-code").addEventListener("click", async () => {
  authMsg.className = "msg"; authMsg.textContent = "";
  try {
    const chat_id = Number($("#chat-id").value);
    if (!chat_id) throw new Error("chat id required");
    await callFn("casahunt-auth-request-code", { chat_id });
    authMsg.textContent = "Code sent to Telegram.";
  } catch (e) { authMsg.className = "msg error"; authMsg.textContent = String(e.message || e); }
});

$("#verify-code").addEventListener("click", async () => {
  authMsg.className = "msg"; authMsg.textContent = "";
  try {
    const chat_id = Number($("#chat-id").value);
    const code = $("#code").value.trim();
    const session = await callFn("casahunt-auth-verify-code", { chat_id, code });
    setSession(session);
    localStorage.setItem("casahunt.chat_id", String(chat_id));
    await renderFilters();
    show("filters");
  } catch (e) { authMsg.className = "msg error"; authMsg.textContent = String(e.message || e); }
});

$("#sign-out").addEventListener("click", () => { setSession(null); show("auth"); });

// ── Settings ────────────────────────────────────────────────────────────────

$("#settings-btn").addEventListener("click", () => {
  const session = getSession();
  if (session) {
    // Extract chat_id from the session — we stored it when we logged in.
    const chatId = localStorage.getItem("casahunt.chat_id") || "—";
    $("#settings-chat-id").textContent = chatId;
    $("#settings-connected").hidden = false;
    $("#settings-disconnected").hidden = true;
  } else {
    $("#settings-connected").hidden = true;
    $("#settings-disconnected").hidden = false;
  }
  show("settings");
});

$("#settings-back").addEventListener("click", async () => {
  const session = getSession();
  if (session && new Date(session.expires_at) > new Date()) {
    await renderFilters();
    show("filters");
  } else {
    show("auth");
  }
});

$("#settings-disconnect").addEventListener("click", () => {
  setSession(null);
  localStorage.removeItem("casahunt.chat_id");
  show("auth");
});

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtPriceRange(f) {
  if (f.price_min && f.price_max) return `€${f.price_min}–${f.price_max}`;
  if (f.price_max) return `≤ €${f.price_max}`;
  if (f.price_min) return `≥ €${f.price_min}`;
  return null;
}
function fmtRoomsRange(f) {
  if (f.rooms_min && f.rooms_max) return `${f.rooms_min}–${f.rooms_max} hab`;
  if (f.rooms_min) return `${f.rooms_min}+ hab`;
  if (f.rooms_max) return `≤${f.rooms_max} hab`;
  return null;
}
function fmtSizeRange(f) {
  if (f.size_min_m2 && f.size_max_m2) return `${f.size_min_m2}–${f.size_max_m2} m²`;
  if (f.size_max_m2) return `≤${f.size_max_m2} m²`;
  if (f.size_min_m2) return `≥${f.size_min_m2} m²`;
  return null;
}

// Collapse selected neighborhood slugs back into a mix of full districts + stray neighborhoods.
function collapseLocations(slugs) {
  const set = new Set(slugs);
  const districts = [];
  const leftover = [];
  for (const d of DISTRICTS) {
    const all = d.items.map((i) => i.slug);
    const allIn = all.every((s) => set.has(s));
    if (allIn && all.length) {
      districts.push(d.name);
      all.forEach((s) => set.delete(s));
    }
  }
  for (const s of set) {
    const n = BY_SLUG.get(s);
    if (n) leftover.push(n.name);
  }
  return { districts, neighborhoods: leftover };
}

function fmtLocations(f, max = 4) {
  const slugs = f.neighborhoods || [];
  if (!slugs.length) return "all locations";
  const { districts, neighborhoods } = collapseLocations(slugs);
  const parts = [...districts.map((n) => n), ...neighborhoods];
  if (!parts.length) return "all locations";
  if (parts.length <= max) return parts.join(", ");
  return `${parts.slice(0, max).join(", ")} +${parts.length - max} more`;
}

function pill(text, { muted = false } = {}) {
  const span = document.createElement("span");
  span.className = "pill" + (muted ? " muted" : "");
  span.textContent = text;
  return span;
}

// ── Filter list ─────────────────────────────────────────────────────────────

function renderFilterRow(f) {
  const row = document.createElement("div");
  row.className = "filter-row";
  row.dataset.id = f.id;

  const main = document.createElement("div");
  main.className = "filter-main";

  const title = document.createElement("div");
  title.className = "filter-name";
  title.textContent = f.name || "(untitled)";
  main.appendChild(title);

  const summary = document.createElement("div");
  summary.className = "filter-summary";

  summary.appendChild(pill(f.city, { muted: true }));
  summary.appendChild(pill((f.sources || []).join(" + "), { muted: false }));
  [fmtPriceRange(f), fmtRoomsRange(f), fmtSizeRange(f)]
    .filter(Boolean)
    .forEach((t) => summary.appendChild(pill(t, { muted: false })));
  summary.appendChild(pill(fmtLocations(f), { muted: true }));

  main.appendChild(summary);
  row.appendChild(main);

  const actions = document.createElement("div");
  actions.className = "filter-row-actions";

  const edit = document.createElement("button");
  edit.textContent = "Edit";
  edit.className = "green";
  edit.addEventListener("click", () => openEditDialog(f));
  actions.appendChild(edit);

  const del = document.createElement("button");
  del.textContent = "Delete";
  del.className = "danger";
  del.addEventListener("click", () => deleteFilter(f.id));
  actions.appendChild(del);

  row.appendChild(actions);
  return row;
}

async function renderFilters() {
  const session = getSession();
  const list = $("#filters-list");
  list.textContent = "Loading…";
  try {
    const rows = await callRest("filters?select=*&order=id", { session });
    list.innerHTML = "";
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "msg";
      p.textContent = "No filters yet. Click + New filter to create one.";
      list.appendChild(p);
      return;
    }
    rows.forEach((f) => list.appendChild(renderFilterRow(f)));
  } catch (e) {
    list.innerHTML = "";
    const p = document.createElement("p");
    p.className = "msg error"; p.textContent = e.message;
    list.appendChild(p);
  }
}

// ── Create / delete ─────────────────────────────────────────────────────────

$("#add-filter").addEventListener("click", async () => {
  const session = getSession();
  try {
    const [created] = await callRest("filters", {
      method: "POST",
      body: { name: "new filter", city: "barcelona", sources: ["idealista"] },
      session,
    });
    await renderFilters();
    if (created) openEditDialog(created);
  } catch (e) { alert(e.message); }
});

async function deleteFilter(id) {
  if (!confirm("Delete this filter?")) return;
  const session = getSession();
  try {
    await callRest(`filters?id=eq.${id}`, { method: "DELETE", session });
    await renderFilters();
  } catch (e) { alert(e.message); }
}

// ── Edit dialog ─────────────────────────────────────────────────────────────

const dlg      = $("#edit-dialog");
const dlgForm  = $("#edit-form");
const dlgTitle = $("#dlg-title");
const dlgMsg   = $("#dlg-msg");

let editingId = null;
let selectedSlugs = new Set();   // ← canonical state: neighborhood slugs

function openEditDialog(f) {
  editingId = f.id;
  dlgTitle.textContent = `Edit · ${f.name || "filter"}`;
  dlgMsg.textContent = "";

  dlgForm.elements.name.value         = f.name || "";
  dlgForm.elements.city.value         = f.city || "barcelona";
  dlgForm.elements.price_min.value    = f.price_min   ?? "";
  dlgForm.elements.price_max.value    = f.price_max   ?? "";
  dlgForm.elements.rooms_min.value    = f.rooms_min   ?? "";
  dlgForm.elements.rooms_max.value    = f.rooms_max   ?? "";
  dlgForm.elements.size_min_m2.value  = f.size_min_m2 ?? "";
  dlgForm.elements.size_max_m2.value  = f.size_max_m2 ?? "";

  const srcs = new Set(f.sources || []);
  dlgForm.querySelectorAll('input[name="sources"]').forEach((cb) => { cb.checked = srcs.has(cb.value); });

  selectedSlugs = new Set(normalizeNeighborhoodSlugs(f.neighborhoods));
  renderLocationChips();
  locInput.value = "";
  locDropdown.hidden = true;

  dlg.showModal();
}

dlg.addEventListener("click", (e) => { if (e.target.dataset?.act === "close") dlg.close(); });

dlgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const fd = new FormData(dlgForm);
  const patch = {
    name:          (fd.get("name") || "").toString().trim() || "untitled",
    city:          (fd.get("city") || "barcelona").toString().trim(),
    enabled:       true,
    price_min:     numOrNull(fd.get("price_min")),
    price_max:     numOrNull(fd.get("price_max")),
    rooms_min:     numOrNull(fd.get("rooms_min")),
    rooms_max:     numOrNull(fd.get("rooms_max")),
    size_min_m2:   numOrNull(fd.get("size_min_m2")),
    size_max_m2:   numOrNull(fd.get("size_max_m2")),
    sources:       fd.getAll("sources"),
    neighborhoods: [...selectedSlugs],
  };

  if (!patch.sources.length) {
    dlgMsg.className = "msg error"; dlgMsg.textContent = "Pick at least one source.";
    return;
  }

  dlgMsg.className = "msg"; dlgMsg.textContent = "Saving…";
  try {
    await callRest(`filters?id=eq.${editingId}`, { method: "PATCH", body: patch, session: getSession() });
    dlg.close();
    await renderFilters();
  } catch (err) { dlgMsg.className = "msg error"; dlgMsg.textContent = err.message; }
});

function numOrNull(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Location search (Idealista-style autocomplete) ─────────────────────────

const locWrap     = $("#loc-wrap");
const locInput    = $("#loc-input");
const locChips    = $("#loc-chips");
const locDropdown = $("#loc-dropdown");
let   activeIdx   = -1;

function renderLocationChips() {
  locChips.innerHTML = "";
  const { districts, neighborhoods } = collapseSelected();

  for (const d of districts) {
    locChips.appendChild(makeChip(d.name, () => removeDistrict(d)));
  }
  for (const n of neighborhoods) {
    locChips.appendChild(makeChip(n.name, () => { selectedSlugs.delete(n.slug); renderLocationChips(); renderLocDropdown(locInput.value); }));
  }
}

function makeChip(label, onRemove) {
  const chip = document.createElement("span");
  chip.className = "loc-chip";
  const text = document.createElement("span");
  text.textContent = label;
  chip.appendChild(text);
  const x = document.createElement("button");
  x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove");
  x.addEventListener("click", (e) => { e.stopPropagation(); onRemove(); });
  chip.appendChild(x);
  return chip;
}

function collapseSelected() {
  // Returns which districts are fully selected + remaining stray neighborhoods.
  const remaining = new Set(selectedSlugs);
  const districts = [];
  for (const d of DISTRICTS) {
    const slugs = d.items.map((i) => i.slug);
    if (slugs.every((s) => remaining.has(s))) {
      districts.push(d);
      slugs.forEach((s) => remaining.delete(s));
    }
  }
  const neighborhoods = [...remaining].map((s) => BY_SLUG.get(s)).filter(Boolean);
  return { districts, neighborhoods };
}

function removeDistrict(d) {
  d.items.forEach((i) => selectedSlugs.delete(i.slug));
  renderLocationChips();
  renderLocDropdown(locInput.value);
}

function isDistrictFullySelected(d) {
  return d.items.every((i) => selectedSlugs.has(i.slug));
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) + "<mark>" + escapeHtml(text.slice(idx, idx + q.length)) + "</mark>" + escapeHtml(text.slice(idx + q.length));
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderLocDropdown(query) {
  const q = query.trim().toLowerCase();

  const results = ALL_LOCATIONS.filter((loc) => {
    if (loc.type === "district") return isDistrictFullySelected(loc) === false && (!q || loc.search.includes(q));
    return !selectedSlugs.has(loc.slug) && (!q || loc.search.includes(q));
  });

  // Sort: districts first, then neighborhoods; exact prefix matches rank higher within each.
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "district" ? -1 : 1;
    const aStart = q && a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStart = q && b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStart !== bStart) return aStart - bStart;
    return a.name.localeCompare(b.name);
  });

  const top = results.slice(0, 20);
  activeIdx = top.length ? 0 : -1;
  locDropdown.innerHTML = "";

  if (!top.length) {
    const empty = document.createElement("div");
    empty.className = "loc-empty";
    empty.textContent = q ? "No matches." : "Start typing…";
    locDropdown.appendChild(empty);
  } else {
    top.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "loc-result" + (i === activeIdx ? " active" : "");
      row.dataset.idx = i;

      const name = document.createElement("div");
      name.className = "loc-result-name";
      const typeBadge = `<span class="loc-result-type ${r.type}">${r.type === "district" ? "District" : "Neighborhood"}</span>`;
      name.innerHTML = typeBadge + highlight(r.name, q);
      row.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "loc-result-meta";
      if (r.type === "district") meta.textContent = `${r.items.length} neighborhoods`;
      else meta.textContent = r.district;
      row.appendChild(meta);

      row.addEventListener("mousedown", (e) => { e.preventDefault(); pickLocation(r); });
      locDropdown.appendChild(row);
    });
  }

  locDropdown.hidden = false;
}

function pickLocation(r) {
  if (r.type === "district") {
    r.items.forEach((i) => selectedSlugs.add(i.slug));
  } else {
    selectedSlugs.add(r.slug);
  }
  locInput.value = "";
  renderLocationChips();
  locDropdown.hidden = true;
  locInput.focus();
}

locInput.addEventListener("focus", () => {
  locWrap.classList.add("focus");
  // Only open the dropdown if there's something typed.
  if (locInput.value.trim()) renderLocDropdown(locInput.value);
});
locInput.addEventListener("blur", () => {
  locWrap.classList.remove("focus");
  setTimeout(() => { locDropdown.hidden = true; }, 150);
});
locInput.addEventListener("input", (e) => {
  const v = e.target.value;
  if (!v.trim()) { locDropdown.hidden = true; return; }
  renderLocDropdown(v);
});

locInput.addEventListener("keydown", (e) => {
  const rows = locDropdown.querySelectorAll(".loc-result");
  if (!rows.length && e.key !== "Backspace") return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx = Math.min(activeIdx + 1, rows.length - 1);
    rows.forEach((r, i) => r.classList.toggle("active", i === activeIdx));
    rows[activeIdx]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx = Math.max(activeIdx - 1, 0);
    rows.forEach((r, i) => r.classList.toggle("active", i === activeIdx));
    rows[activeIdx]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    if (activeIdx >= 0 && rows[activeIdx]) {
      e.preventDefault();
      rows[activeIdx].dispatchEvent(new MouseEvent("mousedown"));
    }
  } else if (e.key === "Escape") {
    locDropdown.hidden = true;
  } else if (e.key === "Backspace" && !locInput.value) {
    // Remove last chip
    const { districts, neighborhoods } = collapseSelected();
    if (neighborhoods.length) selectedSlugs.delete(neighborhoods[neighborhoods.length - 1].slug);
    else if (districts.length) districts[districts.length - 1].items.forEach((i) => selectedSlugs.delete(i.slug));
    renderLocationChips();
    renderLocDropdown(locInput.value);
  }
});

locWrap.addEventListener("click", (e) => {
  if (e.target === locWrap || e.target === locChips) locInput.focus();
});

// ── Boot ────────────────────────────────────────────────────────────────────

(async function boot() {
  const session = getSession();
  if (session && new Date(session.expires_at) > new Date()) {
    await renderFilters();
    show("filters");
  } else {
    show("auth");
  }
})();
