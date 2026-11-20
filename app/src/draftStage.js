// draftStage.js — "etap procesu" projektu rządowego (RCL) dla widoku szczegółów.
//
// CO TO ROBI: zamienia nazwę etapu z karty projektu w RCL (pole `draft.stage`, np.
// "Konsultacje publiczne", "Stały Komitet Rady Ministrów", "Sejm") na pozycję na
// uproszczonej ścieżce legislacyjnej:
//   0 wykaz prac → 1 uzgodnienia → 2 konsultacje → 3 komitety → 4 Rada Ministrów → 5 Sejm
// (kolejność jak na karcie projektu w RCL; patrz rcl_current_stage w server/php/index.php).
//
// CZEGO NIE ROBI (celowo): nie zgaduje terminów ani nie przewiduje, kiedy projekt przejdzie
// dalej. Zwraca wyłącznie numer kroku; opisy "co zwykle następuje" są w słowniku HRBP_I18N
// (klucz draftFlow) i są ogólne, nie dotyczą konkretnego projektu.
//
// shortcut: dopasowanie po słowach kluczowych w nazwie etapu (RCL nie podaje stałych kodów).
// Nieznana nazwa => -1, a UI wtedy nie rysuje ścieżki wcale (lepiej nic niż błędny etap).
// Kolejność reguł ma znaczenie: "Stały Komitet Rady Ministrów" zawiera "Rady Ministrów",
// więc komitet sprawdzamy PRZED Radą Ministrów.
export const DRAFT_STEP_KEYS = ["list", "agree", "consult", "committees", "council", "sejm"];

const RULES = [
  [/sejm/i, 5],
  [/komitet/i, 3],
  [/rad[ay]\s+ministr/i, 4],
  [/konsultac/i, 2],
  [/uzgodni/i, 1],
  [/zg\u0142osz|zglosz|wykaz/i, 0],
];

// Zwraca indeks kroku 0..5 albo -1, gdy nazwy etapu nie rozpoznano / jej brak.
export function draftStageIndex(stageName) {
  const s = String(stageName || "");
  for (const [re, idx] of RULES) if (re.test(s)) return idx;
  return -1;
}
