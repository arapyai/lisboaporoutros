import type { AdminRouteSegment } from '@ecosdelisboa/shared';

export function RouteVisitorPreview({ selectedSegment, previewLang, onLanguage }: {
  selectedSegment?: AdminRouteSegment;
  previewLang: 'pt' | 'en';
  onLanguage: (language: 'pt' | 'en') => void;
}) {
  return (
    <section className="route-preview-card">
      <div className="spatial-heading">
        <div>
          <span className="eyebrow">Preview do visitante</span>
          <h3>{selectedSegment ? `Etapa ${selectedSegment.position}` : 'Escolha uma etapa'}</h3>
        </div>
        <select value={previewLang} onChange={(event) => onLanguage(event.target.value as 'pt' | 'en')}>
          <option value="pt">PT</option>
          <option value="en">EN</option>
        </select>
      </div>
      <RouteSegmentPreview segment={selectedSegment} lang={previewLang} />
    </section>
  );
}

function RouteSegmentPreview({
  segment,
  lang
}: {
  segment?: AdminRouteSegment;
  lang: 'pt' | 'en';
}) {
  if (!segment) return <p>Selecione um texto ou uma ponte na sequência.</p>;
  if (segment.kind === 'text') {
    const translation = segment.text?.translations?.find(
      (item) => item.lang === lang && item.status === 'approved'
    );
    const content = lang === 'pt' ? segment.text?.content_pt : translation?.content;
    const audio = segment.text?.audio_files?.find((item) => item.lang === lang && item.public_url);
    return (
      <div className="visitor-preview-copy">
        <span>{segment.text?.author?.name ?? 'Autor'}</span>
        <h4>{segment.text?.source_work ?? segment.text?.point?.title_pt ?? 'Texto'}</h4>
        <small>⌖ {segment.text?.point?.title_pt ?? 'Lugar por definir'}</small>
        <p>{content || `Tradução ${lang.toUpperCase()} em falta.`}</p>
        {audio?.public_url ? <audio controls preload="none" src={audio.public_url} /> : <em>Áudio {lang.toUpperCase()} em falta</em>}
      </div>
    );
  }
  const translation = segment.translations?.find(
    (item) => item.lang === lang && item.status === 'approved'
  );
  const content = lang === 'pt' ? segment.bridge_content_pt : translation?.content;
  const audio = segment.audio_files?.find((item) => item.lang === lang && item.public_url);
  return (
    <div className="visitor-preview-copy bridge-preview-copy">
      <span>Ponte curatorial</span>
      <p>{content || `Tradução ${lang.toUpperCase()} em falta.`}</p>
      {audio?.public_url ? <audio controls preload="none" src={audio.public_url} /> : <em>Áudio {lang.toUpperCase()} em falta</em>}
    </div>
  );
}
