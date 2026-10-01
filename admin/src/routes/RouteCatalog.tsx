import type { AdminRoute, AdminText } from '@ecosdelisboa/shared';
import { excerpt } from './routePresentation';

export function RouteCatalog({ routes, selectedId, availableTexts, search, onSearch, onSelect, onAddText }: {
  routes: AdminRoute[];
  selectedId?: string;
  availableTexts: AdminText[];
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onAddText: (text: AdminText) => void;
}) {
  return (
    <aside className="route-catalog">
      <div className="route-catalog-heading">
        <h3>Percursos</h3>
        <span>{routes.length}</span>
      </div>
      <div className="route-list">
        {routes.map((route) => (
          <button
            type="button"
            key={route.id}
            className={selectedId === route.id ? 'active' : ''}
            onClick={() => onSelect(route.id)}
          >
            <strong>{route.title_pt}</strong>
            <small>{route.segments?.filter((segment) => segment.kind === 'text').length ?? 0} textos</small>
          </button>
        ))}
      </div>

      <div className="available-texts-heading">
        <h3>Textos disponíveis</h3>
        <span>{availableTexts.length}</span>
      </div>
      <input
        type="search"
        value={search}
        placeholder="Autor, obra, excerto ou lugar"
        onChange={(event) => onSearch(event.target.value)}
      />
      <div className="available-text-list">
        {availableTexts.map((text) => (
          <button
            type="button"
            key={text.id}
            className="available-text-card"
            onClick={() => onAddText(text)}
          >
            <strong>{text.author?.name ?? 'Autor por definir'}</strong>
            <span>{text.source_work || excerpt(text.content_pt, 74)}</span>
            <small>⌖ {text.point?.title_pt ?? 'Lugar por definir'}</small>
          </button>
        ))}
        {!availableTexts.length ? <p>Nenhum texto corresponde à busca.</p> : null}
      </div>
    </aside>

  );
}
