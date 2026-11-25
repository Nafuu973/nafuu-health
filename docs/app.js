"use strict";
/* Nafuu Health : application locale, sans serveur. Toutes les données restent sur le téléphone. */

const KEY = "nafuu_health_v1";
const CONSENT_VERSION = "1";
const MAX_IMPORT = 2 * 1024 * 1024;
const root = document.getElementById("app");

/* ---------- Outils ---------- */

function h(tag, props, kids) {
  const e = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else e.setAttribute(k, v === true ? "" : String(v));
    }
  }
  const list = Array.isArray(kids) ? kids : (kids === undefined ? [] : [kids]);
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
function uid() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
}
function str(x, max) { return typeof x === "string" ? x.slice(0, max || 500) : (typeof x === "number" ? String(x) : ""); }
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function arr(x, max) { return Array.isArray(x) ? x.slice(0, max || 1000) : []; }
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function frDate(iso) { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
function shortDate(iso) { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }
function daysSince(iso) { if (!iso) return null; const d = new Date(iso); d.setHours(0, 0, 0, 0); return Math.round((today() - d) / 86400000); }
function mmss(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + String(s).padStart(2, "0"); }
function ageFrom(iso) {
  const b = new Date(iso); if (isNaN(b)) return null;
  const n = new Date(); let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
function unitLabel(u, v) { return u === "s" ? "s" : u === "m" ? "m" : (v === 1 ? "rép." : "rép."); }
function fmtTarget(item, ex) {
  const per = ex && ex.side ? " par côté" : "";
  if (ex && ex.unit === "s") return item.sets + " × " + item.target + " s" + per;
  if (ex && ex.unit === "m") return item.sets + " × " + item.target + " m";
  return item.sets + " × " + item.target + per;
}

/* ---------- Stockage ---------- */

let S = load();
function load() {
  try { const t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch (e) { /* stockage indisponible */ }
  return { v: 1, role: null };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast("Impossible d'enregistrer : la mémoire de l'app est pleine. Fais une sauvegarde puis efface l'historique ancien."); }
}

/* ---------- Pont avec Android ---------- */

const NB = window.NafuuBridge || null;
function shareFile(name, obj, message) {
  const text = JSON.stringify(obj);
  const msg = String(message || "").slice(0, 500);
  if (NB) { NB.shareFile(name, text, msg); return; }
  const blob = new Blob([text], { type: "application/json" });
  let file = null;
  try { file = new File([blob], name, { type: "application/json" }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share(msg ? { files: [file], title: name, text: msg } : { files: [file], title: name }).catch(err => { if (err && err.name !== "AbortError") download(blob, name); });
    return;
  }
  download(blob, name);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast("Fichier enregistré dans tes téléchargements. Envoie-le sur WhatsApp.");
}
let wakeLock = null, wantAwake = false;
function keepAwake(on) {
  wantAwake = !!on;
  if (NB) { NB.keepAwake(wantAwake); return; }
  if (!("wakeLock" in navigator)) return;
  if (wantAwake && !wakeLock) {
    navigator.wakeLock.request("screen").then(l => { wakeLock = l; l.addEventListener("release", () => { wakeLock = null; }); }).catch(() => {});
  } else if (!wantAwake && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wantAwake && !wakeLock) keepAwake(true); });
function vibrate(ms) { if (NB) NB.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); }
function openWhatsApp(phone, text) {
  const p = String(phone || "").replace(/\D/g, "");
  if (!p) { toast("Ton coach n'a pas indiqué de numéro."); return; }
  if (NB) NB.openWhatsApp(p, text);
  else window.location.href = "https://wa.me/" + p + "?text=" + encodeURIComponent(text);
}

/* ---------- Navigation ---------- */

let stack = [];
let timers = [];
function clearTimers() { timers.forEach(t => clearInterval(t)); timers = []; }
function go(view, params, replace) {
  if (replace) stack.pop();
  stack.push({ view: view, params: params || {} });
  render();
}
function back() { if (stack.length > 1) { stack.pop(); render(); return true; } return false; }
function home() {
  stack = [];
  if (S.role === "coach") return go("coachHome");
  if (S.role !== "pax") return go("welcome");
  const P = S.pax;
  if (!P.consent) return go(P.invited ? "invited" : "paxConsent");
  if (P.coach && P.coach.phone && !P.announcedAt && !P.announceSkipped) return go("announce");
  go("paxHome");
}
window.nafuuBack = function () {
  const sheet = document.querySelector(".sheet-wrap");
  if (sheet) { sheet.remove(); return true; }
  return back();
};
function render() {
  clearTimers();
  const top = stack[stack.length - 1];
  const fn = VIEWS[top.view] || VIEWS.welcome;
  root.replaceChildren(fn(top.params));
  window.scrollTo(0, 0);
  const f = root.querySelector("h1");
  if (f) { f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); }
}
function toast(msg) {
  const t = h("div", { class: "toast", role: "status", text: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
function confirmSheet(title, body, okLabel, onOk, danger) {
  const wrap = h("div", { class: "sheet-wrap", onclick: (e) => { if (e.target === wrap) wrap.remove(); } }, [
    h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title }, [
      h("h2", { text: title }),
      body ? h("p", { text: body }) : null,
      h("div", { class: "row" }, [
        h("button", { class: "btn ghost", text: "Annuler", onclick: () => wrap.remove() }),
        h("button", { class: "btn " + (danger ? "danger" : "primary"), text: okLabel, onclick: () => { wrap.remove(); onOk(); } })
      ])
    ])
  ]);
  document.body.append(wrap);
}

/* ---------- Composants ---------- */

function screen(title, sub, kids, opts) {
  opts = opts || {};
  return h("main", { class: "screen" }, [
    h("header", { class: "top" }, [
      stack.length > 1 && !opts.noBack ? h("button", { class: "back", "aria-label": "Retour", onclick: back }, "‹") : null,
      h("div", null, [h("h1", { text: title }), sub ? h("p", { class: "sub", text: sub }) : null])
    ]),
    h("div", { class: "body" }, kids),
    opts.foot ? h("footer", { class: "foot" }, opts.foot) : null
  ]);
}
function field(label, input, hint) {
  return h("label", { class: "field" }, [h("span", { class: "lab", text: label }), input, hint ? h("span", { class: "hint", text: hint }) : null]);
}
function input(type, value, onchange, extra) {
  const p = Object.assign({ type: type, value: value === null || value === undefined ? "" : value, oninput: (e) => onchange(e.target.value) }, extra || {});
  if (type === "number") { p.inputmode = "decimal"; p.type = "text"; p.pattern = "[0-9]*[.,]?[0-9]*"; }
  return h("input", p);
}
function area(value, onchange, rows) { return h("textarea", { rows: rows || 3, oninput: (e) => onchange(e.target.value) }, value || ""); }
function chips(n0, n1, value, onpick, label) {
  const g = h("div", { class: "chips", role: "radiogroup", "aria-label": label || "" });
  for (let i = n0; i <= n1; i++) {
    const b = h("button", { class: "chip" + (value === i ? " on" : ""), role: "radio", "aria-checked": value === i ? "true" : "false", text: String(i),
      onclick: () => { g.querySelectorAll(".chip").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); });
                       b.classList.add("on"); b.setAttribute("aria-checked", "true"); onpick(i); } });
    g.append(b);
  }
  return g;
}
function tally(total, done) {
  const t = h("div", { class: "tally", "aria-label": done + " séries faites sur " + total });
  for (let i = 0; i < total; i++) t.append(h("span", { class: "stroke" + (i < done ? " on" : "") }));
  return t;
}
function stepper(value, step, min, onchange) {
  const out = h("output", { class: "val", text: String(value) });
  let v = value;
  const set = (nv) => { v = Math.max(min, Math.round(nv * 100) / 100); out.textContent = String(v); onchange(v); };
  return h("div", { class: "stepper" }, [
    h("button", { class: "step", "aria-label": "Moins", text: "−", onclick: () => set(v - step) }), out,
    h("button", { class: "step", "aria-label": "Plus", text: "+", onclick: () => set(v + step) })
  ]);
}
function list(items) { return h("ul", { class: "list" }, items.map(x => h("li", null, x))); }
function navRow(label, sub, onclick, badge) {
  return h("button", { class: "nav-row", onclick: onclick }, [
    h("span", { class: "nr-main" }, [h("span", { class: "nr-label", text: label }), sub ? h("span", { class: "nr-sub", text: sub }) : null]),
    badge ? h("span", { class: "badge", text: badge }) : null
  ]);
}

/* Chrono qui compte vers le haut, avec arrêt automatique au plafond */
function chrono(initial, max, onstop) {
  let start = null, val = initial || 0;
  const disp = h("output", { class: "chrono-val", "aria-live": "off", text: mmss(val) });
  const btn = h("button", { class: "btn primary big", text: "Démarrer" });
  let t = null;
  const stop = () => {
    if (start === null) return;
    val = Math.round((Date.now() - start) / 1000); start = null;
    clearInterval(t); btn.textContent = "Recommencer"; btn.classList.remove("running");
    disp.textContent = mmss(val); vibrate(80); keepAwake(true); onstop(val);
  };
  btn.addEventListener("click", () => {
    if (start !== null) { stop(); return; }
    start = Date.now(); btn.textContent = "Arrêter"; btn.classList.add("running");
    t = setInterval(() => {
      const s = (Date.now() - start) / 1000;
      disp.textContent = mmss(s);
      if (max && s >= max) { stop(); vibrate(400); toast("Plafond atteint : " + max + " s."); }
    }, 200);
    timers.push(t);
  });
  return h("div", { class: "chrono" }, [disp, btn, max ? h("span", { class: "hint", text: "Plafond : " + max + " s" }) : null]);
}

/* ---------- Données exercices ---------- */

function exMap(list) { const m = {}; (list || []).forEach(e => { m[e.id] = e; }); return m; }
function coachEx() { return exMap(S.coach.exercises); }
function paxEx() { return exMap(S.pax.program ? S.pax.program.exercises : []); }

/* ---------- Import de fichiers ---------- */

let importTarget = null;
function pickFile(targetPaxId) {
  importTarget = typeof targetPaxId === "string" ? targetPaxId : null;
  const inp = h("input", { type: "file", accept: ".json,application/json,text/plain", class: "hidden" });
  inp.addEventListener("change", () => {
    const f = inp.files && inp.files[0]; inp.remove();
    if (!f) return;
    if (f.size > MAX_IMPORT) { toast("Fichier trop gros pour être un fichier Nafuu Health."); return; }
    const r = new FileReader();
    r.onload = () => handleImport(String(r.result));
    r.readAsText(f);
  });
  document.body.append(inp); inp.click();
}
window.nafuuReceive = function (text) { handleImport(text); };

function handleImport(text) {
  if (typeof text !== "string" || text.length > MAX_IMPORT) { toast("Fichier illisible."); return; }
  let o;
  try { o = JSON.parse(text); } catch (e) { toast("Ce fichier n'est pas un fichier Nafuu Health."); return; }
  if (!o || typeof o !== "object") { toast("Fichier illisible."); return; }
  if (o.type === "nafuu-programme") return importProgram(o);
  if (o.type === "nafuu-test") return importTestRequest(o);
  if (o.type === "nafuu-rapport") return importReport(o);
  if (o.type === "nafuu-sauvegarde") return importBackup(o);
  toast("Ce fichier n'est pas un fichier Nafuu Health.");
}

function cleanExercise(e) {
  return { id: str(e.id, 60), name: str(e.name, 120), unit: ["reps", "s", "m"].includes(e.unit) ? e.unit : "reps",
    side: e.side ? str(e.side, 120) : null, lieu: str(e.lieu, 20), muscles: str(e.muscles, 300), cues: str(e.cues, 1200),
    errors: str(e.errors, 600), harder: str(e.harder, 160), easier: str(e.easier, 160), plafond: num(e.plafond) || 0 };
}
function cleanSessionTpl(s) {
  return { num: Math.max(1, Math.min(20, num(s.num) || 1)), lieu: s.lieu === "salle" ? "salle" : "maison", title: str(s.title, 120),
    items: arr(s.items, 40).map(i => ({ exId: str(i.exId, 60), sets: Math.max(1, Math.min(20, num(i.sets) || 1)),
      target: Math.max(0, Math.min(10000, num(i.target) || 0)), note: str(i.note, 300) })) };
}

