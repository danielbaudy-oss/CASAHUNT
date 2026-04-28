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
function fmtNbList(f, max = 4) {
  const slugs = f.neighborhoods || [];
  if (!slugs.length) return "all neighborhoods";
  const names = slugs
    .map((s) => NEIGHBORHOODS_BCN.find((n) => n.slug === s)?.name)
    .filter(Boolean);
  if (!names.length) return "all neighborhoods";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

function pill(text, { muted = false } = {}) {
  const span = document.createElement("span");
  span.className = "pill" + (muted ? " muted" : "");
  span.textContent = text;
  return span;
}

// ── Filter list rendering ───────────────────────────────────────────────────

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

  const parts = [];
  parts.push({ text: f.city, muted: true });
  parts.push({ text: (f.sources || []).join(" + "), muted: false });
  [fmtPriceRange(f), fmtRoomsRange(f), fmtSizeRange(f)]
    .filter(Boolean)
    .forEach((t) => parts.push({ text: t, muted: false }));
  parts.push({ text: fmtNbList(f), muted: true });
  if (!f.enabled) parts.push({ text: "disabled", muted: true });

  parts.forEach((p) => summary.appendChild(pill(p.text, { muted: p.muted })));
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

const dlg      = $("#edit-dialog");
const dlgForm  = $("#edit-form");
const dlgTitle = $("#dlg-title");
const dlgMsg   = $("#dlg-msg");

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
  renderNbTree();
  $("#nb-filter").value = "";
  applyNbFilter("");
  updateNbCount();

  dlg.showModal();
}

dlg.addEventListener("click", (e) => {
  if (e.target.dataset?.act === "close") dlg.close();
});

dlgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const fd = new FormData(dlgForm);
  const patch = {
    name:          (fd.get("name") || "").toString().trim() || "untitled",
    city:          (fd.get("city") || "barcelona").toString().trim(),
    enabled:       !!fd.get("enabled"),
    price_min:     numOrNull(fd.get("price_min")),
    price_max:     numOrNull(fd.get("price_max")),
    rooms_min:     numOrNull(fd.get("rooms_min")),
    rooms_max:     numOrNull(fd.get("rooms_max")),
    size_min_m2:   numOrNull(fd.get("size_min_m2")),
    size_max_m2:   numOrNull(fd.get("size_max_m2")),
    sources:       fd.getAll("sources"),
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

// ── Neighborhood picker (unfolded tree, grouped by district) ───────────────

const CHEVRON = `<svg class="nb-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function groupedByDistrict() {
  const map = new Map();
  for (const n of NEIGHBORHOODS_BCN) {
    if (!map.has(n.district)) map.set(n.district, []);
    map.get(n.district).push(n);
  }
  return map;
}

function renderNbTree() {
  const tree = $("#nb-tree");
  tree.innerHTML = "";
  const grouped = groupedByDistrict();

  for (const [district, items] of grouped) {
    const box = document.createElement("div");
    box.className = "nb-district";
    box.dataset.district = district;

    const head = document.createElement("div");
    head.className = "nb-district-head";

    const nameEl = document.createElement("span");
    nameEl.className = "nb-district-name";
    nameEl.innerHTML = `${CHEVRON}${district}`;

    const meta = document.createElement("span");
    meta.className = "nb-district-meta";
    meta.dataset.role = "district-meta";

    head.appendChild(nameEl);
    head.appendChild(meta);
    head.addEventListener("click", () => box.classList.toggle("collapsed"));
    box.appendChild(head);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "nb-district-items";
    items.forEach((n) => {
      const lbl = document.createElement("label");
      lbl.className = "nb-item";
      lbl.dataset.slug = n.slug;
      lbl.dataset.search = (n.name + " " + n.district).toLowerCase();

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selectedNeighborhoods.has(n.slug);
      cb.addEventListener("change", () => {
        if (cb.checked) selectedNeighborhoods.add(n.slug);
        else selectedNeighborhoods.delete(n.slug);
        updateNbCount();
        updateDistrictMeta(box, items);
      });

      const txt = document.createElement("span");
      txt.textContent = n.name;

      lbl.appendChild(cb);
      lbl.appendChild(txt);
      itemsWrap.appendChild(lbl);
    });
    box.appendChild(itemsWrap);

    tree.appendChild(box);
    updateDistrictMeta(box, items);
  }
}

function updateDistrictMeta(box, items) {
  const total = items.length;
  const selected = items.filter((n) => selectedNeighborhoods.has(n.slug)).length;
  const meta = box.querySelector('[data-role="district-meta"]');
  meta.textContent = selected ? `${selected}/${total}` : `${total}`;
}

function updateNbCount() {
  const el = $("#nb-count");
  const n = selectedNeighborhoods.size;
  el.textContent = n ? `${n} selected` : "whole city";
}

function applyNbFilter(q) {
  const needle = q.trim().toLowerCase();
  document.querySelectorAll(".nb-district").forEach((box) => {
    let visibleCount = 0;
    box.querySelectorAll(".nb-item").forEach((item) => {
      const match = !needle || item.dataset.search.includes(needle);
      item.classList.toggle("hidden", !match);
      if (match) visibleCount++;
    });
    box.classList.toggle("empty", visibleCount === 0);
    // When filtering, auto-expand matches; when cleared, leave state as-is.
    if (needle && visibleCount > 0) box.classList.remove("collapsed");
  });
}

$("#nb-filter").addEventListener("input", (e) => applyNbFilter(e.target.value));

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
