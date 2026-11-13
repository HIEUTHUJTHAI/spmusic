# SPMusic 2.17.0 — Studio layout

The navigation panel follows its content height instead of filling the left edge with an empty area and an upload promotion. File upload and YouTube link import share a compact action row. Playlist artwork is larger, with secondary labels, and a library summary uses actual song/artist counts.

The search toolbar remains fixed while the document scrolls. The Now Playing dock sits below it with the same 12px spacing; the bottom player is inset from all edges. Content reserves space for the dock on wide windows; at smaller widths the dock overlays content and can be closed without stopping audio.

`client/src/shell.css` defines the shell geometry after the existing palette and feature styles. It keeps theme selection, glass opacity, wallpaper, reduced motion, tab springs and fullscreen playback. The playlist area normally scrolls independently; on very short desktop windows the entire sidebar scrolls so both its first action and its final summary remain reachable.

`tools/test-shell.cjs` exercises actual rendered bounds, page and dock scrolling, long titles and reduced motion using an isolated database and generated audio/artwork. It writes screenshots and a durable result under `.runtime`.