function sampleProgram() {
  const used = {};
  SEED_SESSIONS.forEach(x => x.items.forEach(i => { used[i.exId] = true; }));
  return { type: "nafuu-programme", v: 1, issuedAt: new Date().toISOString(), message: "Programme type : remplace-le par celui de ton coach dès que tu le reçois.",
    coach: { name: "", phone: "" }, pax: { id: (S.pax && S.pax.paxId) || "", name: "" }, cycleWeeks: 4, warmup: SEED_WARMUP,
    sessions: SEED_SESSIONS, exercises: SEED_EXERCISES.filter(e => used[e.id]) };
}
function importTestRequest(o) {
  if (S.role === "coach") { toast("Ce fichier est une demande de test pour un pax. Ouvre-le sur son téléphone."); return; }
  const coach = { name: str(o.coach && o.coach.name, 80), phone: str(o.coach && o.coach.phone, 20).replace(/\D/g, "") };
  const paxId = str(o.pax && o.pax.id, 40), paxName = str(o.pax && o.pax.name, 80);
  if (!S.pax) S.pax = newPax();
  S.role = "pax";
  if (!S.pax.coach || !S.pax.coach.phone) S.pax.coach = coach;
  if (!S.pax.paxId && paxId) S.pax.paxId = paxId;
  if (!S.pax.profile.firstName && paxName) S.pax.profile.firstName = paxName.split(" ")[0];
  S.pax.testRequest = { issuedAt: str(o.issuedAt, 40) || new Date().toISOString(), message: str(o.message, 1000) };
  save(); toast((coach.name || "Ton coach") + " te demande de faire le test de départ.");
  home();
}
function importProgram(o) {
  if (S.role === "coach") { toast("Ce fichier est un programme pour un pax. Ouvre-le sur son téléphone."); return; }
  const prog = {
    issuedAt: str(o.issuedAt, 40), message: str(o.message, 1000), cycleWeeks: Math.max(1, Math.min(52, num(o.cycleWeeks) || 4)),
    warmup: arr(o.warmup, 30).map(x => str(x, 160)), sessions: arr(o.sessions, 40).map(cleanSessionTpl),
    exercises: arr(o.exercises, 300).map(cleanExercise)
  };
  const coach = { name: str(o.coach && o.coach.name, 80), phone: str(o.coach && o.coach.phone, 20).replace(/\D/g, "") };
  const pax = { id: str(o.pax && o.pax.id, 40), name: str(o.pax && o.pax.name, 80) };
  const apply = () => {
    if (!S.pax) S.pax = newPax();
    S.role = "pax";
    S.pax.program = prog; S.pax.coach = coach; S.pax.paxId = pax.id;
    if (!S.pax.profile.firstName) S.pax.profile.firstName = pax.name;
    const nums = prog.sessions.map(s => s.num);
    if (!nums.includes(S.pax.nextNum)) S.pax.nextNum = Math.min.apply(null, nums.concat([1]));
    save(); toast("Programme reçu de " + (coach.name || "ton coach") + ".");
    home();
  };
  if (S.pax && S.pax.paxId && pax.id && S.pax.paxId !== pax.id) {
    confirmSheet("Ce programme est pour " + (pax.name || "un autre pax"), "Tu veux quand même le charger sur ce téléphone ?", "Charger", apply);
  } else apply();
}

function importReport(o) {
  if (S.role !== "coach") { toast("Ce fichier est un rapport pour le coach. Envoie-le-lui."); return; }
  const id = str(o.paxId, 40);
  const forced = importTarget ? S.coach.pax.find(x => x.id === importTarget) : null;
  importTarget = null;
  if (!id && !forced) { toast("Rapport sans identifiant de pax."); return; }
  let p = forced || S.coach.pax.find(x => x.id === id);
  if (!p) { p = newCoachPax(str(o.profile && o.profile.firstName, 80) || "Pax", id); S.coach.pax.push(p); }
  if (o.profile && o.profile.birth) p.profile = { firstName: str(o.profile.firstName, 80), birth: str(o.profile.birth, 20) };
  if (o.consent) p.consent = o.consent && typeof o.consent === "object" ? { date: str(o.consent.date, 40), health: !!o.consent.health, version: str(o.consent.version, 10), parent: str(o.consent.parent, 80) } : null;
  mergeById(p.sessions, arr(o.sessions, 2000).map(cleanDoneSession));
  mergeById(p.tests, arr(o.tests, 100).map(t => ({ id: str(t.id, 40), date: str(t.date, 40), blocked: !!t.blocked, skipped: arr(t.skipped, 20).map(x => str(x, 40)), values: cleanValues(t.values) })));
  mergeById(p.measures, arr(o.measures, 2000).map(m => ({ id: str(m.id, 40), date: str(m.date, 40), poids: num(m.poids), tour: num(m.tour), pouls: num(m.pouls) })));
  mergeById(p.pains, arr(o.pains, 2000).map(cleanPain));
  if (!forced) {
    p.lastReportAt = str(o.generatedAt, 40) || new Date().toISOString();
    if (!p.connectedAt) p.connectedAt = p.lastReportAt;
  }
  p.unseen = true;
  computeProposals(p);
  const lt = p.tests.filter(t => !t.blocked).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  if (lt && p.draftFromTestId !== lt.id) { p.draft = buildProgramFromTest(lt, p.name); p.draftFromTestId = lt.id; }
  save(); toast((forced ? "Test ajouté à " : "Rapport de ") + p.name + (forced ? "." : " importé."));
  stack = []; go("coachHome"); go("coachPax", { id: p.id });
}
function cleanDoneSession(s) {
  return { id: str(s.id, 40), date: str(s.date, 40), num: num(s.num) || 1, lieu: s.lieu === "salle" ? "salle" : "maison", title: str(s.title, 120),
    feeling: num(s.feeling), comment: str(s.comment, 1000),
    items: arr(s.items, 40).map(i => ({ exId: str(i.exId, 60), name: str(i.name, 120), unit: str(i.unit, 6), sidesUsed: !!i.sidesUsed,
      target: num(i.target) || 0, plannedSets: num(i.plannedSets) || 0,
      sets: arr(i.sets, 60).map(x => ({ side: x.side === "G" || x.side === "D" ? x.side : null, value: num(x.value) || 0, effort: num(x.effort), clean: x.clean !== false, done: !!x.done })) })) };
}
function cleanPain(p) { return { id: str(p.id, 40), date: str(p.date, 40), zone: str(p.zone, 40), intensity: num(p.intensity), context: str(p.context, 160), comment: str(p.comment, 600) }; }
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function cleanValues(v) {
  const out = {};
  if (!v || typeof v !== "object") return out;
  Object.keys(v).slice(0, 80).forEach(k => {
    const t = v[k]; if (!t || typeof t !== "object" || FORBIDDEN_KEYS.has(k)) return;
    const o = {};
    Object.keys(t).slice(0, 30).forEach(f => { if (FORBIDDEN_KEYS.has(f)) return; const x = t[f]; o[str(f, 30)] = typeof x === "boolean" ? x : typeof x === "number" ? x : str(x, 300); });
    out[str(k, 40)] = o;
  });
  return out;
}
function mergeById(target, incoming) {
  incoming.forEach(x => { if (!x.id) return; const i = target.findIndex(y => y.id === x.id); if (i >= 0) target[i] = x; else target.push(x); });
}

function importBackup(o) {
  const data = o.data;
  const okShape = data && typeof data === "object" && ["coach", "pax"].includes(data.role) &&
    (data.role === "coach" ? data.coach && Array.isArray(data.coach.pax) && Array.isArray(data.coach.exercises)
                           : data.pax && typeof data.pax.profile === "object" && Array.isArray(data.pax.sessions));
  if (!okShape) { toast("Sauvegarde illisible."); return; }
  confirmSheet("Restaurer cette sauvegarde ?", "Elle remplace toutes les données actuelles de l'app sur ce téléphone.", "Restaurer", () => {
    S = data; save(); toast("Sauvegarde restaurée."); home();
  }, true);
}

/* ---------- Création ---------- */

function newPax() {
  return { profile: { firstName: "", birth: "" }, consent: null, program: null, coach: null, paxId: "", nextNum: 1,
    current: null, sessions: [], tests: [], testDraft: null, measures: [], pains: [], lastReportAt: null };
}
function newCoachPax(name, id) {
  return { id: id || uid(), name: name, createdAt: new Date().toISOString(), program: defaultProgram(), programSentAt: null, programDirty: true,
    profile: null, consent: null, sessions: [], tests: [], measures: [], pains: [], notes: "", proposals: [], decided: [], lastReportAt: null, unseen: false };
}
function defaultProgram() {
  return { cycleWeeks: 4, warmup: SEED_WARMUP.slice(), sessions: JSON.parse(JSON.stringify(SEED_SESSIONS)) };
}

/* ---------- Progression ---------- */

function evalItem(it) {
  if (!it || !it.sets.length) return null;
  const sets = it.sets;
  const allDone = sets.length >= it.plannedSets * (it.sidesUsed ? 2 : 1) && sets.every(s => s.done && s.value >= it.target);
  const clean = sets.every(s => s.clean);
  const efforts = sets.map(s => s.effort).filter(e => e !== null && e !== undefined);
  const maxEff = efforts.length ? Math.max.apply(null, efforts) : null;
  return { allDone: allDone, clean: clean, maxEff: maxEff };
}
function computeProposals(p) {
  const exs = coachEx();
  const decided = new Set(p.decided || []);
  p.proposals = (p.proposals || []).filter(x => x.status !== "pending");
  p.program.sessions.forEach(s => {
    s.items.forEach((item, idx) => {
      const ex = exs[item.exId]; if (!ex) return;
      const done = p.sessions.filter(d => d.num === s.num && d.lieu === s.lieu)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map(d => ({ d: d, it: d.items.find(i => i.exId === item.exId) })).filter(x => x.it);
      if (!done.length) return;
      const r1 = evalItem(done[0].it), r2 = done[1] ? evalItem(done[1].it) : null;
      const key = s.lieu + "-" + s.num + "-" + idx + "-" + item.exId + "@" + done[0].d.id;
      if (decided.has(key)) return;
      const base = { key: key, lieu: s.lieu, num: s.num, idx: idx, exId: item.exId, exName: ex.name, from: { sets: item.sets, target: item.target }, status: "pending", date: done[0].d.date };
      const good = r1.allDone && r1.clean && r1.maxEff !== null && r1.maxEff <= 7;
      const easierEx = ladderStep(item.exId, -1, s.lieu, exs), harderEx = ladderStep(item.exId, 1, s.lieu, exs);
      const pains = painsOnExercise(p, ex.name, done[0].d.date.slice(0, 10));
      if (pains.length) {
        const z = pains.map(x => x.zone.toLowerCase()).join(", ");
        if (easierEx) p.proposals.push(Object.assign(base, { kind: "easier", newExId: easierEx.id, newName: easierEx.name, to: { sets: item.sets, target: item.target }, reason: "Douleur signalée sur cet exercice (" + z + "). Version plus facile en attendant d'en parler avec lui." }));
        else p.proposals.push(Object.assign(base, { kind: "target", to: { sets: Math.max(1, item.sets - 1), target: item.target }, reason: "Douleur signalée sur cet exercice (" + z + "). Une série de moins en attendant d'en parler avec lui." }));
        return;
      }
      if (r1.maxEff !== null && r1.maxEff >= 9 && r2 && r2.maxEff !== null && r2.maxEff >= 9) {
        if (easierEx) p.proposals.push(Object.assign(base, { kind: "easier", newExId: easierEx.id, newName: easierEx.name, to: { sets: item.sets, target: item.target }, reason: "Effort de 9 ou plus sur les deux dernières séances." }));
        else if (ex.easier) p.proposals.push(Object.assign(base, { kind: "easier", newName: ex.easier, to: { sets: item.sets, target: item.target }, reason: "Effort de 9 ou plus sur les deux dernières séances." }));
        else if (ex.unit === "reps" && item.target > 3) p.proposals.push(Object.assign(base, { kind: "target", to: { sets: item.sets, target: Math.max(3, item.target - 2) }, reason: "Effort de 9 ou plus sur les deux dernières séances." }));
        return;
      }
      if (!good) return;
      if (ex.unit === "reps") {
        if (item.target >= 12 && harderEx) p.proposals.push(Object.assign(base, { kind: "harder", newExId: harderEx.id, newName: harderEx.name, to: { sets: item.sets, target: harderEx.unit === "s" ? 20 : 6 }, reason: "Toutes les séries propres à " + item.target + " répétitions, effort " + r1.maxEff + "." }));
        else if (item.target >= 12 && ex.harder) p.proposals.push(Object.assign(base, { kind: "harder", newName: ex.harder, to: { sets: item.sets, target: 6 }, reason: "Toutes les séries propres à " + item.target + " répétitions, effort " + r1.maxEff + "." }));
        else {
          const inc = r1.maxEff <= 5 ? 2 : 1;
          const nt = Math.min(12, item.target + inc);
          if (nt > item.target) p.proposals.push(Object.assign(base, { kind: "target", to: { sets: item.sets, target: nt }, reason: "Toutes les séries propres, effort " + r1.maxEff + "." }));
        }
      } else if (ex.unit === "s") {
        const nt = item.target + 5;
        if (ex.plafond && nt >= ex.plafond && harderEx) p.proposals.push(Object.assign(base, { kind: "harder", newExId: harderEx.id, newName: harderEx.name, to: { sets: item.sets, target: harderEx.unit === "s" ? 20 : 8 }, reason: "Plafond presque atteint, effort " + r1.maxEff + "." }));
        else if (ex.plafond && nt >= ex.plafond && ex.harder) p.proposals.push(Object.assign(base, { kind: "harder", newName: ex.harder, to: { sets: item.sets, target: Math.max(10, Math.round(item.target / 2)) }, reason: "Plafond presque atteint, effort " + r1.maxEff + "." }));
        else p.proposals.push(Object.assign(base, { kind: "target", to: { sets: item.sets, target: nt }, reason: "Positions tenues propres, effort " + r1.maxEff + "." }));
      } else if (ex.unit === "m") {
        if (item.sets + 1 > 8 && harderEx) p.proposals.push(Object.assign(base, { kind: "harder", newExId: harderEx.id, newName: harderEx.name, to: { sets: 6, target: item.target + 100 }, reason: "8 répétitions propres, on allonge la distance." }));
        else if (item.sets + 1 > 8) p.proposals.push(Object.assign(base, { kind: "target", to: { sets: 6, target: item.target + 100 }, reason: "8 répétitions propres, on allonge la distance." }));
        else p.proposals.push(Object.assign(base, { kind: "target", to: { sets: item.sets + 1, target: item.target }, reason: "Toutes les répétitions propres, effort " + r1.maxEff + "." }));
      }
    });
  });
}
function applyProposal(p, pr, override) {
  const s = p.program.sessions.find(x => x.num === pr.num && x.lieu === pr.lieu);
  const item = s && s.items[pr.idx];
  if (!item || item.exId !== pr.exId) { toast("Le programme a changé depuis : proposition ignorée."); return; }
  const to = override || pr.to;
  if ((pr.kind === "harder" || pr.kind === "easier") && pr.newExId && S.coach.exercises.some(e => e.id === pr.newExId)) {
    item.exId = pr.newExId;
  } else if (pr.kind === "harder" || pr.kind === "easier") {
    const src = S.coach.exercises.find(e => e.id === pr.exId);
    if (!src) { toast("Exercice introuvable dans la bibliothèque."); return; }
    let ne = S.coach.exercises.find(e => e.name.toLowerCase() === pr.newName.toLowerCase());
    if (!ne) {
      ne = { id: "x" + uid(), name: pr.newName, unit: src.unit, side: src.side, lieu: src.lieu, muscles: src.muscles,
        cues: "", errors: "", harder: pr.kind === "easier" ? src.name : "", easier: pr.kind === "harder" ? src.name : "", plafond: src.plafond || 0 };
      S.coach.exercises.push(ne);
    }
    item.exId = ne.id;
  }
  item.sets = to.sets; item.target = to.target;
  p.programDirty = true;
}

