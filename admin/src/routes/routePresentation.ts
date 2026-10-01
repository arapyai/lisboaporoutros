export function excerpt(value: string, length: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length)}…` : compact;
}
