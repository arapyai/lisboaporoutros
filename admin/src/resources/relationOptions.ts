import type { FieldOption } from '../adminTypes';

export function relationOptions(
  items: Array<{ id: string; name?: string; title_pt?: string; name_pt?: string }>,
  emptyLabel: string
): FieldOption[] {
  return [
    { value: '', label: emptyLabel },
    ...items.map((item) => ({
      value: item.id,
      label: item.name ?? item.title_pt ?? item.name_pt ?? item.id
    }))
  ];
}