/* ---------- Envoi par lien ---------- */

const LINK_MAX = 60000;
function bytesToB64url(bytes) {
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(t) {
  const bin = atob(t.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function streamBytes(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
async function makeDataLink(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) return APP_URL + "#z=" + bytesToB64url(await streamBytes(raw, new CompressionStream("gzip")));
  return APP_URL + "#d=" + bytesToB64url(raw);
}
async function readDataHash(hash) {
  const m = /^#([zd])=([A-Za-z0-9_-]+)$/.exec(hash || "");
  if (!m || m[2].length > LINK_MAX * 2) return null;
  let bytes = b64urlToBytes(m[2]);
  if (m[1] === "z") {
    if (!window.DecompressionStream) throw new Error("Navigateur trop ancien");
    bytes = await streamBytes(bytes, new DecompressionStream("gzip"));
  }
  if (bytes.length > MAX_IMPORT) throw new Error("Trop gros");
  return new TextDecoder().decode(bytes);
}
async function importFromText(text) {
  const m = /#[zd]=[A-Za-z0-9_-]+/.exec(String(text || ""));
  if (!m) { const t = String(text || "").trim(); if (t.startsWith("{")) { handleImport(t); return true; } toast("Aucun lien Nafuu Health trouvé dans ce texte."); return false; }
  try { const t = await readDataHash(m[0]); if (!t) throw new Error("vide"); handleImport(t); return true; }
  catch (e) { toast("Lien illisible ou incomplet. Demande qu'on te le renvoie."); return false; }
}
/* Envoie par WhatsApp un message avec le lien. Trop gros : fichier en secours. */
async function sendLink(obj, intro, phone, fileName) {
  let link;
  try { link = await makeDataLink(obj); } catch (e) { link = null; }
  if (!link || link.length > LINK_MAX) { shareFile(fileName, obj, intro); return; }
  const text = intro + "\n" + link;
  if (phone && text.length <= 12000) { openWhatsApp(phone, text); return; }
  if (navigator.share) { navigator.share({ text: text }).catch(() => {}); return; }
  try { await navigator.clipboard.writeText(text); toast("Lien copié : colle-le dans WhatsApp."); } catch (e) { shareFile(fileName, obj, intro); }
}
function pasteView(params) {
  let txt = "";
  return screen(params.title || "Importer", null, [
    h("p", { text: params.lead || "Dans WhatsApp, reste appuyé sur le message avec le lien, copie-le, puis colle-le ici." }),
    field("Lien reçu", area("", v => { txt = v; }, 5)),
    h("button", { class: "btn primary big", text: "Importer", onclick: () => { if (!txt.trim()) return toast("Colle d'abord le lien."); importFromText(txt); } }),
    h("p", { class: "hint", text: "Tu as reçu un fichier .json à la place ?" }),
    h("button", { class: "btn ghost", text: "Choisir un fichier", onclick: pickFile })
  ]);
};

/* ---------- Invitation ---------- */

const APP_URL = "https://nafuu973.github.io/nafuu-health/";
function b64urlEncode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(t) {
  if (typeof t !== "string" || t.length > 600 || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  try {
    const bin = atob(t.replace(/-/g, "+").replace(/_/g, "/"));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (!o || typeof o !== "object") return null;
    const inv = { coachName: str(o.c, 80), coachPhone: str(o.p, 20).replace(/\D/g, ""), paxId: str(o.i, 40), paxName: str(o.n, 80) };
    return inv.coachName && inv.paxId ? inv : null;
  } catch (e) { return null; }
}
function inviteLink(p) { return APP_URL + "#i=" + b64urlEncode({ c: S.coach.name, p: S.coach.phone, i: p.id, n: p.name }); }
function sendInvite(p) {
  if (!p.phone) { toast("Indique d'abord le WhatsApp de " + p.name + ", dans Contact."); return; }
  const first = p.name.split(" ")[0];
  const text = "Salut " + first + ", c'est " + S.coach.name + ", ton coach. Je te suis maintenant avec l'app Nafuu Health. " +
    "Ouvre ce lien, installe l'app et suis les étapes : " + inviteLink(p);
  p.invitedAt = new Date().toISOString(); save();
  openWhatsApp(p.phone, text);
  render();
}
function announceText() {
  const P = S.pax;
  return "Salut " + (P.coach && P.coach.name ? P.coach.name : "coach") + ", c'est " + (P.profile.firstName || "ton pax") +
    ". J'ai installé Nafuu Health, c'est bon pour moi" + (P.program ? ", j'ai bien reçu mon programme." : ", j'attends mon programme.");
}
function readInvite() {
  const m = /^#i=([A-Za-z0-9_-]+)$/.exec(location.hash || "");
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  const inv = b64urlDecode(m[1]);
  if (!inv) { toast("Lien d'invitation illisible. Demande à ton coach de te le renvoyer."); return; }
  if (S.role === "coach") return;
  S.role = "pax";
  S.pax = S.pax || newPax();
  if (S.pax.paxId && S.pax.paxId !== inv.paxId && S.pax.sessions.length) { toast("Cette app suit déjà un autre profil."); return; }
  S.pax.paxId = inv.paxId;
  S.pax.coach = { name: inv.coachName, phone: inv.coachPhone };
  if (!S.pax.profile.firstName) S.pax.profile.firstName = inv.paxName.split(" ")[0];
  S.pax.invited = true;
  save();
}

/* ---------- Écrans ---------- */

const VIEWS = {};
VIEWS.paste = pasteView;

VIEWS.welcome = function () {
  return screen("Nafuu Health", "Le suivi de tes séances, à la répétition.", [
    h("p", { class: "lead", text: "Tout reste sur ce téléphone. Rien n'est envoyé sur Internet : tu choisis ce que tu partages, et à qui." }),
    h("button", { class: "choice", onclick: () => { S.role = "pax"; S.pax = S.pax || newPax(); save(); go("paxConsent", {}, true); } }, [
      h("span", { class: "c-title", text: "Je suis suivi par un coach" }),
      h("span", { class: "c-sub", text: "Je reçois mon programme et je fais mes séances." })
    ]),
    h("button", { class: "choice", onclick: () => go("coachSetup") }, [
      h("span", { class: "c-title", text: "Je suis le coach" }),
      h("span", { class: "c-sub", text: "Je crée les programmes et je suis mes pax." })
    ]),
    h("button", { class: "link", text: "Restaurer une sauvegarde", onclick: pickFile }),
    isInstalled() ? null : h("nav", { class: "menu" }, [installRow()])
  ], { noBack: true });
};

VIEWS.invited = function () {
  const P = S.pax, coach = P.coach && P.coach.name ? P.coach.name : "Ton coach";
  return screen(coach + " est ton coach", "Bienvenue sur Nafuu Health", [
    h("p", { class: "lead", text: coach + " va suivre tes séances avec cette app : ton programme, tes progrès, et tes questions sur chaque exercice." }),
    isInstalled() ? null : h("section", { class: "info" }, [
      h("h2", { text: "D'abord, installe l'app" }),
      h("p", { text: "Installe-la sur ton téléphone, puis ouvre-la toujours depuis son icône. C'est là que tes données sont gardées." }),
      h("button", { class: "btn primary", text: "Installer l'app", onclick: () => go("install") }),
      h("p", { class: "hint", text: "Sur iPhone, l'app installée repart de zéro : choisis « Je suis suivi par un coach ». Ton coach sera reconnu dès que tu ouvriras le programme qu'il t'envoie." })
    ]),
    h("ol", { class: "steps" }, [
      h("li", { text: "Tu remplis ton prénom et tu acceptes les conditions." }),
      h("li", { text: "Tu préviens " + coach + " que tu es prêt, en un appui." }),
      h("li", { text: coach + " t'envoie ton programme sur WhatsApp, tu l'ouvres avec Nafuu Health." })
    ])
  ], { noBack: true, foot: [h("button", { class: "btn primary big", text: "Continuer", onclick: () => go("paxConsent", {}, true) })] });
};
VIEWS.announce = function () {
  const P = S.pax, coach = P.coach && P.coach.name ? P.coach.name : "ton coach";
  return screen("Préviens " + coach, null, [
    h("p", { text: "Envoie-lui un message pour lui dire que tu es prêt. Il saura que tu as bien installé l'app" + (P.program ? "." : " et t'enverra ton programme.") }),
    h("p", { class: "hint", text: "Message envoyé : « " + announceText() + " »" })
  ], { noBack: true, foot: [
    h("button", { class: "btn ghost", text: "Plus tard", onclick: () => { P.announceSkipped = true; save(); home(); } }),
    h("button", { class: "btn primary", text: "Prévenir sur WhatsApp", onclick: () => { P.announcedAt = new Date().toISOString(); save(); openWhatsApp(P.coach.phone, announceText()); home(); } })
  ] });
};

/* ----- Pax : consentement ----- */

VIEWS.paxConsent = function () {
  const P = S.pax;
  const d = { firstName: P.profile.firstName || "", birth: P.profile.birth || "", cgu: false, health: false, parentName: "", parentOk: false };
  const parentBox = h("div", { class: "parent hidden" }, [
    h("p", { class: "warn", text: "Tu as moins de 18 ans : un parent doit lire cette page avec toi et donner son accord." }),
    field("Nom du parent", input("text", "", v => { d.parentName = v; })),
    h("label", { class: "check" }, [h("input", { type: "checkbox", onchange: e => { d.parentOk = e.target.checked; } }),
      h("span", { text: "Je suis son parent et j'accepte qu'il ou elle utilise l'app." })])
  ]);
  const birth = input("date", d.birth, v => { d.birth = v; const a = ageFrom(v); parentBox.classList.toggle("hidden", !(a !== null && a < 18)); });
  return screen("Avant de commencer", null, [
    field("Ton prénom", input("text", d.firstName, v => { d.firstName = v; }, { autocomplete: "given-name" })),
    field("Ta date de naissance", birth),
    parentBox,
    h("section", { class: "info" }, [
      h("h2", { text: "Ce que l'app fait de tes données" }),
      list([
        "Tout est enregistré sur ce téléphone, nulle part ailleurs.",
        "L'app n'envoie rien toute seule. Quand tu envoies ton rapport, c'est toi qui choisis de le partager avec ton coach.",
        "Ton coach garde ton rapport sur son téléphone pour suivre ta progression. Il ne le partage avec personne.",
        "Tu peux tout effacer à tout moment dans les réglages."
      ]),
      h("p", { class: "warn", text: "Cette app ne remplace pas un avis médical. En cas de doute sur ta santé, vois un médecin avant de commencer." })
    ]),
    h("label", { class: "check" }, [h("input", { type: "checkbox", onchange: e => { d.cgu = e.target.checked; } }),
      h("span", { text: "J'ai lu comment l'app utilise mes données et j'accepte de l'utiliser." })]),
    h("label", { class: "check" }, [h("input", { type: "checkbox", onchange: e => { d.health = e.target.checked; } }),
      h("span", { text: "J'accepte que l'app enregistre des données sur ma santé (douleurs, blessures, mesures, pouls), et que je puisse les envoyer à mon coach." })]),
    h("p", { class: "hint", text: "Sans cette deuxième case, l'app ne peut pas suivre tes séances ni ton test : elles contiennent ces informations." })
  ], { foot: [h("button", { class: "btn primary big", text: "Commencer", onclick: () => {
    if (!d.firstName.trim()) return toast("Indique ton prénom.");
    const a = ageFrom(d.birth);
    if (a === null || a < 5 || a > 110) return toast("Indique ta date de naissance.");
    if (!d.cgu || !d.health) return toast("Coche les deux cases pour continuer.");
    if (a < 18 && (!d.parentName.trim() || !d.parentOk)) return toast("L'accord d'un parent est nécessaire.");
    S.pax.profile = { firstName: d.firstName.trim().slice(0, 80), birth: d.birth };
    S.pax.consent = { date: new Date().toISOString(), cgu: true, health: true, version: CONSENT_VERSION, parent: a < 18 ? d.parentName.trim().slice(0, 80) : "" };
    save(); home();
  } })] });
};

/* ----- Pax : accueil ----- */

VIEWS.paxHome = function () {
  const P = S.pax, prog = P.program;
  const kids = [];
  if (P.current) {
    kids.push(h("section", { class: "next" }, [
      h("p", { class: "next-k", text: "Séance en cours" }),
      h("p", { class: "next-n", text: "Séance " + P.current.num }),
      h("p", { class: "next-t", text: P.current.title + ", " + P.current.lieu }),
      h("button", { class: "btn primary big", text: "Reprendre la séance", onclick: () => go("session") })
    ]));
  } else if (!prog) {
    kids.push(h("section", { class: "next" }, [
      h("p", { class: "next-n", text: "Pas encore de programme" }),
      h("p", { text: "Ton coach t'envoie un fichier sur WhatsApp. Ouvre-le avec Nafuu Health, ou enregistre-le dans ton téléphone puis importe-le ici." }),
      h("button", { class: "btn primary big", text: "Importer mon programme", onclick: () => go("paste", { title: "Importer mon programme" }) }),
      h("button", { class: "btn ghost", text: "Essayer avec le programme type", onclick: () => importProgram(sampleProgram()) })
    ]));
  } else {
    const opts = prog.sessions.filter(s => s.num === P.nextNum);
    const last = P.sessions.length ? P.sessions[P.sessions.length - 1] : null;
    const ds = last ? daysSince(last.date) : null;
    kids.push(h("section", { class: "next" }, [
      h("p", { class: "next-k", text: "Prochaine séance" }),
      h("p", { class: "next-n", text: "Séance " + P.nextNum }),
      ds !== null && ds <= 1 ? h("p", { class: "warn", text: "Prends au moins un jour de repos entre deux séances." }) : null,
      h("div", { class: "lieux" }, opts.map(s => h("button", { class: "btn lieu", onclick: () => startSession(s) }, [
        h("span", { class: "l-name", text: s.lieu === "salle" ? "Salle" : "Maison" }), h("span", { class: "l-sub", text: s.title })
      ])))
    ]));
  }
  if (P.testRequest) {
    kids.unshift(h("section", { class: "next" }, [
      h("p", { class: "next-k", text: (P.coach && P.coach.name ? P.coach.name : "Ton coach") + " te demande" }),
      h("p", { class: "next-n", text: "Test de départ" }),
      P.testRequest.message ? h("p", { text: P.testRequest.message }) : null,
      h("button", { class: "btn primary big", text: P.testDraft ? "Reprendre le test" : "Faire le test", onclick: () => go("test") })
    ]));
  }
  if (prog && prog.message) {
    kids.push(h("section", { class: "info" }, [
      h("h2", { text: "Message de " + (P.coach && P.coach.name ? P.coach.name : "ton coach") }),
      h("p", { text: prog.message }),
      h("p", { class: "hint", text: "Reçu le " + frDate(prog.issuedAt) })
    ]));
  }
  const t = P.tests.length ? P.tests[P.tests.length - 1] : null;
  const newCount = P.sessions.filter(s => !P.lastReportAt || s.date > P.lastReportAt).length + P.tests.filter(x => !P.lastReportAt || x.date > P.lastReportAt).length;
  kids.push(h("nav", { class: "menu" }, [
    navRow("Test de départ", P.testDraft ? "En cours, reprends où tu en étais" : t ? "Fait le " + frDate(t.date) : "À faire avant de commencer", () => go("test")),
    navRow("Mes séances", P.sessions.length ? P.sessions.length + " faites" : "Aucune pour l'instant", () => go("history")),
    navRow("Mesures", "Poids, tour de taille, pouls", () => go("measures")),
    navRow("Envoyer mon rapport au coach", newCount ? newCount + " nouveautés depuis le dernier envoi" : "Rien de nouveau", () => go("report"), newCount ? String(newCount) : null),
    prog ? navRow("Importer un nouveau programme", "Si le lien de ton coach ne s'est pas ouvert tout seul", () => go("paste", { title: "Importer un programme" })) : null,
    P.coach && P.coach.phone && !P.announcedAt ? navRow("Prévenir mon coach que je suis prêt", "Un message WhatsApp en un appui", () => go("announce")) : null,
    navRow("Réglages", "Données, sauvegarde, effacement", () => go("paxSettings")),
    installRow()
  ]));
  return screen("Salut " + (P.profile.firstName || ""), prog && P.coach && P.coach.name ? "Coach : " + P.coach.name : null, kids, { noBack: true });
};

/* ----- Pax : séance ----- */

function startSession(tpl) {
  const exs = paxEx();
  S.pax.current = {
    id: uid(), num: tpl.num, lieu: tpl.lieu, title: tpl.title, startedAt: new Date().toISOString(), step: -1, feeling: null, comment: "", pains: [], lastDoneAt: null,
    warmup: S.pax.program.warmup.map(w => ({ label: w, done: false })),
    items: tpl.items.filter(i => exs[i.exId]).map(i => {
      const ex = exs[i.exId], sides = ex.side ? ["G", "D"] : [null], sets = [];
      for (let n = 1; n <= i.sets; n++) sides.forEach(sd => sets.push({ n: n, side: sd, value: i.target, effort: null, clean: true, done: false }));
      return { exId: i.exId, name: ex.name, unit: ex.unit, sidesUsed: !!ex.side, target: i.target, plannedSets: i.sets, note: i.note, sets: sets };
    })
  };
  save(); go("session");
}

VIEWS.session = function () {
  const C = S.pax.current;
  if (!C) { setTimeout(home, 0); return h("div"); }
  keepAwake(true);
  if (C.step === -1) return sessionWarmup(C);
  if (C.step >= C.items.length) return sessionEnd(C);
  return sessionItem(C);
};

function sessionWarmup(C) {
  return screen("Échauffement", "Séance " + C.num + ", " + C.title, [
    h("div", { class: "checks" }, C.warmup.map(w => h("label", { class: "check big" }, [
      h("input", { type: "checkbox", checked: w.done, onchange: e => { w.done = e.target.checked; save(); } }), h("span", { text: w.label })
    ])))
  ], { foot: [h("button", { class: "btn primary big", text: "Passer aux exercices", onclick: () => { C.step = 0; save(); render(); } })] });
}

function sessionItem(C) {
  const exs = paxEx();
  const it = C.items[C.step], ex = exs[it.exId] || {};
  const done = it.sets.filter(s => s.done).length;
  const activeIdx = it.sets.findIndex(s => !s.done);
  const rows = it.sets.map((s, i) => setRow(C, it, ex, s, i, i === activeIdx));
  const rest = h("div", { class: "rest", "aria-live": "off" });
  if (C.lastDoneAt && activeIdx >= 0) {
    const upd = () => { rest.replaceChildren(h("span", { class: "rest-t", text: "Repos " + mmss((Date.now() - new Date(C.lastDoneAt)) / 1000) }), h("span", { class: "rest-s", text: "Reprends quand ta respiration est calme." })); };
    upd(); timers.push(setInterval(upd, 1000));
  }
  return screen(it.name, "Exercice " + (C.step + 1) + " sur " + C.items.length, [
    h("div", { class: "target" }, [h("span", { class: "t-big", text: fmtTarget({ sets: it.plannedSets, target: it.target }, ex) }), tally(it.sets.length, done)]),
    rest,
    it.note ? h("p", { class: "note", text: it.note }) : null,
    ex.side ? h("p", { class: "side", text: ex.side }) : null,
    h("details", { class: "cues", open: C.step === 0 || undefined }, [
      h("summary", { text: "Repères" }),
      ex.cues ? h("p", { text: ex.cues }) : null,
      ex.muscles ? h("p", { class: "hint", text: "Muscles : " + ex.muscles }) : null,
      ex.errors ? h("p", { class: "hint", text: "À éviter : " + ex.errors }) : null
    ]),
    h("div", { class: "sets" }, rows),
    h("div", { class: "row tools" }, [
      h("button", { class: "btn ghost", text: "Douleur", onclick: () => painSheet("Séance " + C.num + ", " + it.name, (p) => { C.pains.push(p.id); save(); }) }),
      S.pax.coach && S.pax.coach.phone ? h("button", { class: "btn ghost", text: "Question au coach", onclick: () => openWhatsApp(S.pax.coach.phone, "Question sur " + it.name + " : ") }) : null
    ])
  ], { foot: [
    h("button", { class: "btn ghost", text: "Précédent", onclick: () => { C.step -= 1; save(); render(); } }),
    h("button", { class: "btn primary", text: C.step === C.items.length - 1 ? "Terminer" : "Exercice suivant", onclick: () => { C.step += 1; save(); render(); } })
  ] });
}

function setRow(C, it, ex, s, i, active) {
  const label = "Série " + s.n + (s.side === "G" ? ", gauche" : s.side === "D" ? ", droite" : "");
  if (s.done && !active) {
    return h("div", { class: "set done" }, [
      h("span", { class: "s-lab", text: label }),
      h("span", { class: "s-res", text: s.value + " " + unitLabel(it.unit, s.value) + (s.effort !== null ? ", effort " + s.effort : "") + (s.clean ? "" : ", forme pas propre") }),
      h("button", { class: "link", text: "Corriger", onclick: () => { s.done = false; save(); render(); } })
    ]);
  }
  if (!active) return h("div", { class: "set todo" }, [h("span", { class: "s-lab", text: label }), h("span", { class: "s-res", text: it.target + " " + unitLabel(it.unit, it.target) })]);
  const box = h("div", { class: "set active" }, [h("span", { class: "s-lab", text: label })]);
  if (it.unit === "s") {
    box.append(chrono(0, ex.plafond || 0, v => { s.value = v; save(); }));
    box.append(h("p", { class: "hint", text: "Objectif : " + it.target + " s. Ajuste si besoin :" }));
  }
  box.append(stepper(s.value, it.unit === "m" ? 50 : it.unit === "s" ? 5 : 1, 0, v => { s.value = v; save(); }));
  const effortWrap = h("div", { class: "effort hidden" }, [
    h("p", { class: "lab", text: "Effort de 0 à 10" }),
    h("p", { class: "hint", text: "8 = encore 1 ou 2 possibles. 10 = impossible d'en faire une de plus." }),
    chips(0, 10, s.effort, v => { s.effort = v; save(); next.disabled = false; }, "Effort"),
    h("label", { class: "check" }, [h("input", { type: "checkbox", checked: s.clean, onchange: e => { s.clean = e.target.checked; save(); } }), h("span", { text: "Forme propre sur toute la série" })])
  ]);
  const next = h("button", { class: "btn primary big", text: "Valider la série", disabled: true, onclick: () => {
    s.done = true; C.lastDoneAt = new Date().toISOString(); save(); vibrate(40); render();
  } });
  const doneBtn = h("button", { class: "btn primary big", text: "Série faite", onclick: () => { doneBtn.remove(); effortWrap.classList.remove("hidden"); box.append(next); } });
  box.append(doneBtn, effortWrap);
  return box;
}

function sessionEnd(C) {
  return screen("Fin de séance", "Séance " + C.num + ", " + C.title, [
    h("p", { class: "lab", text: "Ressenti général, de 0 (très facile) à 10 (impossible)" }),
    chips(0, 10, C.feeling, v => { C.feeling = v; save(); }, "Ressenti"),
    field("Un commentaire pour ton coach", area(C.comment, v => { C.comment = v.slice(0, 1000); save(); }, 4))
  ], { foot: [
    h("button", { class: "btn ghost", text: "Précédent", onclick: () => { C.step -= 1; save(); render(); } }),
    h("button", { class: "btn primary", text: "Enregistrer la séance", onclick: () => {
      const rec = { id: C.id, date: new Date().toISOString(), num: C.num, lieu: C.lieu, title: C.title, feeling: C.feeling, comment: C.comment,
        items: C.items.map(i => ({ exId: i.exId, name: i.name, unit: i.unit, sidesUsed: i.sidesUsed, target: i.target, plannedSets: i.plannedSets,
          sets: i.sets.map(s => ({ side: s.side, value: s.value, effort: s.effort, clean: s.clean, done: s.done })) })) };
      S.pax.sessions.push(rec);
      const nums = Array.from(new Set(S.pax.program.sessions.map(s => s.num))).sort((a, b) => a - b);
      const k = nums.indexOf(C.num);
      S.pax.nextNum = nums[(k + 1) % nums.length];
      S.pax.current = null; save(); keepAwake(false);
      stack = []; go("sent", { title: "Séance enregistrée", message: "Séance " + rec.num + " (" + rec.lieu + ") faite" + (rec.feeling !== null ? ", ressenti " + rec.feeling + "/10" : "") + "." });
    } })
  ] });
}

/* ----- Douleur ----- */

function painSheet(context, onSaved) {
  const d = { zone: "", intensity: null, comment: "" };
  const zoneSel = h("select", { onchange: e => { d.zone = e.target.value; alertBox.classList.toggle("hidden", d.zone !== "Poitrine"); } },
    [h("option", { value: "", text: "Choisis la zone" })].concat(PAIN_ZONES.map(z => h("option", { value: z, text: z }))));
  const alertBox = h("p", { class: "danger-box hidden", text: "Douleur dans la poitrine : arrête la séance tout de suite. Si elle ne passe pas, ou si tu es essoufflé, en sueur ou que la douleur part dans le bras ou la mâchoire, appelle le 15." });
  const wrap = h("div", { class: "sheet-wrap" }, [h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Signaler une douleur" }, [
    h("h2", { text: "Signaler une douleur" }),
    field("Où ?", zoneSel), alertBox,
    h("p", { class: "lab", text: "Intensité de 0 à 10" }),
    chips(0, 10, null, v => { d.intensity = v; }, "Intensité"),
    field("Ce que tu ressens", area("", v => { d.comment = v.slice(0, 600); }, 3)),
    h("p", { class: "hint", text: "Si ça fait mal, arrête l'exercice. Ton coach verra cette douleur dans ton rapport." }),
    h("div", { class: "row" }, [
      h("button", { class: "btn ghost", text: "Annuler", onclick: () => wrap.remove() }),
      h("button", { class: "btn primary", text: "Enregistrer", onclick: () => {
        if (!d.zone) return toast("Choisis la zone.");
        const p = { id: uid(), date: new Date().toISOString(), zone: d.zone, intensity: d.intensity, context: context, comment: d.comment };
        S.pax.pains.push(p); save(); wrap.remove(); toast("Douleur enregistrée."); if (onSaved) onSaved(p);
      } })
    ])
  ])]);
  document.body.append(wrap);
}

/* ----- Pax : test de départ ----- */

function flatTests() {
  const out = [];
  TEST_BLOCKS.forEach(b => b.tests.forEach((t, i) => out.push({ block: b, test: t, first: i === 0 })));
  return out;
}
VIEWS.test = function () {
  const P = S.pax;
  if (!P.testDraft) {
    return screen("Test de départ", "Ton point de départ", [
      h("p", { text: "Ce test sert de point de départ. Tu le refais dans 6 à 8 semaines, à la même heure, dans le même ordre, pour mesurer tes progrès." }),
      h("h2", { text: "Les règles" }),
      h("ol", { class: "steps" }, [
        h("li", { text: "Va au bout. Continue tant que la répétition est propre. Arrête quand tu ne peux plus en faire une propre, ou au plafond." }),
        h("li", { text: "Si tu t'arrêtes avec un effort sous 8 sur 10, ce n'était pas ton maximum." }),
        h("li", { text: "Douleur dans une articulation ou dans la poitrine, vertige : tu arrêtes tout de suite." }),
        h("li", { text: "Repos entre deux tests : reprends quand ta respiration est redevenue calme." }),
        h("li", { text: "Gauche ou droite : c'est toujours le côté qui travaille. C'est précisé à chaque test." })
      ]),
      h("h2", { text: "Matériel" }),
      list(["Un mètre ruban", "Une chaise solide, une marche d'escalier, un mur libre", "Pour le bloc barre : une barre de traction (parc, salle, barre de porte). Sans barre, tu passes ce bloc."])
    ], { foot: [h("button", { class: "btn primary big", text: "Commencer le test", onclick: () => { P.testDraft = { id: uid(), startedAt: new Date().toISOString(), idx: 0, values: {}, skipped: [] }; save(); render(); } })] });
  }
  const D = P.testDraft, all = flatTests();
  if (D.blocked) return testBlocked();
  if (D.idx >= all.length) return testEnd();
  const cur = all[D.idx], t = cur.test, vals = D.values[t.id] = D.values[t.id] || {};
  const kids = [];
  if (t.plafond) kids.push(h("p", { class: "note", text: "Plafond : " + t.plafond + (t.fields[0].type === "chrono" ? " secondes" : " répétitions") }));
  kids.push(h("ol", { class: "steps" }, t.steps.map(s => h("li", { text: s }))));
  t.fields.forEach(f => kids.push(testField(f, vals)));
  if (t.effort) {
    const warn = h("p", { class: "warn hidden", text: "Ce n'était pas ton maximum. Reprends quand ta respiration est calme et recommence." });
    kids.push(h("p", { class: "lab", text: "Effort à l'arrêt, de 0 à 10" }),
      chips(0, 10, vals.effort === undefined ? null : vals.effort, v => { vals.effort = v; save(); warn.classList.toggle("hidden", v >= 8); }, "Effort"), warn,
      h("p", { class: "lab", text: "Ce qui t'a arrêté" }),
      h("div", { class: "chips" }, ["Forme", "Douleur", "Souffle", "Plafond"].map(a => h("button", { class: "chip wide" + (vals.arret === a ? " on" : ""), text: a, onclick: (e) => {
        vals.arret = a; save(); e.target.parentNode.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === e.target));
        if (a === "Douleur") painSheet("Test de départ, " + t.name);
      } }))));
  }
  if (cur.block.optional && cur.first) kids.unshift(h("button", { class: "btn ghost", text: "Pas de barre : passer ce bloc", onclick: () => {
    D.skipped.push(cur.block.id); const n = cur.block.tests.length; D.idx += n; save(); render();
  } }));
  return screen(t.name, cur.block.name + ", test " + (D.idx + 1) + " sur " + all.length, kids, { foot: [
    h("button", { class: "btn ghost", text: "Précédent", onclick: () => { if (D.idx > 0) { D.idx -= 1; while (D.idx > 0 && D.skipped.includes(all[D.idx].block.id)) D.idx -= 1; save(); render(); } else back(); } }),
    h("button", { class: "btn primary", text: "Suivant", onclick: () => {
      if (t.id === "sante" && (vals.coeur === true || vals.malaise === true)) { D.blocked = true; save(); render(); return; }
      D.idx += 1; save(); render();
    } })
  ] });
};
function testField(f, vals) {
  const set = v => { vals[f.id] = v; save(); };
  if (f.type === "num") return field(f.label + (f.unit ? " (" + f.unit + ")" : ""), input("number", vals[f.id], v => { const n = num(String(v).replace(",", ".")); set(n); }));
  if (f.type === "text") return field(f.label, input("text", vals[f.id], v => set(v.slice(0, 300))));
  if (f.type === "check") return h("label", { class: "check big" }, [h("input", { type: "checkbox", checked: !!vals[f.id], onchange: e => set(e.target.checked) }), h("span", { text: f.label })]);
  if (f.type === "yesno") {
    return h("div", { class: "q" }, [h("p", { text: f.label }), h("div", { class: "chips" }, [["Oui", true], ["Non", false]].map(([l, v]) => h("button", { class: "chip wide" + (vals[f.id] === v ? " on" : ""), text: l, onclick: (e) => {
      set(v); e.target.parentNode.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === e.target)); } })))]);
  }
  if (f.type === "radio") {
    return h("fieldset", { class: "radio" }, [h("legend", { text: f.label })].concat(f.options.map(o => h("label", { class: "check" }, [
      h("input", { type: "radio", name: f.id, checked: vals[f.id] === o, onchange: () => set(o) }), h("span", { text: o })]))));
  }
  if (f.type === "chrono") {
    const manual = input("number", vals[f.id], v => set(num(String(v).replace(",", "."))));
    return h("div", { class: "q" }, [h("p", { class: "lab", text: f.label }), chrono(0, f.max, v => { set(v); manual.value = v; }), field("Temps en secondes", manual)]);
  }
  if (f.type === "minute") {
    const out = h("output", { class: "chrono-val", text: "1:00" });
    const b = h("button", { class: "btn ghost", text: f.label, onclick: () => {
      const st = Date.now(); b.disabled = true;
      const t = setInterval(() => { const left = 60 - (Date.now() - st) / 1000; out.textContent = mmss(Math.max(0, left));
        if (left <= 0) { clearInterval(t); vibrate(600); b.disabled = false; toast("Prends ton pouls maintenant."); } }, 250);
      timers.push(t);
    } });
    return h("div", { class: "q" }, [out, b]);
  }
  return h("span");
}
function testBlocked() {
  const D = S.pax.testDraft;
  return screen("Ne fais pas le test", null, [
    h("p", { class: "danger-box", text: "Tu as répondu oui à une question sur le cœur, la tension ou un malaise à l'effort. Contacte ton coach avant tout effort. Un avis médical est nécessaire." }),
    S.pax.coach && S.pax.coach.phone ? h("button", { class: "btn primary big", text: "Prévenir mon coach", onclick: () => openWhatsApp(S.pax.coach.phone, "J'ai répondu oui à une question de santé du test de départ, je ne l'ai pas fait.") }) : null
  ], { foot: [h("button", { class: "btn ghost", text: "J'ai compris", onclick: () => {
    S.pax.tests.push({ id: D.id, date: new Date().toISOString(), blocked: true, skipped: [], values: D.values }); S.pax.testDraft = null; S.pax.testRequest = null; save(); home();
  } })] });
}
function testEnd() {
  const D = S.pax.testDraft;
  return screen("Test terminé", null, [
    h("p", { text: "Tes résultats sont enregistrés. Envoie ton rapport à ton coach depuis l'accueil." }),
    h("p", { class: "hint", text: "N'oublie pas la photo du squat bras en l'air : envoie-la directement à ton coach sur WhatsApp." })
  ], { foot: [
    h("button", { class: "btn ghost", text: "Revoir le dernier test", onclick: () => { D.idx -= 1; save(); render(); } }),
    h("button", { class: "btn primary", text: "Enregistrer le test", onclick: () => {
      S.pax.tests.push({ id: D.id, date: new Date().toISOString(), blocked: false, skipped: D.skipped, values: D.values });
      S.pax.testRequest = null;
      S.pax.testDraft = null; save();
      stack = []; go("sent", { title: "Test enregistré", message: "Test de départ fait." });
    } })
  ] });
}

