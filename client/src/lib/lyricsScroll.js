// Move only the lyrics pane; scrolling the active line into view must never move the page.
export function lyricsScrollTop(container, line) {
  const panel = container.getBoundingClientRect();
  const item = line.getBoundingClientRect();
  const target = container.scrollTop + item.top - panel.top + item.height / 2 - panel.height / 2;
  return Math.max(0, Math.min(target, Math.max(0, container.scrollHeight - container.clientHeight)));
}
