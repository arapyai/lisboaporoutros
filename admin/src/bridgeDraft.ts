export type BridgeDraft = { content: string };
export function validateBridgeDraft(value: unknown): BridgeDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 1 || typeof item.content !== 'string') return null;
  return { content: item.content };
}
