const iconPaths: Record<string, string> = {
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3Z"/><path d="M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3Z"/>',
  library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/><path d="M2 20h20"/>',
  landmark: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2 2 7h20Z"/>',
  headphones: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M18 19c0 1.7-1.3 3-3 3v-6h3Z"/><path d="M6 19c0 1.7 1.3 3 3 3v-6H6Z"/>',
  'map-pin': '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  trees: '<path d="m10 10 2-3 2 3"/><path d="m8 14 4-6 4 6"/><path d="m6 18 6-9 6 9Z"/><path d="M12 22v-4"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/><path d="M18 8h1a3 3 0 0 1 0 6h-1"/><path d="M4 8h14v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};

export function pointTypeIconMarkup(iconKey: string) {
  const paths = iconPaths[iconKey] ?? iconPaths['map-pin'];
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
