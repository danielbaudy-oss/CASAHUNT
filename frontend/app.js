import { config } from "./config.js";
import { NEIGHBORHOODS_BCN, normalizeNeighborhoodSlugs } from "./neighborhoods.js";

const SESSION_KEY = "casahunt.session";

const $ = (sel) => document.querySelector(sel);
const authSection = $("#auth");
const filtersSection = $("#filters");
const authMsg = $("#auth-msg");

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
  authSection.hidden = view !== "auth";
  filtersSection.hidden = view !== "filters";
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

// ── Auth flow ───────────────────────────────────────────────────────────────

$("#send-code").addEventListener("click", async () => {
  authMsg.className = "msg"; authMsg.textContent = "";
  try {
    const chat_id = Number($("#chat-id").value);
    if (!chat_id) throw new Error("chat id required");
    await callFn("casahunt-auth-request-code", { chat_id });
    authMsg.textContent = "Code sent to Telegram.";
  } catch (e) {
    authMsg.className = "msg error";
    authMsg.textContent = String(e.message || e);
  }
});

$("#verify-code").addEventListener("click", async () => {
  authMsg.className = "msg"; authMsg.textContent = "";
  try {
    const chat_id = Number($("#chat-id").value);
    const code = $("#code").value.trim();
    const session = await callFn("casahunt-auth-verify-code", { chat_id, code });
    setSession(session);
    await renderFilters();
    show("filters");
  } catch (e) {
    authMsg.className = "msg error";
    authMsg.textContent = String(e.message || e);
  }
});

$("#sign-out").addEventListener("click", () => { setSession(null); show("auth"); });

// ── Filter list rendering ───────────────────────────────────────────────────

function fmtPriceRange(f) {
  if (f.price_min && f.price_max) return `€${f.price_min}–${f.price_max}`;
  if (f.price_max) return `≤ €${f.price_max}`;
  if (f.price_min) return `≥ €${f.price_min}`;
  return "€ any";
}
function fmtRoomsRange(f) {
  if (f.rooms_min && f.rooms_max) return `${f.rooms_min}–${f.rooms_max} hab`;
  if (f.rooms_min) return `${f.rooms_min}+ hab`;
  if (f.rooms_max) return `≤${f.rooms_max} hab`;
  return "any rooms";
}
function fmtSizeRange(f) {
  if (f.size_min_m2 && f.size_max_m2) return `${f.size_min_m2}–${f.size_max_m2} m²`;
  if (f.size_max_m2) return `≤${f.size_max_m2} m²`;
  if (f.size_min_m2) return `≥${f.size_min_m2} m²`;
  return "any size";
}
function fmtNbCount(f) {
  const n = (f.neighborhoods || []).length;
  return n ? `${n} neighborhood${n === 1 ? "" : "s"}` : "all neighborhoods";
}
function fmtSources(f) {
  const s = f.sources || [];
  if (!s.length) return "no sources";
  return s.join(" + ");
}

function renderFilterRow(f) {
  const row = document.createElement("div");
  row.className = "filter-row" + (f.enabled ? "" : " disabled");
  row.dataset.id = f.id;

  const main = document.createElement("div");
  main.className = "filter-main";

  const title = document.createElement("div");
  title.className = "filter-name";
  title.textContent = f.name || "(untitled)";
  main.appendChild(title);

  const summary = document.createElement("div");
  summary.className = "filter-summary";
  summary.textContent = [
    f.city,
    fmtSources(f),
    fmtPriceRange(f),
    fmtRoomsRange(f),
    fmtSizeRange(f),
    fmtNbCount(f),
    f.enabled ? null : "disabled",
  ].filter(Boolean).join(" · ");
  main.appendChild(summary);

  row.appendChild(main);

  const actions = document.createElement("div");
  actions.className = "filter-row-actions";

  const edit = document.createElement("button");
  edit.textContent = "Edit";
  edit.className = "secondary";
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
    p.className = "msg error";
    p.textContent = e.message;
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
  } catch (e) {
    alert(e.message);
  }
});

async function deleteFilter(id) {
  if (!confirm("Delete this filter?")) return;
  const session = getSession();
  try {
    await callRest(`filters?id=eq.${id}`, { method: "DELETE", session });
    await renderFilters();
  } catch (e) {
    alert(e.message);
  }
}

// ── Edit dialog ─────────────────────────────────────────────────────────────

const dlg       = $("#edit-dialog");
const dlgForm   = $("#edit-form");
const dlgTitle  = $("#dlg-title");
const dlgMsg    = $("#dlg-msg");

let editingId = null;
let selectedNeighborhoods = new Set();

