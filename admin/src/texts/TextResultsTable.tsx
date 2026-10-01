import type { AdminAudioFile, AdminLanguage, AdminText, AdminTranslation } from '@ecosdelisboa/shared';
import { useMemo } from 'react';
import { highlightParts, type TextListFilters } from './textListModel';

export function TextResultsTable({ filteredTexts, editingId, selected, selectedVisible, loading, authorById, pointById, languages, sourceLanguage, translations, audios, search, onToggle, onToggleAll, onEdit }: {
  filteredTexts: AdminText[];
  editingId?: string;
  selected: Set<string>;
  selectedVisible: number;
  loading: boolean;
  authorById: Map<string, string>;
  pointById: Map<string, string>;
  languages: AdminLanguage[];
  sourceLanguage: string;
  translations: AdminTranslation[];
  audios: AdminAudioFile[];
  search: string;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (text: AdminText, language?: string) => void;
}) {
  const translationsByText = useMemo(() => groupByText(translations), [translations]);
  const audiosByText = useMemo(() => groupByText(audios), [audios]);
  return (
        <div className="table-wrap editorial-table-wrap" aria-busy={loading}>
          <table className="editorial-table">
            <thead><tr>
              <th><input aria-label="Selecionar resultados" type="checkbox" checked={Boolean(filteredTexts.length) && selectedVisible === filteredTexts.length} onChange={onToggleAll} /></th>
              <th>Texto</th><th>Ponto</th><th>Autor</th><th>Obra</th><th>Idiomas</th><th><span className="sr-only">Ações</span></th>
            </tr></thead>
            <tbody>
              {filteredTexts.map((text) => (
                <tr key={text.id} className={editingId === text.id ? 'selected-row' : ''}>
                  <td><input aria-label="Selecionar texto" type="checkbox" checked={selected.has(text.id)} onChange={() => onToggle(text.id)} /></td>
                  <td className="text-excerpt-cell" onClick={() => onEdit(text)}>
                    <strong><Highlighted value={firstLine(text.content_pt)} query={search} /></strong>
                    <p><Highlighted value={text.content_pt} query={search} /></p>
                  </td>
                  <td><Highlighted value={pointById.get(text.point_id) ?? '—'} query={search} /></td>
                  <td><Highlighted value={authorById.get(text.author_id) ?? '—'} query={search} /></td>
                  <td><Highlighted value={text.source_work ?? '—'} query={search} /></td>
                  <td><LanguageMatrix
                    text={text}
                    languages={languages}
                    sourceLanguage={sourceLanguage}
                    translations={translationsByText.get(text.id) ?? []}
                    audios={audiosByText.get(text.id) ?? []}
                    onLanguage={(language) => onEdit(text, language)}
                  /></td>
                  <td><button type="button" className="text-action" onClick={() => onEdit(text)}>Editar</button></td>
                </tr>
              ))}
              {!loading && !filteredTexts.length ? <tr><td colSpan={7}>Nenhum texto corresponde à busca.</td></tr> : null}
            </tbody>
          </table>
        </div>
  );
}

export function AdvancedFilters({ filters, languages, onChange, onClear }: {
  filters: TextListFilters;
  languages: AdminLanguage[];
  onChange: (filters: TextListFilters) => void;
  onClear: () => void;
}) {
  return <div className="advanced-filters">
    <label>Idioma<select value={filters.language} onChange={(event) => onChange({ ...filters, language: event.target.value })}><option value="">Todos</option>{languages.map((item) => <option key={item.code} value={item.code}>{item.code.toUpperCase()} · {item.name}</option>)}</select></label>
    <label>Revisão<select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}><option value="">Todas</option><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option></select></label>
    <label>Origem<select value={filters.origin} onChange={(event) => onChange({ ...filters, origin: event.target.value })}><option value="">Todas</option><option value="manual">Manual</option><option value="automatic">IA</option><option value="import">CSV</option></select></label>
    <label>Áudio<select value={filters.audio} onChange={(event) => onChange({ ...filters, audio: event.target.value })}><option value="">Todos</option><option value="missing">Ausente</option><option value="automatic">Gerado</option><option value="manual">Manual</option></select></label>
    <label>Pendência<select value={filters.gap} onChange={(event) => onChange({ ...filters, gap: event.target.value })}><option value="">Todas</option><option value="missing-source-audio">Sem áudio-fonte</option><option value="missing-translation">Sem tradução</option><option value="pending-review">Aguardando revisão</option></select></label>
    <button type="button" className="text-action" onClick={onClear}>Limpar filtros</button>
  </div>;
}

function LanguageMatrix({ text, languages, sourceLanguage, translations, audios, onLanguage }: {
  text: AdminText;
  languages: AdminLanguage[];
  sourceLanguage: string;
  translations: AdminTranslation[];
  audios: AdminAudioFile[];
  onLanguage: (language: string) => void;
}) {
  return <div className="language-matrix">{languages.map((language) => {
    const hasText = language.code === sourceLanguage ? Boolean(text.content_pt.trim()) : translations.some((item) => item.lang === language.code && item.content?.trim());
    const hasAudio = audios.some((item) => item.lang === language.code);
    const label = `${language.name}: ${hasText ? 'com texto' : 'sem texto'}, ${hasAudio ? 'com áudio' : 'sem áudio'}`;
    return <button key={language.code} type="button" className={hasText ? 'has-text' : 'missing-text'} title={label} aria-label={label} onClick={() => onLanguage(language.code)}>{language.code.toUpperCase()}{hasAudio ? <SpeakerIcon /> : null}</button>;
  })}</div>;
}

function Highlighted({ value, query }: { value: string; query: string }) {
  return <>{highlightParts(value, query).map((part, index) => part.match ? <mark key={index}>{part.value}</mark> : <span key={index}>{part.value}</span>)}</>;
}

function SpeakerIcon() {
  return <svg className="speaker-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" /><path d="M16 8.2c1.2 1 1.8 2.2 1.8 3.8S17.2 14.8 16 15.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function firstLine(value: string) {
  const sentence = value.split(/[.!?\n]/)[0]?.trim();
  return sentence || value.slice(0, 56) || 'Texto sem conteúdo';
}

function groupByText<T extends { text_id: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => grouped.set(item.text_id, [...(grouped.get(item.text_id) ?? []), item]));
  return grouped;
}