/* ----- Pax : historique, mesures, rapport, réglages ----- */

VIEWS.history = function () {
  const P = S.pax;
  const items = P.sessions.slice().reverse().map(s => navRow("Séance " + s.num + ", " + s.lieu, frDate(s.date) + (s.feeling !== null ? ", ressenti " + s.feeling + "/10" : ""), () => go("sessionDetail", { id: s.id, who: "pax" })));
  return screen("Mes séances", null, items.length ? [h("nav", { class: "menu" }, items)] : [h("p", { text: "Aucune séance pour l'instant. Ta première apparaîtra ici." })]);
};
VIEWS.sessionDetail = function (p) {
  const src = p.who === "pax" ? S.pax.sessions : (S.coach.pax.find(x => x.id === p.paxId) || { sessions: [] }).sessions;
  const s = src.find(x => x.id === p.id);
  if (!s) return screen("Séance introuvable", null, []);
  return screen("Séance " + s.num + ", " + s.lieu, frDate(s.date), [
    s.feeling !== null ? h("p", { text: "Ressenti : " + s.feeling + "/10" }) : null,
    s.comment ? h("p", { class: "note", text: s.comment }) : null
  ].concat(s.items.map(i => h("section", { class: "detail" }, [
    h("h2", { text: i.name }),
    h("p", { class: "hint", text: "Prévu : " + i.plannedSets + " × " + i.target + (i.unit === "s" ? " s" : i.unit === "m" ? " m" : "") + (i.sidesUsed ? " par côté" : "") }),
    h("ul", { class: "list" }, i.sets.map(x => h("li", { class: x.done ? "" : "muted", text:
      (x.side === "G" ? "Gauche : " : x.side === "D" ? "Droite : " : "") + (x.done ? x.value + " " + unitLabel(i.unit, x.value) : "pas faite") +
      (x.effort !== null && x.effort !== undefined ? ", effort " + x.effort : "") + (x.done && !x.clean ? ", forme pas propre" : "") })))
  ]))));
};

