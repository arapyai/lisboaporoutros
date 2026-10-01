import type { AdminPointType } from '@ecosdelisboa/shared';
type SelectablePointType = Pick<AdminPointType, 'id' | 'slug' | 'name_pt' | 'is_active'>;

export function defaultPointType(types: SelectablePointType[]) {
  return types.find(type => type.is_active && type.slug === 'literary') ?? types.find(type => type.is_active);
}

export function pointTypeOptions(types: SelectablePointType[], selectedId: string) {
  const options = types.filter(type => type.is_active || type.id === selectedId)
    .map(type => ({ value: type.id, label: type.name_pt + (type.is_active ? '' : ' (inativo)') }));
  if (selectedId && !options.some(option => option.value === selectedId)) {
    options.push({ value: selectedId, label: 'Tipo atual indisponível — reveja antes de guardar' });
  }
  return [{ value: '', label: 'Selecione um tipo' }, ...options];
}
