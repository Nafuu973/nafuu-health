"use strict";
/* Bibliothèque enrichie et préparation automatique des programmes.
   Tout ce qui est calculé ici est une proposition : le coach valide avant tout envoi. */

/* ---------- Exercices ajoutés aux échelles de progression ---------- */

function mkEx(id, name, unit, side, lieu, muscles, cues, errors, plafond) {
  return { id: id, name: name, unit: unit, side: side, lieu: lieu, muscles: muscles, cues: cues, errors: errors, harder: "", easier: "", plafond: plafond || 0 };
}
const G_PIED_SOL = "Gauche = pied gauche au sol";
const SMART_EXERCISES = [
  // Poussée horizontale
  mkEx("pompes-inclinees", "Pompes mains sur une chaise", "reps", null, "les deux", "Grand pectoral, triceps, dentelé antérieur",
     "Mains sur le bord d'une chaise calée contre un mur, corps aligné. La poitrine descend jusqu'au bord, les omoplates s'écartent en haut.", "Bassin qui s'affaisse, coudes à 90° du corps."),
  mkEx("pompes-pieds-sur", "Pompes pieds surélevés", "reps", null, "les deux", "Grand pectoral (faisceau claviculaire), deltoïdes antérieurs, triceps",
     "Pieds sur une chaise, corps gainé. Descends la poitrine entre les mains, coudes à 45° du corps.", "Hanches qui montent, nuque cassée."),
  mkEx("pompes-archer", "Pompes archer", "reps", "Gauche = le bras gauche plie, le droit reste tendu", "les deux", "Grand pectoral, triceps, stabilisateurs d'épaule",
     "Mains très écartées. Descends vers une main en gardant l'autre bras tendu : le bras qui plie fait le travail.", "Le bras tendu qui plie aussi, bassin qui tourne."),
  // Poussée verticale
  mkEx("pike-chaise", "Pompes pike pieds sur une chaise", "reps", null, "maison", "Deltoïdes antérieurs, triceps, trapèzes",
     "Pieds sur une chaise, hanches au-dessus des épaules. La tête descend entre les mains, les épaules poussent vers le plafond.", "Hanches qui reculent, coudes qui s'ouvrent."),
  mkEx("poirier-negatif", "Descentes en poirier au mur", "reps", null, "les deux", "Deltoïdes, triceps, trapèzes, gainage",
     "En poirier face au mur, corps gainé. Descends la tête vers le sol le plus lentement possible, puis redescends les pieds.", "Cambrer le dos, se laisser tomber."),
  mkEx("pompes-poirier", "Pompes en poirier au mur", "reps", null, "les deux", "Deltoïdes, triceps, trapèzes, gainage",
     "En poirier face au mur. La tête descend entre les mains, remonte bras tendus en poussant le sol loin de toi.", "Dos cambré, amplitude réduite."),
  // Dips
  mkEx("dips-chaise-tendues", "Dips sur chaise jambes tendues", "reps", null, "maison", "Triceps, deltoïdes antérieurs",
     "Jambes tendues, talons au sol. Descends jusqu'à 90° au coude, épaules loin des oreilles.", "Épaules qui montent, descendre trop bas."),
  mkEx("dips-barres-tendues", "Dips aux barres jambes tendues", "reps", null, "salle", "Triceps, grand pectoral, deltoïdes antérieurs",
     "Jambes tendues devant, corps gainé. Descends jusqu'à 90° au coude, remonte bras tendus.", "Balancer les jambes."),
  // Tirage horizontal
  mkEx("rowing-table", "Rowing inversé sous une table", "reps", null, "maison", "Grand dorsal, rhomboïdes, biceps",
     "Sous une table solide et lourde, mains au bord. Corps aligné, tire la poitrine vers le bord en serrant les omoplates. Vérifie que la table ne bascule pas.", "Bassin qui tombe, table légère."),
  mkEx("rowing-inv-genoux", "Rowing inversé genoux pliés", "reps", null, "salle", "Grand dorsal, rhomboïdes, biceps",
     "Pieds au sol genoux pliés, bassin aligné avec les épaules. Tire la poitrine vers la barre.", "Hausser les épaules."),
  mkEx("rowing-inv-pieds", "Rowing inversé pieds sur banc", "reps", null, "salle", "Grand dorsal, rhomboïdes, deltoïdes postérieurs",
     "Pieds sur un banc, corps horizontal. Tire la poitrine vers la barre, pause en haut.", "Bassin qui casse."),
  mkEx("rowing-archer", "Rowing archer", "reps", "Gauche = le bras gauche tire", "salle", "Grand dorsal, rhomboïdes, biceps",
     "Mains écartées. Tire vers une main, l'autre bras reste tendu et aide le moins possible.", "Rotation du bassin."),
  // Tirage vertical
  mkEx("tractions-archer", "Tractions archer", "reps", "Gauche = tu montes vers la main gauche", "salle", "Grand dorsal, biceps, trapèzes inférieurs",
     "Prise large. Monte vers une main, l'autre bras se tend sur la barre.", "Élan, demi-amplitude."),
  // Jambes
  mkEx("squat-pause", "Squats avec pause en bas", "reps", null, "les deux", "Quadriceps, fessiers, adducteurs",
     "Descends en 3 temps, tiens 2 temps en bas sans rebondir, remonte en poussant le sol.", "Rebondir en bas, talons qui décollent."),
  mkEx("bulgare-4t", "Squat bulgare descente en 4 temps", "reps", "Gauche = pied gauche devant", "les deux", "Quadriceps, grand fessier",
     "Pied arrière sur une chaise, descends en 4 temps, remonte en poussant avec la jambe avant.", "Genou avant qui rentre."),
  mkEx("assis-debout-1j", "Assis-debout sur une jambe", "reps", G_PIED_SOL, "les deux", "Quadriceps, grand fessier, stabilisateurs de hanche",
     "Assis au bord d'une chaise, une jambe tendue devant. Lève-toi sans élan ni les mains, rassieds-toi lentement.", "Se laisser tomber sur la chaise."),
  mkEx("pistol", "Squat sur une jambe complet", "reps", G_PIED_SOL, "les deux", "Quadriceps, grand fessier, mobilité de cheville",
     "Jambe libre tendue devant, descends le plus bas possible en contrôle, talon au sol.", "Talon qui décolle, dos qui s'arrondit fort."),
  mkEx("pont-2j", "Pont fessier", "reps", null, "les deux", "Grand fessier, ischios",
     "Pieds à plat près des fesses. Pousse les talons, serre les fessiers en haut, sans cambrer.", "Pousser avec le bas du dos."),
  mkEx("pont-1j-sureleve", "Pont fessier sur une jambe, pied surélevé", "reps", G_PIED_SOL, "les deux", "Grand fessier, ischios",
     "Pied d'appui sur une chaise. Monte le bassin à l'alignement, bassin à niveau.", "Bassin qui penche."),
  mkEx("hip-thrust-1j", "Pont sur une jambe, épaules sur banc", "reps", G_PIED_SOL, "salle", "Grand fessier",
     "Épaules sur un banc, un pied au sol. Monte jusqu'à l'alignement épaules-hanches-genou, tiens 1 temps.", "Cambrer en haut."),
  mkEx("nordic", "Nordic aidé des mains", "reps", null, "salle", "Ischio-jambiers (excentrique)",
     "À genoux, chevilles bloquées. Descends le buste vers l'avant le plus lentement possible, rattrape-toi avec les mains.", "Casser les hanches."),
  mkEx("pointes-2j", "Montées sur pointes", "reps", null, "les deux", "Triceps sural",
     "Monte haut sur les gros orteils, redescends lentement.", "Rebondir."),
  mkEx("pointes-1j-marche", "Montées sur pointes sur une marche, une jambe", "reps", G_PIED_SOL, "les deux", "Triceps sural",
     "Avant du pied sur une marche, talon dans le vide. Monte au maximum, descends le talon sous la marche.", "Amplitude réduite."),
  // Tronc
  mkEx("enroulement-bras", "Enroulement du buste bras au-dessus de la tête", "reps", null, "les deux", "Grand droit de l'abdomen",
     "Bras tendus dans le prolongement du corps. Rapproche les côtes du bassin en arrondissant le bas du dos.", "Lancer les bras."),
  mkEx("releves-tendus", "Relevés de jambes tendues, descente lente", "reps", null, "maison", "Grand droit (partie basse), psoas",
     "Jambes tendues, monte à la verticale en roulant le bassin, redescends en 3 temps sans cambrer.", "Bas du dos qui décolle."),
  mkEx("releves-susp-tendus", "Relevés suspendus jambes tendues", "reps", null, "salle", "Grand droit, psoas, préhension",
     "Pendu, jambes tendues jusqu'à l'horizontale ou plus, bassin qui s'enroule. Sans balancer.", "Balancier."),
  mkEx("orteils-barre", "Orteils à la barre", "reps", null, "salle", "Grand droit, psoas, grand dorsal, préhension",
     "Pendu, enroule le bassin jusqu'à toucher la barre avec les pieds, redescends contrôlé.", "Élan."),
  mkEx("planche-lat-genoux", "Planche latérale sur les genoux", "s", "Gauche = appui sur l'avant-bras gauche", "les deux", "Obliques, carré des lombes",
     "Sur l'avant-bras et les genoux, corps aligné des genoux à la tête.", "Bassin qui recule.", 60),
  mkEx("planche-lat", "Planche latérale", "s", "Gauche = appui sur l'avant-bras gauche", "les deux", "Obliques, carré des lombes, moyen fessier",
     "Coude sous l'épaule, pieds l'un sur l'autre, corps aligné de la tête aux pieds.", "Hanche qui descend.", 90),
  mkEx("superman-tenu", "Superman tenu", "s", null, "les deux", "Érecteurs du rachis, fessiers, trapèzes inférieurs",
     "Sur le ventre, bras tendus devant. Décolle bras, poitrine et jambes, nuque allongée.", "Lancer la tête en arrière.", 90),
  mkEx("ext-dorsales-y", "Extensions dorsales bras en Y", "reps", null, "les deux", "Érecteurs du rachis, trapèzes inférieurs",
     "Bras en Y, pouces vers le ciel. Soulève le buste et tiens 2 temps.", "Cambrer en lançant la tête."),
  // Mobilité, équilibre, préhension
  mkEx("anges-mur", "Anges au mur", "reps", null, "les deux", "Mobilité d'épaule, trapèzes inférieurs",
     "Dos, bassin et tête collés au mur. Glisse les bras vers le haut sans décoller les côtes ni les poignets.", "Le bas du dos se creuse."),
  mkEx("genou-mur", "Genou au mur (cheville)", "reps", "Gauche = pied gauche devant", "les deux", "Mobilité de cheville (flexion dorsale)",
     "Talon au sol, avance le genou vers le mur au-dessus du deuxième orteil. Tiens 2 temps en avant.", "Talon qui décolle, genou qui rentre."),
  mkEx("fente-psoas", "Fente basse, fléchisseurs de hanche", "s", "Gauche = genou gauche au sol", "les deux", "Psoas, droit fémoral",
     "Genou arrière au sol, rentre le bassin (serre le fessier arrière) et avance doucement. Respire calmement.", "Cambrer au lieu de rentrer le bassin.", 60),
  mkEx("squat-bras-assiste", "Squat bras en l'air, mains au mur", "reps", null, "les deux", "Mobilité d'épaule, de hanche et de cheville",
     "Face au mur, bras tendus haut contre le mur. Descends le plus bas possible en gardant les bras au mur.", "Talons qui décollent."),
  mkEx("equilibre-yf", "Équilibre sur une jambe, yeux fermés", "s", G_PIED_SOL, "les deux", "Proprioception de cheville et de hanche",
     "Mains sur les hanches, yeux fermés, pied d'appui actif. Arrête si le pied bouge.", "Se raidir.", 45),
  mkEx("suspension-active", "Suspension active", "s", null, "salle", "Fléchisseurs des doigts, grand dorsal, trapèzes inférieurs",
     "Bras tendus, épaules descendues loin des oreilles, corps gainé.", "Épaules relâchées dans les oreilles.", 90),
  // Cardio
  mkEx("course-300", "Course 300 m", "m", null, "les deux", "Cardio", "Allure régulière. Reviens en marchant entre chaque.", "Partir trop vite."),
  mkEx("course-400", "Course 400 m", "m", null, "les deux", "Cardio", "Allure régulière. Reviens en marchant entre chaque.", "Partir trop vite.")
];