VIEWS.measures = function () {
  const P = S.pax, d = { poids: null, tour: null, pouls: null };
  const rows = P.measures.slice().reverse().map(m => h("li", { text: frDate(m.date) + " : " + [m.poids ? m.poids + " kg" : "", m.tour ? "taille " + m.tour + " cm" : "", m.pouls ? "pouls " + m.pouls : ""].filter(Boolean).join(", ") }));
  return screen("Mesures", "Le matin, avant de manger, pour comparer", [
    field("Poids (kg)", input("number", "", v => { d.poids = num(String(v).replace(",", ".")); })),
    field("Tour de taille (cm)", input("number", "", v => { d.tour = num(String(v).replace(",", ".")); }), "Au niveau du nombril, ventre relâché."),
    field("Pouls au repos", input("number", "", v => { d.pouls = num(v); }), "Compte 15 secondes et multiplie par 4."),
    h("button", { class: "btn primary", text: "Ajouter", onclick: () => {
      if (d.poids === null && d.tour === null && d.pouls === null) return toast("Remplis au moins une mesure.");
      P.measures.push({ id: uid(), date: new Date().toISOString(), poids: d.poids, tour: d.tour, pouls: d.pouls }); save(); render();
    } }),
    rows.length ? h("h2", { text: "Historique" }) : null,
    rows.length ? h("ul", { class: "list" }, rows) : null
  ]);
};

