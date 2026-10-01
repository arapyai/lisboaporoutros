import type { Draft, FieldConfig } from '../adminTypes';
import { ResourcePanel, type ResourcePanelProps } from '../resources/ResourcePanel';

const fields: FieldConfig[] = [
  { name: 'name', label: 'Nome', type: 'text' },
  { name: 'bio_pt', label: 'Bio PT', type: 'textarea', placeholder: 'Resumo biográfico em português' },
  { name: 'birth_year', label: 'Ano de nascimento', type: 'number', min: 0, max: 2100, step: 1 },
  { name: 'death_year', label: 'Ano de morte', type: 'number', min: 0, max: 2100, step: 1 },
  { name: 'photo_url', label: 'Foto URL', type: 'url' },
  { name: 'elevenlabs_voice_id', label: 'Voz ElevenLabs', type: 'text', placeholder: 'ID da voz no ElevenLabs' }
];

export function AuthorsPanel(props: ResourcePanelProps) {
  return <ResourcePanel {...props} resource="authors"
    renderFields={(draft, onDraft) => <AuthorFields draft={draft} onDraft={onDraft} />} />;
}
function AuthorFields({ draft, onDraft }: { draft: Draft; onDraft: (value: Draft) => void }) {
  return <div className="field-grid">{fields.map(field => <label key={field.name}
    className={field.type === 'textarea' ? 'textarea-field' : undefined}>
    <span>{field.label}</span>
    {field.type === 'textarea'
      ? <textarea value={String(draft[field.name] ?? '')} placeholder={field.placeholder}
          onChange={event => onDraft({ ...draft, [field.name]: event.target.value })} />
      : <input type={field.type} value={String(draft[field.name] ?? '')} placeholder={field.placeholder}
          min={field.min} max={field.max} step={field.step}
          onChange={event => onDraft({ ...draft, [field.name]: event.target.value })} />}
  </label>)}</div>;
}
