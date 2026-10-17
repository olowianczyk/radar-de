// Self-check for app/src/favorites.js pure helpers. Run: node scripts/check-favorites.mjs
// A favourite must survive the change leaving the feed (snapshot), show the
// live version when the change is in the feed, and toggle off cleanly.
import assert from "assert";
import { toggleFav, favList } from "../app/src/favorites.js";
const a = { id: "DU/2026/1", title: { pl: "A" }, status: "new" };
const b = { id: "SAOS/9", title: { pl: "B" }, status: "new" };
let f = toggleFav({}, a, "2026-10-18T10:00:00Z");
f = toggleFav(f, b, "2026-10-18T11:00:00Z");
assert.deepStrictEqual(favList(f, []).map((c) => c.id), ["SAOS/9", "DU/2026/1"], "snapshots after a reset, newest star first");
const liveA = { ...a, status: "done" };
assert.strictEqual(favList(f, [liveA]).find((c) => c.id === a.id).status, "done", "live change wins over snapshot");
f = toggleFav(f, a);
assert.deepStrictEqual(Object.keys(f), ["SAOS/9"], "second click removes");
console.log("favorites ok");
