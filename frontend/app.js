import { config } from "./config.js";

const SESSION_KEY = "casahunt.session";

const $ = (sel) => document.querySelector(sel);
const authSection = $("#auth");
const filtersSection = $("#filters");
const authMsg = $("#auth-msg");

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

const fnUrl  = (name) => `${config.supabaseUrl}/functions/v1/${name}`;
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

// ── Auth flow ────────────────────────────────────────────────────────────────

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

$("#sign-out").addEventListener("click", () => {
  setSession(null);
  show("auth");
});

// ── Filters ──────────────────────────────────────────────────────────────────

const FIELDS = [
  { key: "name",          label: "Name",          type: "text"   },
  { key: "city",           label: "City",          type: "text"   },
  { key: "source",         label: "Source",        type: "select", options: ["idealista", "fotocasa"] },
  { key: "price_min",      label: "Min €",         type: "number" },
  { key: "price_max",      label: "Max €",         type: "number" },
  { key: "rooms_min",      label: "Min rooms",     type: "number" },
  { key: "rooms_max",      label: "Max rooms",     type: "number" },
  { key: "size_min_m2",    label: "Min m²",        type: "number" },
  { key: "size_max_m2",    label: "Max m²",        type: "number" },
  { key: "neighborhoods",  label: "Neighborhoods", type: "csv"    },
  { key: "enabled",        label: "Enabled",       type: "bool"   },
];

function renderFilterCard(f) {
  const el = document.createElement("div");
  el.className = "filter";
  el.dataset.id = f.id;

  const title = document.createElement("div");
  title.className = "filter-title";
  title.textContent = `${f.name} · ${f.city} · ${f.source}`;
  el.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "filter-grid";
  for (const fld of FIELDS) {
    const wrap = document.createElement("label");
    wrap.textContent = fld.label;

    let input;
    if (fld.type === "select") {
      input = document.createElement("select");
      for (const opt of fld.options) {
        const o = document.createElement("option");
        o.value = opt; o.textContent = opt;
        if (f[fld.key] === opt) o.selected = true;
        input.appendChild(o);
      }
    } else if (fld.type === "bool") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!f[fld.key];
    } else {
      input = document.createElement("input");
      input.type = fld.type === "number" ? "number" : "text";
      if (fld.type === "csv") {
        input.value = (f.neighborhoods || []).join(", ");
      } else {
        input.value = f[fld.key] ?? "";
      }
    }
    input.dataset.key = fld.key;
    input.dataset.type = fld.type;
    wrap.appendChild(input);
    grid.appendChild(wrap);
  }
  el.appendChild(grid);

  const actions = document.createElement("div");
  actions.className = "filter-actions";

  const save = document.createElement("button");
  save.textContent = "Save";
  save.addEventListener("click", () => saveFilter(f.id, el));
  actions.appendChild(save);

  const del = document.createElement("button");
  del.textContent = "Delete";
  del.className = "danger";
  del.addEventListener("click", () => deleteFilter(f.id));
  actions.appendChild(del);

  const status = document.createElement("span");
  status.className = "msg";
  status.dataset.role = "status";
  actions.appendChild(status);

  el.appendChild(actions);
  return el;
}

function readCard(el) {
  const patch = {};
  el.querySelectorAll("[data-key]").forEach((inp) => {
    const key = inp.dataset.key;
    const type = inp.dataset.type;
    if (type === "bool") patch[key] = inp.checked;
    else if (type === "number") patch[key] = inp.value === "" ? null : Number(inp.value);
    else if (type === "csv") {
      patch[key] = inp.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      patch[key] = inp.value === "" ? null : inp.value;
    }
  });
  return patch;
}

function setStatus(el, text, kind = "") {
  const s = el.querySelector('[data-role="status"]');
  s.className = "msg" + (kind ? " " + kind : "");
  s.textContent = text;
  if (text) setTimeout(() => { if (s.textContent === text) s.textContent = ""; }, 2500);
}

async function saveFilter(id, el) {
  const session = getSession();
  const patch = readCard(el);
  setStatus(el, "Saving…");
  try {
    await callRest(`filters?id=eq.${id}`, { method: "PATCH", body: patch, session });
    setStatus(el, "Saved ✓", "ok");
  } catch (e) {
    setStatus(el, e.message, "error");
  }
}

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
      p.textContent = "No filters yet. Click Add filter to create one.";
      list.appendChild(p);
      return;
    }
    rows.forEach((f) => list.appendChild(renderFilterCard(f)));
  } catch (e) {
    list.innerHTML = "";
    const p = document.createElement("p");
    p.className = "msg error";
    p.textContent = e.message;
    list.appendChild(p);
  }
}

$("#add-filter").addEventListener("click", async () => {
  const session = getSession();
  try {
    await callRest("filters", {
      method: "POST",
      body: {
        name: "new filter",
        city: "barcelona",
        source: "idealista",
      },
      session,
    });
    await renderFilters();
  } catch (e) {
    alert(e.message);
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  const session = getSession();
  if (session && new Date(session.expires_at) > new Date()) {
    await renderFilters();
    show("filters");
  } else {
    show("auth");
  }
})();
