// Test draftStageIndex (app/src/draftStage.js): nazwy etapów z RCL -> krok ścieżki 0..5, nieznane -> -1.
// Uruchomienie: node scripts/test-draft-stage.mjs
import { draftStageIndex as d } from "../app/src/draftStage.js";
const cases = [["Zgłoszenia", 0], ["Uzgodnienia", 1], ["Konsultacje publiczne", 2], ["Stały Komitet Rady Ministrów", 3], ["Rada Ministrów", 4], ["Sejm", 5], ["Referentenentwurf", -1], [null, -1]];
for (const [s, e] of cases) if (d(s) !== e) { console.error("FAIL", s, d(s), "oczekiwano", e); process.exit(1); }
console.log("PASS");
