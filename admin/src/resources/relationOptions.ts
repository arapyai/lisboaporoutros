import type { FieldOption } from '../adminTypes';

export function relationOptions(
  items: Array<{ id: string; name?: string; title_pt?: string; name_pt?: string }>,
  emptyLabel: string,
  currentValue = ''
): FieldOption[] {
  return [
    { value: '', label: emptyLabel },
    ...items.map((item) => ({
      value: item.id,
      label: item.name ?? item.title_pt ?? item.name_pt ?? item.id
    })),
    ...(currentValue && !items.some(item => item.id === currentValue)
      ? [{ value: currentValue, label: 'Associação atual indisponível — escolha para substituir' }] : [])
  ];
}
