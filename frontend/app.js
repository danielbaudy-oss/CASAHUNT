import { config } from "./config.js";

const SESSION_KEY = "casahunt.session";

const $ = (sel) => document.querySelector(sel);
const authSection = $("#auth");
const filtersSection = $("#filters");
const authMsg = $("#auth-msg");

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}
function setSession(s) {
  if (!s) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function show(view) {
  authSection.hidden = view !== "auth";
  filtersSection.hidden = view !== "filters";
}

function api(path) {
  return `${config.supabaseUrl}/functions/v1/${path}`;
}
function rest(path) {
  return `${config.supabaseUrl}/rest/v1/${path}`;
}

async function callFn(name, body) {
  const res = await fetch(api(name), {
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
  const res = await fetch(rest(path), {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── Auth flow ────────────────────────────────────────────────────────────────

$("#send-code").addEventListener("click", async () => {
  authMsg.className = "msg";
  authMsg.textContent = "";
  try {
    const chat_id = Number($("#chat-id").value);
    if (!chat_id) throw new Error("chat id required");
    await callFn("auth-request-code", { chat_id });
    authMsg.textContent = "Code sent to Telegram.";
  } catch (e) {
    authMsg.className = "msg error";
    authMsg.textContent = String(e.message || e);
  }
});

$("#verify-code").addEventListener("click", async () => {
  authMsg.className = "msg";
  authMsg.textContent = "";
  try {
    const chat_id = Number($("#chat-id").value);
    const code = $("#code").value.trim();
    const session = await callFn("auth-verify-code", { chat_id, code });
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

async function renderFilters() {
  const session = getSession();
  const list = $("#filters-list");
  list.innerHTML = "Loading…";
  try {
    const rows = await callRest("filters?select=*&order=id", { session });
    if (!rows.length) {
      list.innerHTML = "<p class='msg'>No filters yet.</p>";
      return;
    }
    list.innerHTML = rows
      .map(
        (f) => `
      <div class="filter">
        <strong>${f.name}</strong> · ${f.city} · ${f.source}
        <div class="msg">
          ${f.price_min ?? "—"}–${f.price_max ?? "—"} € ·
          ${f.rooms_min ?? "—"}+ hab ·
          ≤${f.size_max_m2 ?? "—"} m²
        </div>
      </div>`,
      )
      .join("");
  } catch (e) {
    list.innerHTML = `<p class='msg error'>${e.message}</p>`;
  }
}

$("#add-filter").addEventListener("click", async () => {
  const session = getSession();
  try {
    await callRest("filters", {
      method: "POST",
      body: {
        name: "default",
        city: "barcelona",
        source: "idealista",
        price_max: 1500,
        rooms_min: 2,
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