/* Échelles : du plus facile au plus dur. Un exercice appartient à une seule échelle. */
const LADDERS = {
  poussee: ["pompes-inclinees", "pompes", "pompes-pieds-sur", "pompes-archer"],
  verticale: ["pike", "pike-chaise", "pike-banc", "poirier-negatif", "pompes-poirier"],
  dips: ["dips-chaise", "dips-chaise-tendues", "dips-barres", "dips-barres-tendues"],
  tirageMaison: ["tirage-sol", "rowing-table"],
  tirage: ["rowing-inv-genoux", "rowing-inv", "rowing-inv-pieds", "rowing-archer"],
  traction: ["tractions-omo", "tractions-neg", "tractions", "tractions-archer"],
  squat: ["squat-lent", "squat-pause", "bulgare", "bulgare-4t", "assis-debout-1j", "pistol"],
  pont: ["pont-2j", "pont-1j", "pont-1j-sureleve", "hip-thrust-1j"],
  ischios: ["curl-ischios", "nordic"],
  mollets: ["pointes-2j", "pointes-1j", "pointes-1j-marche"],
  flexion: ["enroulement", "enroulement-bras", "releves-sol", "releves-tendus"],
  flexionSalle: ["releves-susp", "releves-susp-tendus", "orteils-barre"],
  lateral: ["planche-lat-genoux", "planche-lat", "planche-lat-dyn"],
  extension: ["swimmers", "ext-dorsales", "ext-dorsales-y", "ext-lombaires"],
  cardio: ["course-200", "course-300", "course-400"]
};