function buildReport(since) {
  const P = S.pax;
  const from = since ? new Date(new Date(since).getTime() - 14 * 86400000).toISOString() : "";
  const recent = list => list.filter(x => !from || (x.date || "") >= from);
  return { type: "nafuu-rapport", v: 1, generatedAt: new Date().toISOString(), paxId: P.paxId || (P.paxId = uid()), profile: P.profile, consent: P.consent,
    sessions: recent(P.sessions), tests: P.tests, measures: recent(P.measures), pains: recent(P.pains) };
}
function sendReport(message) {
  const P = S.pax, since = P.lastReportAt, r = buildReport(since); P.lastReportAt = r.generatedAt; save();
  sendLink(r, (message || ("Rapport de " + (P.profile.firstName || "ton pax"))) + " Ouvre le lien pour l'ajouter dans Nafuu Health :",
    P.coach && P.coach.phone, "rapport-" + (P.profile.firstName || "pax").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + r.generatedAt.slice(0, 10) + ".json");
}
VIEWS.sent = function (params) {
  const P = S.pax;
  return screen(params.title, null, [
    h("p", { text: "Envoie-le maintenant à ton coach : il verra ta progression et pourra ajuster ton programme." }),
    h("p", { class: "hint", text: "Choisis WhatsApp puis la conversation avec ton coach." }),
    P.coach && P.coach.name ? h("p", { class: "hint", text: "Coach : " + P.coach.name }) : null
  ], { noBack: true, foot: [
    h("button", { class: "btn ghost", text: "Plus tard", onclick: home }),
    h("button", { class: "btn primary", text: "Envoyer à mon coach", onclick: () => { sendReport(params.message); home(); } })
  ] });
};
VIEWS.report = function () {
  const P = S.pax;
  return screen("Envoyer mon rapport", null, [
    h("p", { text: "Le rapport contient tes séances, tes tests, tes mesures et les douleurs signalées. Choisis WhatsApp puis la conversation avec ton coach." }),
    P.lastReportAt ? h("p", { class: "hint", text: "Dernier envoi : " + frDate(P.lastReportAt) }) : null
  ], { foot: [h("button", { class: "btn primary big", text: "Envoyer le rapport", onclick: () => {
    sendReport();
  } })] });
};

VIEWS.paxSettings = function () {
  const P = S.pax;
  return screen("Réglages", null, [
    h("section", { class: "info" }, [
      h("p", { text: "Prénom : " + P.profile.firstName }),
      h("p", { text: "Consentement donné le " + frDate(P.consent && P.consent.date) + (P.consent && P.consent.parent ? ", avec l'accord de " + P.consent.parent : "") })
    ]),
    h("nav", { class: "menu" }, [
      navRow("Sauvegarder mes données", "Un fichier à garder en lieu sûr", () => shareFile("sauvegarde-nafuu-health-" + new Date().toISOString().slice(0, 10) + ".json", { type: "nafuu-sauvegarde", v: 1, date: new Date().toISOString(), data: S })),
      navRow("Restaurer une sauvegarde", null, pickFile),
      navRow("Retirer mon consentement et tout effacer", "Efface toutes tes données de ce téléphone", () => confirmSheet("Tout effacer ?", "Toutes tes séances, tests, mesures et douleurs seront supprimés de ce téléphone. Ce qui a déjà été envoyé à ton coach reste chez lui : demande-lui de l'effacer.", "Tout effacer", wipe, true))
    ])
  ]);
};
function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* rien */ } S = { v: 1, role: null }; keepAwake(false); stack = []; go("welcome"); }

/* ----- Coach ----- */

VIEWS.coachSetup = function () {
  const d = { name: "", phone: "" };
  return screen("Profil coach", null, [
    field("Ton nom, tel que tes pax le verront", input("text", "", v => { d.name = v; })),
    field("Ton numéro WhatsApp", input("tel", "", v => { d.phone = v; }, { inputmode: "tel", placeholder: "+33 6 12 34 56 78" }), "Avec l'indicatif du pays. Tes pax pourront t'écrire depuis un exercice."),
    h("p", { class: "hint", text: "Les données de tes pax restent sur ce téléphone. Protège-le avec un code de verrouillage." })
  ], { foot: [h("button", { class: "btn primary big", text: "Créer mon espace", onclick: () => {
    if (!d.name.trim()) return toast("Indique ton nom.");
    let ph = d.phone.replace(/[^\d+]/g, ""); if (ph.startsWith("0")) ph = "33" + ph.slice(1); ph = ph.replace(/\D/g, "");
    S.role = "coach"; S.coach = { name: d.name.trim().slice(0, 80), phone: ph.slice(0, 15), exercises: JSON.parse(JSON.stringify(SEED_EXERCISES)), pax: [] };
    save(); home();
  } })] });
};

function paxAlerts(p) {
  const a = [];
  if (!p.connectedAt) a.push(p.invitedAt ? "Invité le " + shortDate(p.invitedAt) + ", pas encore confirmé" : "Pas encore invité");
  const last = p.sessions.length ? p.sessions.slice().sort((x, y) => (x.date < y.date ? 1 : -1))[0] : null;
  const ds = last ? daysSince(last.date) : null;
  if (p.tests.some(t => t.blocked)) a.push("Test bloqué par une question de santé");
  const recentPains = p.pains.filter(x => daysSince(x.date) !== null && daysSince(x.date) <= 14);
  if (recentPains.length) a.push(recentPains.length + " douleur" + (recentPains.length > 1 ? "s" : "") + " sur 14 jours");
  if (ds !== null && ds > 5) a.push(ds + " jours sans séance");
  const hard = p.sessions.slice(-2).filter(s => s.items.some(i => i.sets.some(x => x.effort >= 9)));
  if (hard.length === 2) a.push("Effort de 9 ou plus deux fois de suite");
  const pend = (p.proposals || []).filter(x => x.status === "pending").length;
  if (pend) a.push(pend + " progression" + (pend > 1 ? "s" : "") + " à valider");
  if (p.programDirty) a.push("Programme pas encore envoyé");
  if (p.draft) a.push("Programme proposé d'après le test, à valider");
  if (p.programSentAt && !p.programDirty) {
    const weeks = (p.program && p.program.cycleWeeks) || 4, dsent = daysSince(p.programSentAt);
    const lastT = p.tests.length ? p.tests[p.tests.length - 1].date : null;
    if (dsent !== null && dsent >= weeks * 7 && (!lastT || lastT < p.programSentAt)) a.push("Cycle de " + weeks + " semaines terminé : envoie-lui le test de départ");
  }
  return a;
}

VIEWS.coachHome = function () {
  const C = S.coach;
  const sorted = C.pax.slice().sort((a, b) => paxAlerts(b).length - paxAlerts(a).length);
  return screen("Tes pax", C.name, [
    h("div", { class: "row" }, [
      h("button", { class: "btn primary", text: "Ajouter un pax", onclick: () => go("coachAddPax") }),
      h("button", { class: "btn ghost", text: "Importer un rapport", onclick: () => go("paste", { title: "Importer un rapport", lead: "Dans WhatsApp, reste appuyé sur le message de ton pax, copie-le, puis colle-le ici." }) })
    ]),
    sorted.length ? h("nav", { class: "menu" }, sorted.map(p => {
      const al = paxAlerts(p);
      return navRow(p.name, al.length ? al.join(". ") : (p.lastReportAt ? "Dernier rapport le " + frDate(p.lastReportAt) : "Aucun rapport reçu"), () => go("coachPax", { id: p.id }), p.unseen ? "Nouveau" : null);
    })) : h("p", { text: "Aucun pax pour l'instant. Ajoute ton premier pax, puis envoie-lui son programme." }),
    h("nav", { class: "menu" }, [
      navRow("Bibliothèque d'exercices", C.exercises.length + " exercices", () => go("library")),
      navRow("Réglages", "Profil, sauvegarde, effacement", () => go("coachSettings")),
      installRow()
    ])
  ], { noBack: true });
};

VIEWS.coachAddPax = function () {
  let name = "", phone = "";
  return screen("Nouveau pax", null, [
    field("Prénom et nom", input("text", "", v => { name = v; })),
    field("Son WhatsApp", input("tel", "", v => { let d = v.replace(/[^\d+]/g, ""); if (d.startsWith("0")) d = "33" + d.slice(1); phone = d.replace(/\D/g, "").slice(0, 15); }, { inputmode: "tel", placeholder: "+33 6 12 34 56 78" }), "Pour lui envoyer l'invitation et ses programmes."),
    h("p", { class: "hint", text: "Le pax reçoit le programme type (maison et salle). Tu peux le modifier avant de l'envoyer." })
  ], { foot: [h("button", { class: "btn primary big", text: "Ajouter", onclick: () => {
    if (!name.trim()) return toast("Indique un nom.");
    const p = newCoachPax(name.trim().slice(0, 80)); p.phone = phone; S.coach.pax.push(p); save(); go("coachPax", { id: p.id }, true);
  } })] });
};

