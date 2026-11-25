"use strict";
/* Codage compact des liens : l'app connaît déjà les exercices, le lien ne transporte que leurs numéros.
   CODEC_IDS ne doit JAMAIS être réordonné : on ajoute seulement à la fin. */

const CODEC_IDS = ["pike","pompes","tirage-sol","ytw","dips-chaise","swimmers","open-book","saut-vertical","saut-longueur","squat-lent","bulgare","pont-1j","charniere-1j","pointes-1j","mini-squat-yf","enroulement","dead-bug","releves-sol","planche-lat-dyn","ext-dorsales","mountain","course-200","tractions","tractions-neg","pike-banc","dips-barres","rowing-inv","tractions-omo","box-jump","curl-ischios","ext-lombaires","releves-susp","hollow","suspension","pompes-inclinees","pompes-pieds-sur","pompes-archer","pike-chaise","poirier-negatif","pompes-poirier","dips-chaise-tendues","dips-barres-tendues","rowing-table","rowing-inv-genoux","rowing-inv-pieds","rowing-archer","tractions-archer","squat-pause","bulgare-4t","assis-debout-1j","pistol","pont-2j","pont-1j-sureleve","hip-thrust-1j","nordic","pointes-2j","pointes-1j-marche","enroulement-bras","releves-tendus","releves-susp-tendus","orteils-barre","planche-lat-genoux","planche-lat","superman-tenu","ext-dorsales-y","anges-mur","genou-mur","fente-psoas","squat-bras-assiste","equilibre-yf","suspension-active","course-300","course-400"];
const EX_FIELDS = ["id", "name", "unit", "side", "lieu", "muscles", "cues", "errors", "harder", "easier", "plafond"];

function seedById() { const m = {}; allSeedExercises().forEach(e => { m[e.id] = e; }); return m; }
function sameEx(a, b) { return EX_FIELDS.every(k => (a[k] || "") === (b[k] || "")); }
function toMin(iso) { const t = Date.parse(iso || ""); return isNaN(t) ? 0 : Math.round(t / 60000).toString(36); }
function fromMin(m) { const n = parseInt(String(m || "0"), 36); return n ? new Date(n * 60000).toISOString() : new Date().toISOString(); }
function defaultTitle(num, lieu) { const s = SEED_SESSIONS.find(x => x.num === num && x.lieu === lieu); return s ? s.title : ""; }

/* ----- Programme ----- */
function packProgram(f) {
  const seed = seedById(), customs = [], cIdx = {};
  const code = id => {
    const i = CODEC_IDS.indexOf(id), mine = f.exercises.find(e => e.id === id);
    if (i >= 0 && (!mine || sameEx(mine, seed[id]))) return i;
    if (!(id in cIdx)) { cIdx[id] = customs.length; customs.push(EX_FIELDS.map(k => (mine || {})[k] || (k === "plafond" ? 0 : ""))); }
    return -(cIdx[id] + 1);
  };
  const warm = JSON.stringify(f.warmup) === JSON.stringify(SEED_WARMUP) ? 0 : f.warmup;
  const sessions = f.sessions.map(s => [s.num, s.lieu === "salle" ? 1 : 0, s.title === defaultTitle(s.num, s.lieu) ? 0 : s.title,
    s.items.map(i => i.note ? [code(i.exId), i.sets, i.target, i.note] : [code(i.exId), i.sets, i.target])]);
  return ["p", 1, f.coach.name, f.coach.phone, f.pax.id, f.pax.name, f.cycleWeeks, toMin(f.issuedAt), warm, sessions, customs, f.message || 0];
}
function unpackProgram(a) {
  const seed = seedById(), customs = (a[10] || []).map(c => { const o = {}; EX_FIELDS.forEach((k, j) => { o[k] = c[j]; }); return o; });
  const used = {};
  const exOf = c => { const e = c >= 0 ? seed[CODEC_IDS[c]] : customs[-c - 1]; if (e) used[e.id] = e; return e ? e.id : ""; };
  const sessions = (a[9] || []).map(s => ({ num: s[0], lieu: s[1] ? "salle" : "maison", title: s[2] || defaultTitle(s[0], s[1] ? "salle" : "maison"),
    items: (s[3] || []).map(i => ({ exId: exOf(i[0]), sets: i[1], target: i[2], note: i[3] || "" })).filter(i => i.exId) }));
  return { type: "nafuu-programme", v: 1, coach: { name: a[2], phone: a[3] }, pax: { id: a[4], name: a[5] }, cycleWeeks: a[6], issuedAt: fromMin(a[7]),
    warmup: a[8] || SEED_WARMUP, sessions: sessions, exercises: Object.values(used), message: a[11] || "" };
}