function openEditDialog(f) {
  editingId = f.id;
  dlgTitle.textContent = `Edit · ${f.name || "filter"}`;
  dlgMsg.textContent = "";

  dlgForm.elements.name.value         = f.name || "";
  dlgForm.elements.city.value         = f.city || "barcelona";
  dlgForm.elements.enabled.checked    = !!f.enabled;
  dlgForm.elements.price_min.value    = f.price_min   ?? "";
  dlgForm.elements.price_max.value    = f.price_max   ?? "";
  dlgForm.elements.rooms_min.value    = f.rooms_min   ?? "";
  dlgForm.elements.rooms_max.value    = f.rooms_max   ?? "";
  dlgForm.elements.size_min_m2.value  = f.size_min_m2 ?? "";
  dlgForm.elements.size_max_m2.value  = f.size_max_m2 ?? "";

  const srcs = new Set(f.sources || []);
  dlgForm.querySelectorAll('input[name="sources"]').forEach((cb) => {
    cb.checked = srcs.has(cb.value);
  });

  selectedNeighborhoods = new Set(normalizeNeighborhoodSlugs(f.neighborhoods));
  renderChips();
  $("#nb-search").value = "";
  renderNbResults("");

  dlg.showModal();
}

dlg.addEventListener("click", (e) => {
  const act = e.target.dataset?.act;
  if (act === "close") { dlg.close(); }
});

dlgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const fd = new FormData(dlgForm);
  const patch = {
    name:        (fd.get("name") || "").toString().trim() || "untitled",
    city:        (fd.get("city") || "barcelona").toString().trim(),
    enabled:     !!fd.get("enabled"),
    price_min:   numOrNull(fd.get("price_min")),
    price_max:   numOrNull(fd.get("price_max")),
    rooms_min:   numOrNull(fd.get("rooms_min")),
    rooms_max:   numOrNull(fd.get("rooms_max")),
    size_min_m2: numOrNull(fd.get("size_min_m2")),
    size_max_m2: numOrNull(fd.get("size_max_m2")),
    sources:     fd.getAll("sources"),
    neighborhoods: [...selectedNeighborhoods],
  };

  if (!patch.sources.length) {
    dlgMsg.className = "msg error";
    dlgMsg.textContent = "Pick at least one source.";
    return;
  }

  dlgMsg.className = "msg";
  dlgMsg.textContent = "Saving…";
  try {
    await callRest(`filters?id=eq.${editingId}`, { method: "PATCH", body: patch, session: getSession() });
    dlg.close();
    await renderFilters();
  } catch (err) {
    dlgMsg.className = "msg error";
    dlgMsg.textContent = err.message;
  }
});

function numOrNull(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Neighborhood picker ─────────────────────────────────────────────────────

const nbSearch  = $("#nb-search");
const nbResults = $("#nb-results");
const nbChips   = $("#nb-chips");

function renderChips() {
  nbChips.innerHTML = "";
  if (!selectedNeighborhoods.size) {
    const span = document.createElement("span");
    span.className = "msg";
    span.textContent = "(none — whole city)";
    nbChips.appendChild(span);
    return;
  }
  for (const slug of selectedNeighborhoods) {
    const n = NEIGHBORHOODS_BCN.find((x) => x.slug === slug);
    if (!n) continue;
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${n.name}</span><button type="button" aria-label="Remove">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      selectedNeighborhoods.delete(slug);
      renderChips();
      renderNbResults(nbSearch.value);
    });
    nbChips.appendChild(chip);
  }
}

function renderNbResults(query) {
  const q = query.trim().toLowerCase();
  const matches = NEIGHBORHOODS_BCN
    .filter((n) => {
      if (selectedNeighborhoods.has(n.slug)) return false;
      if (!q) return true;
      return n.name.toLowerCase().includes(q) || n.district.toLowerCase().includes(q);
    })
    .slice(0, 12);

  nbResults.innerHTML = "";
  if (!matches.length) { nbResults.hidden = true; return; }
  for (const n of matches) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${n.name}</strong><span class="msg">${n.district}</span>`;
    li.addEventListener("click", () => {
      selectedNeighborhoods.add(n.slug);
      renderChips();
      nbSearch.value = "";
      renderNbResults("");
      nbSearch.focus();
    });
    nbResults.appendChild(li);
  }
  nbResults.hidden = false;
}

nbSearch.addEventListener("focus", () => renderNbResults(nbSearch.value));
nbSearch.addEventListener("input", () => renderNbResults(nbSearch.value));
nbSearch.addEventListener("blur", () => {
  // Delay so click on a result still fires first.
  setTimeout(() => { nbResults.hidden = true; }, 150);
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