function sendTest(p) {
  const file = { type: "nafuu-test", v: 1, issuedAt: new Date().toISOString(), message: (p.testMessage || "").slice(0, 1000),
    coach: { name: S.coach.name, phone: S.coach.phone }, pax: { id: p.id, name: p.name } };
  p.testSentAt = file.issuedAt; save();
  sendLink(file, "Ton test de départ : ouvre ce lien, il s'ouvre dans Nafuu Health. Fais le test puis envoie-moi le rapport.", p.phone,
    "test-" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json");
  render();
}
VIEWS.draft = function (params) {
  const p = S.coach.pax.find(x => x.id === params.id);
  if (!p || !p.draft) return screen("Aucune proposition", null, []);
  const D = p.draft, exs = exMapAll();
  const groups = D.program.sessions.map(s => h("section", { class: "detail" }, [
    h("h3", { text: "Séance " + s.num + ", " + s.lieu + " : " + s.title }),
    h("ul", { class: "list" }, s.items.map(i => {
      const e = exs[i.exId] || { name: i.exId, unit: "reps" };
      return h("li", { text: e.name + " : " + fmtTarget(i, e) + (i.note ? ". " + i.note : "") });
    }))
  ]));
  return screen("Programme proposé", "Pour " + p.name + ", d'après son test", [
    h("h2", { text: "Pourquoi ces choix" }),
    h("ul", { class: "list" }, D.reasons.map(r => h("li", { text: r }))),
    h("p", { class: "hint", text: "Après validation, tu peux encore tout modifier avant d'envoyer." })
  ].concat(groups), { foot: [
    h("button", { class: "btn ghost", text: "Ignorer", onclick: () => confirmSheet("Ignorer cette proposition ?", "Le programme actuel reste tel quel.", "Ignorer", () => { p.draft = null; save(); back(); }) }),
    h("button", { class: "btn primary", text: "Valider", onclick: () => {
      p.program = JSON.parse(JSON.stringify(D.program)); p.draft = null; p.programDirty = true;
      p.proposals = (p.proposals || []).filter(x => x.status !== "pending");
      save(); toast("Programme remplacé. Vérifie-le puis envoie-le."); stack.pop(); go("programEdit", { id: p.id }, false);
    } })
  ] });
};
function sendProgram(p) {
  const exs = coachEx(), used = {};
  p.program.sessions.forEach(s => s.items.forEach(i => { if (exs[i.exId]) used[i.exId] = exs[i.exId]; }));
  const file = { type: "nafuu-programme", v: 1, issuedAt: new Date().toISOString(), message: (p.messageDraft || "").slice(0, 1000), coach: { name: S.coach.name, phone: S.coach.phone },
    pax: { id: p.id, name: p.name }, cycleWeeks: p.program.cycleWeeks, warmup: p.program.warmup, sessions: p.program.sessions, exercises: Object.values(used) };
  p.programSentAt = file.issuedAt; p.programDirty = false; save();
  sendLink(file, "Ton programme" + (p.messageDraft ? " : " + p.messageDraft.slice(0, 300) : "") + ". Ouvre ce lien, il s'ouvre dans Nafuu Health :", p.phone,
    "programme-" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json");
}

VIEWS.coachPax = function (params) {
  const p = S.coach.pax.find(x => x.id === params.id);
  if (!p) return screen("Pax introuvable", null, []);
  if (p.unseen) { p.unseen = false; save(); }
  const al = paxAlerts(p).filter(x => !/progression|Programme pas|Programme proposé/.test(x));
  const pend = (p.proposals || []).filter(x => x.status === "pending");
  const lastTest = p.tests.length ? p.tests[p.tests.length - 1] : null;
  const notes = area(p.notes, v => { p.notes = v.slice(0, 5000); save(); }, 4);
  return screen(p.name, p.lastReportAt ? "Dernier rapport le " + frDate(p.lastReportAt) : "Aucun rapport reçu", [
    al.length ? h("section", { class: "alerts" }, al.map(x => h("p", { class: "warn", text: x }))) : null,
    h("section", null, [
      h("h2", { text: "Connexion" }),
      h("p", { class: p.connectedAt ? "" : "hint", text: p.connectedAt ? "Connecté depuis le " + frDate(p.connectedAt) + "." : (p.invitedAt ? "Invitation envoyée le " + frDate(p.invitedAt) + ". Il te préviendra sur WhatsApp une fois l'app installée." : "Pas encore invité.") }),
      h("div", { class: "row" }, [
        h("button", { class: "btn primary", text: p.invitedAt ? "Renvoyer l'invitation" : "Inviter sur WhatsApp", onclick: () => sendInvite(p) }),
        p.connectedAt ? null : h("button", { class: "btn ghost", text: "Il m'a prévenu", onclick: () => { p.connectedAt = new Date().toISOString(); save(); toast(p.name + " est noté comme connecté."); render(); } })
      ])
    ]),
    h("section", null, [
      h("h2", { text: "Test de départ" }),
      h("p", { class: "hint", text: p.testSentAt ? "Envoyé le " + frDate(p.testSentAt) + (p.tests.some(t => t.date > p.testSentAt) ? ", résultats reçus." : ", en attente de ses résultats.")
        : p.tests.length ? "Résultats reçus le " + frDate(p.tests[p.tests.length - 1].date) + "." : "Pas encore envoyé." }),
      h("div", { class: "row" }, [
        h("button", { class: "btn ghost", text: p.testSentAt || p.tests.length ? "Renvoyer le test de départ" : "Envoyer le test de départ", onclick: () => sendTest(p) }),
        h("button", { class: "btn ghost", text: "Importer un test pour " + p.name.split(" ")[0], onclick: () => pickFile(p.id) })
      ])
    ]),
    p.draft ? h("section", null, [
      h("h2", { text: "Programme proposé d'après le test" }),
      h("p", { class: "hint", text: "Préparé automatiquement le " + frDate(p.draft.createdAt) + ". Rien n'est envoyé sans toi." }),
      h("div", { class: "row" }, [h("button", { class: "btn primary", text: "Voir et valider", onclick: () => go("draft", { id: p.id }) })])
    ]) : null,
    h("section", null, [
      h("h2", { text: "Programme" }),
      h("p", { class: "hint", text: p.programSentAt ? (p.programDirty ? "Modifié depuis le dernier envoi du " + frDate(p.programSentAt) : "Envoyé le " + frDate(p.programSentAt)) : "Jamais envoyé" }),
      field("Message joint au programme", area(p.messageDraft || "", v => { p.messageDraft = v.slice(0, 1000); save(); }, 3), "Il s'affiche sur l'accueil de ton pax quand il ouvre le programme."),
      h("div", { class: "row" }, [
        h("button", { class: "btn ghost", text: "Modifier", onclick: () => go("programEdit", { id: p.id }) }),
        h("button", { class: "btn primary", text: "Envoyer le programme", onclick: () => sendProgram(p) })
      ])
    ]),
    pend.length ? h("section", null, [h("h2", { text: "Progressions à valider" }),
      pend.length > 1 ? h("button", { class: "btn primary", text: "Tout valider (" + pend.length + ")", onclick: () => {
        pend.forEach(pr => { applyProposal(p, pr, null); pr.status = "accepted"; p.decided.push(pr.key); });
        save(); toast("Tout est validé. Pense à renvoyer le programme."); render();
      } }) : null].concat(pend.map(pr => proposalCard(p, pr)))) : null,
    h("section", null, [
      h("h2", { text: "Séances" }),
      p.sessions.length ? h("nav", { class: "menu" }, p.sessions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12).map(s =>
        navRow("Séance " + s.num + ", " + s.lieu, frDate(s.date) + (s.feeling !== null ? ", ressenti " + s.feeling + "/10" : "") + (s.comment ? ". « " + s.comment.slice(0, 80) + " »" : ""), () => go("sessionDetail", { id: s.id, paxId: p.id, who: "coach" })))) : h("p", { class: "hint", text: "Aucune séance reçue." })
    ]),
    h("section", null, [h("h2", { text: "Test de départ" }), lastTest ? testSummary(lastTest, p.tests.length > 1 ? p.tests[p.tests.length - 2] : null) : h("p", { class: "hint", text: "Pas encore reçu." })]),
    p.pains.length ? h("section", null, [h("h2", { text: "Douleurs" }), h("ul", { class: "list" }, p.pains.slice().reverse().slice(0, 15).map(x =>
      h("li", { text: shortDate(x.date) + ", " + x.zone + (x.intensity !== null ? ", " + x.intensity + "/10" : "") + (x.context ? ", " + x.context : "") + (x.comment ? ". " + x.comment : "") })))]) : null,
    p.measures.length ? h("section", null, [h("h2", { text: "Mesures" }), h("ul", { class: "list" }, p.measures.slice().reverse().slice(0, 10).map(m =>
      h("li", { text: shortDate(m.date) + " : " + [m.poids ? m.poids + " kg" : "", m.tour ? "taille " + m.tour + " cm" : "", m.pouls ? "pouls " + m.pouls : ""].filter(Boolean).join(", ") })))]) : null,
    h("section", null, [
      h("h2", { text: "Contact" }),
      field("WhatsApp de " + p.name, input("tel", p.phone ? "+" + p.phone : "", v => { let d = v.replace(/[^\d+]/g, ""); if (d.startsWith("0")) d = "33" + d.slice(1); p.phone = d.replace(/\D/g, "").slice(0, 15); save(); }, { inputmode: "tel", placeholder: "+33 6 12 34 56 78" })),
      h("button", { class: "btn ghost", text: "Écrire sur WhatsApp", onclick: () => openWhatsApp(p.phone, "") })
    ]),
    h("section", null, [h("h2", { text: "Notes privées" }), h("p", { class: "hint", text: "Jamais envoyées au pax." }), notes]),
    h("button", { class: "link danger", text: "Supprimer ce pax et ses données", onclick: () => confirmSheet("Supprimer " + p.name + " ?", "Son programme, ses rapports, ses tests et tes notes seront effacés de ce téléphone.", "Supprimer", () => {
      S.coach.pax = S.coach.pax.filter(x => x.id !== p.id); save(); back();
    }, true) })
  ]);
};

function proposalCard(p, pr) {
  const ex = coachEx()[pr.exId] || { unit: "reps" };
  const u = ex.unit === "s" ? " s" : ex.unit === "m" ? " m" : "";
  const what = pr.kind === "target" ? pr.from.sets + " × " + pr.from.target + u + "  devient  " + pr.to.sets + " × " + pr.to.target + u
    : (pr.kind === "harder" ? "Version plus difficile : " : "Version plus facile : ") + pr.newName + ", " + pr.to.sets + " × " + pr.to.target + u;
  let custom = null;
  return h("div", { class: "proposal" }, [
    h("p", { class: "p-title", text: pr.exName + " (séance " + pr.num + ", " + pr.lieu + ")" }),
    h("p", { text: what }),
    h("p", { class: "hint", text: pr.reason }),
    field("Autre valeur (facultatif)", input("number", "", v => { custom = num(v); })),
    h("div", { class: "row" }, [
      h("button", { class: "btn ghost", text: "Refuser", onclick: () => { pr.status = "refused"; p.decided.push(pr.key); save(); render(); } }),
      h("button", { class: "btn primary", text: "Valider", onclick: () => {
        applyProposal(p, pr, custom !== null ? { sets: pr.to.sets, target: custom } : null);
        pr.status = "accepted"; p.decided.push(pr.key); save(); toast("Validé. Pense à renvoyer le programme."); render();
      } })
    ])
  ]);
}

function testLabel(testId, fieldId) {
  for (const b of TEST_BLOCKS) for (const t of b.tests) if (t.id === testId) {
    const f = t.fields.find(x => x.id === fieldId);
    if (!f && (fieldId === "note" || fieldId === "notes")) return { test: t.name, field: "Remarque", unit: "" };
    return { test: t.name, field: f ? f.label : fieldId, unit: f && f.type === "chrono" ? "s" : (f && f.unit) || "" };
  }
  return { test: testId, field: fieldId, unit: "" };
}
function testSummary(t, prev) {
  if (t.blocked) return h("p", { class: "danger-box", text: "Test bloqué le " + frDate(t.date) + " : réponse oui à une question cœur, tension ou malaise." });
  const out = [h("p", { class: "hint", text: "Fait le " + frDate(t.date) + (t.skipped.length ? ". Bloc passé : " + t.skipped.join(", ") : "") + (prev && !prev.blocked ? ". Comparé au test du " + frDate(prev.date) : "") })];
  Object.keys(t.values).forEach(tid => {
    const v = t.values[tid];
    if (["echauffement"].includes(tid)) return;
    const lines = [];
    Object.keys(v).forEach(fid => {
      if (fid === "effort" || fid === "arret" || v[fid] === null || v[fid] === "" || v[fid] === undefined) return;
      const L = testLabel(tid, fid);
      const val = v[fid] === true ? "oui" : v[fid] === false ? "non" : String(v[fid]) + (L.unit ? " " + L.unit : "");
      let delta = "";
      if (prev && prev.values[tid] && typeof prev.values[tid][fid] === "number" && typeof v[fid] === "number") {
        const d = Math.round((v[fid] - prev.values[tid][fid]) * 10) / 10; if (d) delta = " (" + (d > 0 ? "+" : "") + d + ")";
      }
      lines.push(L.field + " : " + val + delta);
    });
    if (v.effort !== undefined && v.effort !== null) lines.push("Effort à l'arrêt : " + v.effort + "/10" + (v.effort < 8 ? ", pas un maximum" : "") + (v.arret ? ", arrêt : " + v.arret.toLowerCase() : ""));
    const pairs = [["g", "d"], ["og", "od"], ["fg", "fd"]];
    pairs.forEach(([a, b]) => {
      if (typeof v[a] === "number" && typeof v[b] === "number" && Math.max(v[a], v[b]) > 0) {
        const gap = Math.abs(v[a] - v[b]) / Math.max(v[a], v[b]);
        if (gap > 0.15) lines.push("Écart gauche/droite de " + Math.round(gap * 100) + " %");
      }
    });
    if (lines.length) out.push(h("div", { class: "detail" }, [h("h3", { text: testLabel(tid, "").test }), h("ul", { class: "list" }, lines.map(l => h("li", { class: /Écart|pas un maximum/.test(l) ? "flag" : "", text: l })))]));
  });
  return h("div", null, out);
}

/* ----- Coach : programme ----- */

VIEWS.programEdit = function (params) {
  const p = S.coach.pax.find(x => x.id === params.id);
  if (!p) return screen("Pax introuvable", null, []);
  const exs = coachEx(), P = p.program;
  const dirty = () => { p.programDirty = true; save(); };
  const groups = P.sessions.slice().sort((a, b) => a.num - b.num || (a.lieu > b.lieu ? 1 : -1)).map(s => h("section", { class: "prog" }, [
    h("div", { class: "prog-h" }, [
      h("h2", { text: "Séance " + s.num + ", " + s.lieu }),
      h("button", { class: "link danger", text: "Supprimer", onclick: () => confirmSheet("Supprimer la séance " + s.num + " " + s.lieu + " ?", null, "Supprimer", () => { P.sessions.splice(P.sessions.indexOf(s), 1); dirty(); render(); }, true) })
    ]),
    field("Titre", input("text", s.title, v => { s.title = v.slice(0, 120); dirty(); })),
    h("ol", { class: "items" }, s.items.map((it, i) => {
      const ex = exs[it.exId] || { name: "Exercice supprimé", unit: "reps" };
      return h("li", { class: "item" }, [
        h("p", { class: "i-name", text: ex.name + (ex.side ? " (par côté)" : "") }),
        h("div", { class: "i-row" }, [
          h("span", { class: "hint", text: "Séries" }), stepper(it.sets, 1, 1, v => { it.sets = v; dirty(); }),
          h("span", { class: "hint", text: ex.unit === "s" ? "Secondes" : ex.unit === "m" ? "Mètres" : "Rép." }), stepper(it.target, ex.unit === "m" ? 50 : ex.unit === "s" ? 5 : 1, 0, v => { it.target = v; dirty(); })
        ]),
        field("Consigne", input("text", it.note, v => { it.note = v.slice(0, 300); dirty(); })),
        h("div", { class: "row small" }, [
          h("button", { class: "btn ghost", "aria-label": "Monter", text: "Monter", disabled: i === 0, onclick: () => { s.items.splice(i - 1, 0, s.items.splice(i, 1)[0]); dirty(); render(); } }),
          h("button", { class: "btn ghost", "aria-label": "Descendre", text: "Descendre", disabled: i === s.items.length - 1, onclick: () => { s.items.splice(i + 1, 0, s.items.splice(i, 1)[0]); dirty(); render(); } }),
          h("button", { class: "btn ghost danger", text: "Retirer", onclick: () => { s.items.splice(i, 1); dirty(); render(); } })
        ])
      ]);
    })),
    h("button", { class: "btn ghost", text: "Ajouter un exercice", onclick: () => go("pickExercise", { paxId: p.id, num: s.num, lieu: s.lieu }) })
  ]));
  return screen("Programme de " + p.name, "Modifié = à renvoyer au pax", [
    field("Durée du cycle (semaines)", stepper(P.cycleWeeks, 1, 1, v => { P.cycleWeeks = v; dirty(); })),
    field("Échauffement (une étape par ligne)", area(P.warmup.join("\n"), v => { P.warmup = v.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 30); dirty(); }, 6))
  ].concat(groups).concat([
    h("button", { class: "btn ghost", text: "Ajouter une séance", onclick: () => {
      const max = Math.max.apply(null, P.sessions.map(s => s.num).concat([0]));
      P.sessions.push({ num: max + 1, lieu: "maison", title: "Nouvelle séance", items: [] }, { num: max + 1, lieu: "salle", title: "Nouvelle séance", items: [] });
      dirty(); render();
    } })
  ]), { foot: [h("button", { class: "btn primary big", text: "Envoyer le programme", onclick: () => sendProgram(p) })] });
};

