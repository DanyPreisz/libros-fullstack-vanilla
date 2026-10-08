import { api, setSession, clearSession, getToken } from "./api.js";
const LABELS = { "por-leer": "Por leer", leyendo: "Leyendo", leido: "Leido" };
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const listEl = document.querySelector("#list");
const filtersEl = document.querySelector("#filters");
const form = document.querySelector("#book-form");
const formError = document.querySelector("#form-error");
const cancelBtn = document.querySelector("#cancel");
const removeBtn = document.querySelector("#remove");
let mode = "login";
let status = "";
let query = "";
let selected = null;
let counts = {};
let timer;
const showError = (el, message) => { el.hidden = !message; el.textContent = message || ""; };
const stars = (n) => "\u2605".repeat(n) + "\u2606".repeat(5 - n);

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
}
function blank() { selected = null; form.reset(); cancelBtn.hidden = true; removeBtn.hidden = true; }
function fill(book) {
  selected = book;
  document.querySelector("#title").value = book.title;
  document.querySelector("#author").value = book.author;
  document.querySelector("#status").value = book.status;
  document.querySelector("#rating").value = book.rating;
  document.querySelector("#note").value = book.note;
  cancelBtn.hidden = false;
  removeBtn.hidden = false;
}
function renderFilters() {
  filtersEl.innerHTML = "";
  [["", "Todos"], ["por-leer", "Por leer"], ["leyendo", "Leyendo"], ["leido", "Leido"]].forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab${status === value ? " active" : ""}`;
    const count = value ? counts[value] || 0 : Object.values(counts).reduce((sum, n) => sum + n, 0);
    button.textContent = `${label} (${count})`;
    button.addEventListener("click", async () => { status = value; await refresh(); });
    filtersEl.append(button);
  });
}
async function loadBooks() {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const data = await api(`/api/books?${params}`);
  counts = data.counts;
  renderFilters();
  listEl.innerHTML = "";
  if (!data.books.length) {
    const empty = document.createElement("li");
    empty.textContent = "No hay libros.";
    listEl.append(empty);
    return;
  }
  data.books.forEach((book) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item";
    const title = document.createElement("strong");
    title.textContent = book.title;
    const meta = document.createElement("small");
    meta.textContent = [book.author, LABELS[book.status]].filter(Boolean).join(" \u00b7 ");
    const rating = document.createElement("span");
    rating.className = "stars";
    rating.textContent = book.rating ? stars(book.rating) : "";
    button.append(title, document.createTextNode(" "), rating, document.createElement("br"), meta);
    button.addEventListener("click", () => fill(book));
    li.append(button);
    listEl.append(li);
  });
}
async function refresh() { await loadBooks(); }
async function boot() {
  if (!getToken()) return;
  try {
    const { user } = await api("/api/auth/me");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.querySelector("#user-name").textContent = user.username;
    blank();
    await refresh();
  } catch { clearSession(); }
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  const fd = new FormData(authForm);
  try {
    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
    setSession(data.token);
    authForm.reset();
    await boot();
  } catch (err) { showError(authError, err.message); }
});
document.querySelector("#logout").addEventListener("click", () => { clearSession(); appView.classList.add("hidden"); authView.classList.remove("hidden"); });
document.querySelector("#search").addEventListener("input", (event) => { clearTimeout(timer); timer = setTimeout(async () => { query = event.target.value.trim(); await loadBooks(); }, 200); });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  const payload = { title: document.querySelector("#title").value.trim(), author: document.querySelector("#author").value.trim(), status: document.querySelector("#status").value, rating: document.querySelector("#rating").value, note: document.querySelector("#note").value.trim() };
  try {
    if (selected) await api(`/api/books/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    else await api("/api/books", { method: "POST", body: JSON.stringify(payload) });
    blank();
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
cancelBtn.addEventListener("click", blank);
removeBtn.addEventListener("click", async () => { if (!selected) return; await api(`/api/books/${selected.id}`, { method: "DELETE" }); blank(); await refresh(); });
boot();
