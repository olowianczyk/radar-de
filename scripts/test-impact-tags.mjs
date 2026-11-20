// Test znaczników wpływu na HR. Te same przypadki (tytuł -> tagi) są w test-digest.php.
import { impactTags } from "../app/src/impactTags.js";
const CASES = [
  ["Projekt ustawy o stażach", ["labor"]],
  ["Ustawa o zmianie Kodeksu pracy", ["labor"]],
  ["Rozporządzenie w sprawie ochrony danych osobowych pracowników", ["labor", "gdpr"]],
  ["Ustawa Prawo zamówień publicznych", ["procurement"]],
  ["Nowelizacja ustawy o ubezpieczeniach społecznych", ["social"]],
  ["Rozporządzenie w sprawie bezpieczeństwa i higieny pracy", ["labor", "safety"]],
  ["Ustawa o ochronie zabytków", []],
  ["", []],
];
let bad = 0;
for (const [title, want] of CASES) {
  const got = impactTags(title);
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log("FAIL", title, got, want); }
}
console.log(bad ? "FAIL" : "PASS");
process.exit(bad ? 1 : 0);
