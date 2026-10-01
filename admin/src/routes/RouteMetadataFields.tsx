import type { RefObject } from 'react';
import type { RouteDraft } from './routeEditorModel';

export function RouteMetadataFields({ draft, onDraft, titleInput }: {
  draft: RouteDraft;
  onDraft: (draft: RouteDraft) => void;
  titleInput: RefObject<HTMLInputElement | null>;
}) {
  return (
    <section className="route-metadata-card">
      <label>
        Título em português
        <input
          ref={titleInput}
          value={draft.title_pt}
          onChange={(event) => onDraft({ ...draft, title_pt: event.target.value })}
        />
      </label>
      <label>
        Slug
        <input
          value={draft.slug}
          placeholder="do-tejo-ao-chiado"
          onChange={(event) => onDraft({ ...draft, slug: event.target.value })}
        />
      </label>
      <label className="route-wide-field">
        Descrição
        <textarea
          value={draft.description_pt}
          onChange={(event) => onDraft({ ...draft, description_pt: event.target.value })}
        />
      </label>
      <label>
        Dificuldade
        <select
          value={draft.difficulty}
          onChange={(event) => onDraft({ ...draft, difficulty: event.target.value })}
        >
          <option value="easy">Fácil</option>
          <option value="medium">Média</option>
          <option value="hard">Difícil</option>
        </select>
      </label>
      <label>
        Imagem de capa
        <input
          type="url"
          value={draft.cover_image_url}
          onChange={(event) => onDraft({ ...draft, cover_image_url: event.target.value })}
        />
      </label>
    </section>

  );
}