function allSeedExercises() { return SEED_EXERCISES.concat(SMART_EXERCISES); }

/* Ajoute à la bibliothèque du coach les exercices qui lui manquent, sans toucher à ses modifications. */
function migrateCoachLibrary() {
  if (!S || S.role !== "coach" || !S.coach || !Array.isArray(S.coach.exercises)) return false;
  const have = new Set(S.coach.exercises.map(e => e.id));
  let added = 0;
  allSeedExercises().forEach(e => { if (!have.has(e.id)) { S.coach.exercises.push(JSON.parse(JSON.stringify(e))); added++; } });
  return added > 0;
}

function ladderOf(exId) {
  for (const k in LADDERS) { const i = LADDERS[k].indexOf(exId); if (i >= 0) return { key: k, list: LADDERS[k], idx: i }; }
  return null;
}
/* Exercice voisin dans l'échelle, compatible avec le lieu de la séance. dir = +1 plus dur, -1 plus facile. */
function ladderStep(exId, dir, lieu, lib) {
  const L = ladderOf(exId); if (!L) return null;
  for (let i = L.idx + dir; i >= 0 && i < L.list.length; i += dir) {
    const e = lib[L.list[i]];
    if (e && (e.lieu === "les deux" || e.lieu === lieu || !lieu)) return e;
  }
  return null;
}

