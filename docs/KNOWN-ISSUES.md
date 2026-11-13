
## Fixed in 2.17.0: Now Playing top gap on page scroll
- Reported 2026-11-13 on 2.16.1. At initial page position dock aligns below search toolbar. When scrolling playlist/library, toolbar scrolls away but dock retains its fixed top offset, leaving a large empty gap above it.
- Fixed: toolbar remains at the top of the viewport; dock aligns 12px below it at every page scroll position. Preserved bottom player clearance, independent dock scrolling and horizontal-overflow fix.
- Verify at page top, mid-scroll and return to top, with dock open/closed and multiple window sizes.
- Included in the requested shell redesign rather than a standalone patch.