VIEWS.pickExercise = function (params) {
  const p = S.coach.pax.find(x => x.id === params.paxId);
  const s = p && p.program.sessions.find(x => x.num === params.num && x.lieu === params.lieu);
  let q = "";
  const box = h("nav", { class: "menu" });
  const fill = () => {
    box.replaceChildren.apply(box, S.coach.exercises.filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase())).map(e => navRow(e.name, e.lieu + (e.unit === "s" ? ", en secondes" : e.unit === "m" ? ", en mètres" : ""), () => {
      s.items.push({ exId: e.id, sets: 3, target: e.unit === "s" ? 20 : e.unit === "m" ? 200 : 8, note: "" }); p.programDirty = true; save(); back();
    })));
  };
  fill();
  return screen("Ajouter un exercice", "Séance " + params.num + ", " + params.lieu, [field("Chercher", input("search", "", v => { q = v; fill(); })), box]);
};

/* ----- Coach : bibliothèque ----- */

VIEWS.library = function () {
  return screen("Bibliothèque", "Tes repères anatomiques, exercice par exercice", [
    h("button", { class: "btn primary", text: "Nouvel exercice", onclick: () => go("exerciseEdit", { id: null }) }),
    h("nav", { class: "menu" }, S.coach.exercises.slice().sort((a, b) => a.name.localeCompare(b.name, "fr")).map(e => navRow(e.name, e.cues ? e.cues.slice(0, 70) + (e.cues.length > 70 ? "…" : "") : "Repères à écrire", () => go("exerciseEdit", { id: e.id }))))
  ]);
};
VIEWS.exerciseEdit = function (params) {
  const existing = params.id ? S.coach.exercises.find(e => e.id === params.id) : null;
  const e = existing ? Object.assign({}, existing) : { id: "x" + uid(), name: "", unit: "reps", side: null, lieu: "les deux", muscles: "", cues: "", errors: "", harder: "", easier: "", plafond: 0 };
  const unit = h("select", { onchange: ev => { e.unit = ev.target.value; } }, [["reps", "Répétitions"], ["s", "Secondes (position tenue)"], ["m", "Distance (mètres)"]].map(([v, l]) => h("option", { value: v, text: l, selected: e.unit === v || undefined })));
  const lieu = h("select", { onchange: ev => { e.lieu = ev.target.value; } }, ["maison", "salle", "les deux"].map(v => h("option", { value: v, text: v, selected: e.lieu === v || undefined })));
  return screen(existing ? e.name : "Nouvel exercice", null, [
    field("Nom", input("text", e.name, v => { e.name = v.slice(0, 120); })),
    field("Mesure", unit), field("Lieu", lieu),
    field("Côté (vide si les deux côtés travaillent ensemble)", input("text", e.side || "", v => { e.side = v.trim() ? v.slice(0, 120) : null; }), "Exemple : Gauche = pied gauche devant"),
    field("Muscles", input("text", e.muscles, v => { e.muscles = v.slice(0, 300); })),
    field("Repères anatomiques", area(e.cues, v => { e.cues = v.slice(0, 1200); }, 4), "Ce que fait le muscle, ce qu'on doit sentir."),
    field("Erreurs fréquentes", area(e.errors, v => { e.errors = v.slice(0, 600); }, 2)),
    field("Version plus difficile", input("text", e.harder, v => { e.harder = v.slice(0, 160); })),
    field("Version plus facile", input("text", e.easier, v => { e.easier = v.slice(0, 160); })),
    field("Plafond (0 si aucun)", input("number", e.plafond || 0, v => { e.plafond = num(v) || 0; }))
  ], { foot: [h("button", { class: "btn primary big", text: "Enregistrer", onclick: () => {
    if (!e.name.trim()) return toast("Indique un nom.");
    if (existing) Object.assign(existing, e); else S.coach.exercises.push(e);
    save(); toast("Exercice enregistré."); back();
  } })] });
};

VIEWS.coachSettings = function () {
  const C = S.coach;
  return screen("Réglages", null, [
    field("Ton nom", input("text", C.name, v => { C.name = v.slice(0, 80); save(); })),
    field("Ton numéro WhatsApp", input("tel", C.phone ? "+" + C.phone : "", v => { C.phone = v.replace(/\D/g, "").slice(0, 15); save(); }, { inputmode: "tel" })),
    h("nav", { class: "menu" }, [
      navRow("Sauvegarder toutes les données", "Pax, programmes, rapports, bibliothèque", () => shareFile("sauvegarde-coach-" + new Date().toISOString().slice(0, 10) + ".json", { type: "nafuu-sauvegarde", v: 1, date: new Date().toISOString(), data: S })),
      navRow("Restaurer une sauvegarde", null, pickFile),
      navRow("Tout effacer", "Supprime toutes les données de ce téléphone", () => confirmSheet("Tout effacer ?", "Tous tes pax, leurs rapports, tes programmes et ta bibliothèque seront supprimés. Fais une sauvegarde avant si tu veux les garder.", "Tout effacer", wipe, true))
    ]),
    h("p", { class: "hint", text: "Les données de santé de tes pax sont sur ce téléphone : garde-le verrouillé, et range tes sauvegardes dans un endroit privé." })
  ]);
};

/* ---------- Installation (version web) ---------- */

let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
function isInstalled() { return !!NB || window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function installRow() { return isInstalled() ? null : navRow("Installer l'app sur ce téléphone", "Pour l'ouvrir comme une app, même sans réseau", () => go("install")); }

VIEWS.install = function () {
  const kids = [];
  if (installPrompt) {
    kids.push(h("button", { class: "btn primary big", text: "Installer Nafuu Health", onclick: () => {
      installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; render(); });
    } }));
  } else if (isIOS()) {
    kids.push(h("p", { text: "Sur iPhone, dans Safari :" }), h("ol", { class: "steps" }, [
      h("li", { text: "Appuie sur le bouton Partager, le carré avec une flèche vers le haut." }),
      h("li", { text: "Choisis « Sur l'écran d'accueil »." }),
      h("li", { text: "Laisse « Ouvrir comme app web » activé, puis appuie sur Ajouter." }),
      h("li", { text: "Ouvre ensuite Nafuu Health depuis son icône, pas depuis Safari : c'est là que tes données sont gardées." })
    ]));
  } else {
    kids.push(h("p", { text: "Sur Android, dans Chrome :" }), h("ol", { class: "steps" }, [
      h("li", { text: "Appuie sur les trois points en haut à droite." }),
      h("li", { text: "Choisis « Ajouter à l'écran d'accueil » puis « Installer »." }),
      h("li", { text: "Ouvre ensuite Nafuu Health depuis son icône." })
    ]));
  }
  kids.push(h("p", { class: "hint", text: "Une fois installée, l'app marche sans réseau. Tes données restent sur ce téléphone, dans l'app." }));
  return screen("Installer l'app", null, kids);
};

/* ---------- Démarrage ---------- */

if (!NB && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  // Nouvelle version installée : on recharge tout de suite, sauf pendant une séance ou un test.
  let hadController = !!navigator.serviceWorker.controller, reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }
    if (reloading) return;
    const v = stack.length ? stack[stack.length - 1].view : "";
    if (v === "session" || v === "test") { toast("Nouvelle version prête : elle s'appliquera à la prochaine ouverture."); return; }
    reloading = true; location.reload();
  });
}
if (!NB && navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(() => {}); }
if (migrateCoachLibrary()) save();
readInvite();
home();
async function readDataLink() {
  const h0 = location.hash || "";
  if (!/^#[zd]=/.test(h0)) return;
  history.replaceState(null, "", location.pathname + location.search);
  if (isIOS() && !isInstalled()) {
    // Sur iPhone, Safari et l'app installée ne partagent pas leurs données.
    stack = []; go("iosLink", { link: APP_URL + h0 }); return;
  }
  await importFromText(h0);
}
VIEWS.iosLink = function (params) {
  return screen("Ouvre-le dans l'app", null, [
    h("p", { text: "Sur iPhone, ce lien s'est ouvert dans Safari, pas dans Nafuu Health. Copie-le, ouvre l'app depuis son icône, puis colle-le dans Importer." }),
    h("button", { class: "btn primary big", text: "Copier le lien", onclick: () => navigator.clipboard.writeText(params.link).then(() => toast("Lien copié. Ouvre Nafuu Health et colle-le."), () => toast("Copie impossible : reste appuyé sur le lien dans WhatsApp pour le copier.")) })
  ], { noBack: true });
};
readDataLink();
window.addEventListener("hashchange", () => { if (/^#i=/.test(location.hash)) { readInvite(); home(); } else if (/^#[zd]=/.test(location.hash)) readDataLink(); });
if (!NB && /[?&]partage=1/.test(location.search) && window.caches) {
  history.replaceState(null, "", location.pathname);
  caches.open("nafuu-health-partage").then(c => c.match("./fichier-recu").then(r => r ? r.text().then(t => { c.delete("./fichier-recu"); handleImport(t); }) : null)).catch(() => {});
}