/* ---------- Lecture du test de départ ---------- */

function tv(test, id, f) { const t = test && test.values && test.values[id]; const v = t ? t[f] : undefined; return typeof v === "number" ? v : null; }
function minSide(test, id) { const g = tv(test, id, "g"), d = tv(test, id, "d"); return g === null ? d : d === null ? g : Math.min(g, d); }
function weakSide(test, id) {
  const g = tv(test, id, "g"), d = tv(test, id, "d");
  if (g === null || d === null || Math.max(g, d) === 0) return null;
  const gap = Math.abs(g - d) / Math.max(g, d);
  return gap > 0.15 ? { side: g < d ? "gauche" : "droit", gap: Math.round(gap * 100) } : null;
}

/* Choisit le niveau de l'échelle pour que 60 % du maximum tombe entre 5 et 12 répétitions. */
function pickLevel(ladder, baseIdx, max, lieu, lib) {
  let idx = baseIdx, est = max;
  const ok = i => { const e = lib[ladder[i]]; return e && (e.lieu === "les deux" || e.lieu === lieu); };
  while (Math.round(est * 0.6) > 12 && idx < ladder.length - 1) {
    let n = idx + 1; while (n < ladder.length && !ok(n)) n++;
    if (n >= ladder.length) break;
    idx = n; est = est / 2;
  }
  while (Math.round(est * 0.6) < 5 && idx > 0) {
    let n = idx - 1; while (n >= 0 && !ok(n)) n--;
    if (n < 0) break;
    idx = n; est = est * 1.8;
  }
  if (!ok(idx)) { let n = 0; while (n < ladder.length && !ok(n)) n++; idx = Math.min(n, ladder.length - 1); }
  return { exId: ladder[idx], target: Math.max(5, Math.min(12, Math.round(est * 0.6))) };
}
function holdTarget(max, floor) { return Math.max(floor || 10, Math.min(60, Math.round((max || 20) * 0.6 / 5) * 5)); }