/* ----- Demande de test ----- */
function packTest(f) { return ["t", 1, f.coach.name, f.coach.phone, f.pax.id, f.pax.name, toMin(f.issuedAt), f.message || 0]; }
function unpackTest(a) { return { type: "nafuu-test", v: 1, coach: { name: a[2], phone: a[3] }, pax: { id: a[4], name: a[5] }, issuedAt: fromMin(a[6]), message: a[7] || "" }; }

/* ----- Rapport ----- */
function exCode(id) { const i = CODEC_IDS.indexOf(id); return i >= 0 ? i : id; }
function exFromCode(c) { return typeof c === "number" ? CODEC_IDS[c] || "" : String(c); }
function packReport(r) {
  const c = r.consent;
  return ["r", 1, r.paxId, r.profile.firstName || "", r.profile.birth || "", c ? [toMin(c.date), c.version || "", c.parent || ""] : 0, toMin(r.generatedAt),
    r.sessions.map(s => [s.id, toMin(s.date), s.num, s.lieu === "salle" ? 1 : 0, s.feeling === null || s.feeling === undefined ? -1 : s.feeling, s.comment || "",
      s.items.map(i => [exCode(i.exId), i.target, i.plannedSets, i.sidesUsed ? 1 : 0,
        i.sets.map(x => [x.side === "G" ? 1 : x.side === "D" ? 2 : 0, x.value, x.effort === null || x.effort === undefined ? -1 : x.effort, x.clean ? 1 : 0, x.done ? 1 : 0])])]),
    r.tests.map(t => [t.id, toMin(t.date), t.blocked ? 1 : 0, t.skipped || [], t.values]),
    r.measures.map(m => [m.id, toMin(m.date), m.poids, m.tour, m.pouls]),
    r.pains.map(p => [p.id, toMin(p.date), p.zone, p.intensity, p.context || "", p.comment || ""])];
}
function unpackReport(a) {
  const seed = seedById();
  return { type: "nafuu-rapport", v: 1, paxId: a[2], profile: { firstName: a[3], birth: a[4] },
    consent: a[5] ? { date: fromMin(a[5][0]), health: true, version: a[5][1], parent: a[5][2] } : null, generatedAt: fromMin(a[6]),
    sessions: (a[7] || []).map(s => ({ id: s[0], date: fromMin(s[1]), num: s[2], lieu: s[3] ? "salle" : "maison", title: defaultTitle(s[2], s[3] ? "salle" : "maison"),
      feeling: s[4] < 0 ? null : s[4], comment: s[5],
      items: (s[6] || []).map(i => { const id = exFromCode(i[0]), e = seed[id] || {}; return { exId: id, name: e.name || id, unit: e.unit || "reps", target: i[1], plannedSets: i[2], sidesUsed: !!i[3],
        sets: (i[4] || []).map(x => ({ side: x[0] === 1 ? "G" : x[0] === 2 ? "D" : null, value: x[1], effort: x[2] < 0 ? null : x[2], clean: !!x[3], done: !!x[4] })) }; }) })),
    tests: (a[8] || []).map(t => ({ id: t[0], date: fromMin(t[1]), blocked: !!t[2], skipped: t[3], values: t[4] })),
    measures: (a[9] || []).map(m => ({ id: m[0], date: fromMin(m[1]), poids: m[2], tour: m[3], pouls: m[4] })),
    pains: (a[10] || []).map(p => ({ id: p[0], date: fromMin(p[1]), zone: p[2], intensity: p[3], context: p[4], comment: p[5] })) };
}

function packAny(obj) {
  if (obj.type === "nafuu-programme") return packProgram(obj);
  if (obj.type === "nafuu-test") return packTest(obj);
  if (obj.type === "nafuu-rapport") return packReport(obj);
  return null;
}
function unpackAny(a) {
  if (!Array.isArray(a) || a[1] !== 1) return null;
  if (a[0] === "p") return unpackProgram(a);
  if (a[0] === "t") return unpackTest(a);
  if (a[0] === "r") return unpackReport(a);
  return null;
}
