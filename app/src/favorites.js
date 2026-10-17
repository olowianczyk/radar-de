// "Ulubione" — personal bookmarks on detected changes (the star on a feed card
// and in the detail panel, plus the "Ulubione" tab of the feed).
//
// PERSONAL, not shared: there are no user accounts, so "mine" = this browser.
// Stored in localStorage per department (key "hrbp-favs-<ws>"), so HR's stars
// never show up in Compliance and nobody else's clicks touch yours.
//
// Each favourite keeps a SNAPSHOT of the change (title, act, links, dates…),
// not just its id: after "Wyczyść wykrycia" the change is gone from the scan
// history, but the bookmark still opens with everything it showed. When the
// change is detected again, the live version (current review status) wins.
//
// ponytail: localStorage = one browser/device per person; move to a server doc
// keyed by person once there is a login, if stars must follow people across devices.
import React from "react";

const key = (wsId) => `hrbp-favs-${wsId}`;

// Pure helpers (also used by scripts/check-favorites.mjs).
// toggleFav: adds `change` (stamped with the time it was starred) or removes it.
export function toggleFav(favs, change, now = new Date().toISOString()) {
  const next = { ...favs };
  if (next[change.id]) delete next[change.id];
  else next[change.id] = { ...change, favAt: now };
  return next;
}

// The list for the "Ulubione" tab: live change when it is still in the feed,
// otherwise the stored snapshot; newest-starred first.
export function favList(favs, changes) {
  const live = new Map(changes.map((c) => [c.id, c]));
  return Object.values(favs)
    .sort((a, b) => String(b.favAt).localeCompare(String(a.favAt)))
    .map((f) => live.get(f.id) || f);
}

// React hook: { favs, isFav(id), toggle(change) } for one department.
export function useFavorites(wsId) {
  const read = () => { try { return JSON.parse(localStorage.getItem(key(wsId)) || "{}") || {}; } catch (e) { return {}; } };
  const [favs, setFavs] = React.useState(read);
  // Department switch = another key.
  React.useEffect(() => { setFavs(read()); }, [wsId]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = React.useCallback((change) => setFavs((prev) => {
    const next = toggleFav(prev, change);
    try { localStorage.setItem(key(wsId), JSON.stringify(next)); } catch (e) { /* private mode: stars last until reload */ }
    return next;
  }), [wsId]);
  return { favs, isFav: (id) => !!favs[id], toggle };
}