/* ---------- Programme proposé d'après le test ---------- */

function buildProgramFromTest(test, paxName) {
  const lib = exMapAll();
  const why = [];
  const item = (exId, sets, target, note) => ({ exId: exId, sets: sets, target: target, note: note || "" });
  const lvl = (ladder, base, max, lieu, fallbackTarget) => max === null ? { exId: LADDERS[ladder][base], target: fallbackTarget } : pickLevel(LADDERS[ladder], base, max, lieu, lib);
  const name = id => (lib[id] ? lib[id].name : id);

  const pompes = tv(test, "pompes", "res"), genoux = test.values.pompes && test.values.pompes.genoux === true;
  const pike = tv(test, "pike", "res"), dips = tv(test, "dips", "res");
  const tractions = tv(test, "tractions", "res"), rowing = tv(test, "rowing", "res"), susp = tv(test, "suspension", "res");
  const barre = !(test.skipped || []).includes("barre");
  const squats = tv(test, "squats", "res"), bulg = minSide(test, "bulgare"), pont = minSide(test, "pont"), pointes = minSide(test, "pointes");
  const assis = minSide(test, "assis-debout"), releves = tv(test, "releves", "res");
  const hollow = tv(test, "hollow", "res"), plat = minSide(test, "planche-lat"), superman = tv(test, "superman", "res");
  const chev = minSide(test, "genou-mur"), eqYf = Math.min(tv(test, "equilibre", "fg") ?? 99, tv(test, "equilibre", "fd") ?? 99);
  const course = tv(test, "course", "temps");
  const sq = test.values["squat-bras"] || {}, brasMur = test.values["bras-mur"] || {};
  const mainsDos = Math.max(tv(test, "mains-dos", "g") ?? 0, tv(test, "mains-dos", "d") ?? 0);

  // Poussée
  const push = lvl("poussee", genoux || (pompes !== null && pompes < 3) ? 0 : 1, genoux ? Math.round((pompes || 0) / 2) : pompes, "maison", 8);
  why.push("Pompes : " + (pompes === null ? "pas de résultat, niveau de base" : pompes + (genoux ? " sur les genoux" : "") + " au test") + ", donc " + name(push.exId).toLowerCase() + " à " + push.target + " répétitions.");
  const vM = lvl("verticale", 0, pike, "maison", 6), vS = lvl("verticale", 0, pike, "salle", 6);
  const dM = lvl("dips", 0, dips, "maison", 10), dS = lvl("dips", 2, dips === null ? null : Math.round(dips / 2), "salle", 8);
  // Tirage
  let trac;
  if (!barre || tractions === null) trac = item("tractions-neg", 5, 3, "Descente la plus lente possible");
  else if (tractions < 3) trac = item("tractions-neg", 5, 3, "Descente la plus lente possible");
  else {
    const t = Math.max(2, Math.round(tractions * 0.6));
    trac = tractions >= 15 ? item("tractions-archer", 5, Math.max(3, Math.round(tractions / 4))) : item("tractions", 5, t, "60 % de ton maximum (" + tractions + ")");
  }
  why.push("Tractions : " + (barre && tractions !== null ? tractions + " au test" : "pas testées") + ", donc " + name(trac.exId).toLowerCase() + " " + trac.sets + " × " + trac.target + ".");
  const rowS = lvl("tirage", 1, rowing, "salle", 10);
  // Jambes
  let sqM;
  if (assis !== null && assis >= 8) sqM = pickLevel(LADDERS.squat, 4, assis, "maison", lib);
  else if (bulg !== null) sqM = pickLevel(LADDERS.squat, 2, bulg, "maison", lib);
  else sqM = lvl("squat", 0, squats, "maison", 15);
  const pontL = lvl("pont", 1, pont, "maison", 12), pointL = lvl("mollets", 1, pointes, "maison", 15);
  const ws = weakSide(test, "bulgare") || weakSide(test, "pont") || weakSide(test, "assis-debout");
  const sideNote = ws ? "Commence par le côté " + ws.side + " (" + ws.gap + " % plus faible au test) et fais-lui 1 série de plus" : "";
  if (ws) why.push("Écart gauche/droite de " + ws.gap + " % : le côté " + ws.side + " commence et reçoit une série de plus.");
  // Tronc
  const flexL = lvl("flexion", 0, releves === null ? null : Math.round(releves * 0.8), "maison", 12);
  const latL = plat !== null && plat < 30 ? item("planche-lat-genoux", 3, holdTarget(plat * 1.5, 15)) : item("planche-lat-dyn", 3, 10);
  const backWeak = superman !== null && superman < 45;
  if (backWeak) why.push("Superman tenu " + superman + " s : chaîne arrière faible, extensions du dos à chaque séance de tronc.");
  const backL = backWeak ? item("superman-tenu", 3, holdTarget(superman, 15)) : item("ext-dorsales", 3, 12);
  const hollowL = item("hollow", 3, holdTarget(hollow, 15));
  // Cardio
  let cardio = item("course-200", 6, 200);
  if (course !== null) {
    if (course < 600) cardio = item("course-400", 5, 400);
    else if (course < 780) cardio = item("course-300", 6, 300);
    why.push("2,4 km en " + Math.floor(course / 60) + " min " + (course % 60) + " s : fractionné de " + cardio.sets + " × " + cardio.target + " m.");
  }
  // Mobilité et équilibre selon les faiblesses
  const shoulderWeak = sq.bras === false || (brasMur.res && !/reste collé/.test(brasMur.res)) || mainsDos > 10;
  const ankleWeak = (chev !== null && chev < 10) || sq.talons === false;
  const eqG = tv(test, "equilibre", "fg"), eqD = tv(test, "equilibre", "fd");
  const eqGap = eqG !== null && eqD !== null && Math.max(eqG, eqD) > 0 ? Math.abs(eqG - eqD) / Math.max(eqG, eqD) : 0;
  const balanceWeak = eqYf < 20 || eqGap > 0.2;
  if (shoulderWeak) why.push("Mobilité d'épaule limitée au test : anges au mur et open book en séance 1.");
  if (ankleWeak) why.push("Cheville raide" + (chev !== null ? " (genou au mur " + chev + " cm)" : "") + " : travail de cheville en séance 2.");
  if (balanceWeak && eqYf < 99) why.push("Équilibre yeux fermés " + (eqG !== null && eqD !== null ? "gauche " + eqG + " s, droite " + eqD + " s" : eqYf + " s") + " : proprioception en séance 2.");
  const gripWeak = barre && susp !== null && susp < 60;
  if (gripWeak) why.push("Suspension " + susp + " s : poigne à renforcer, suspension active en salle.");

  const m1 = [item(vM.exId, 4, vM.target), item(push.exId, 4, push.target), item("tirage-sol", 4, 12), item(dM.exId, 3, dM.target), item("ytw", 3, 6)];
  if (shoulderWeak) m1.push(item("anges-mur", 2, 10), item("open-book", 1, 10));
  const m2 = [item("saut-vertical", 4, 5), item(sqM.exId, 4, sqM.target, sideNote), item(pontL.exId, 3, pontL.target, sideNote), item("charniere-1j", 3, 10), item(pointL.exId, 3, pointL.target)];
  if (ankleWeak) m2.push(item("genou-mur", 2, 10));
  if (balanceWeak) m2.push(item("mini-squat-yf", 3, 8));
  const m3 = [item(flexL.exId, 4, flexL.target), item("dead-bug", 3, 10), hollowL, latL, backL, cardio];
  const s1 = [trac, item(vS.exId, 4, vS.target), item(dS.exId, 4, dS.target), item(rowS.exId, 4, rowS.target), item("tractions-omo", 3, 8)];
  if (gripWeak) s1.push(item("suspension-active", 3, holdTarget(susp, 15)));
  if (shoulderWeak) s1.push(item("anges-mur", 2, 10));
  const sqS = bulg !== null ? pickLevel(LADDERS.squat, 2, bulg, "salle", lib) : { exId: "bulgare", target: 8 };
  const s2 = [item("box-jump", 4, 5), item(sqS.exId, 4, sqS.target, sideNote), item("hip-thrust-1j", 4, 8, sideNote), item("curl-ischios", 4, 8), item("charniere-1j", 3, 10), item("pointes-1j-marche", 4, 12)];
  if (backWeak) s2.push(item("ext-lombaires", 3, 10));
  if (ankleWeak) s2.push(item("genou-mur", 2, 10));
  const s3 = [item(flexL.exId, 4, flexL.target), item("releves-susp", 3, 8), hollowL, latL, backWeak ? backL : item("ext-lombaires", 3, 10), cardio];

  const sessions = [
    { num: 1, lieu: "maison", title: "Épaules et dos", items: m1 },
    { num: 2, lieu: "maison", title: "Jambes, hanches et chevilles", items: m2 },
    { num: 3, lieu: "maison", title: "Tronc et cardio", items: m3 },
    { num: 1, lieu: "salle", title: "Poussée et tirage", items: s1 },
    { num: 2, lieu: "salle", title: "Jambes", items: s2 },
    { num: 3, lieu: "salle", title: "Tronc et cardio", items: s3 }
  ];
  if (!barre) why.push("Pas de barre au test : en salle, les tractions commencent par les négatives.");
  if (test.values.sante && (test.values.sante.douleur || test.values.sante.blessure)) {
    why.push("Attention : douleur ou blessure déclarée au test (" + [test.values.sante.douleur, test.values.sante.blessure].filter(Boolean).join(", ") + "). Vérifie les exercices concernés avant d'envoyer.");
  }
  return { program: { cycleWeeks: 4, warmup: SEED_WARMUP.slice(), sessions: sessions }, reasons: why, testId: test.id, createdAt: new Date().toISOString(), forName: paxName || "" };
}
function exMapAll() {
  const m = {};
  allSeedExercises().forEach(e => { m[e.id] = e; });
  if (S && S.coach && Array.isArray(S.coach.exercises)) S.coach.exercises.forEach(e => { m[e.id] = e; });
  return m;
}

/* ---------- Douleurs : exercices concernés ---------- */

function painsOnExercise(p, exName, sinceIso) {
  return (p.pains || []).filter(x => x.context && x.context.indexOf(exName) >= 0 && (!sinceIso || x.date >= sinceIso));
}
