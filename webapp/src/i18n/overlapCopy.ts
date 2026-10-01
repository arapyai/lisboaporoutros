import type { Lang } from '../types';

const labels = {
  pt: { previous: 'Trecho anterior', next: 'Próximo trecho', all: 'Ver todos', loading: 'A carregar conteúdos deste local…', error: 'Não foi possível carregar os conteúdos deste local.', retry: 'Tentar novamente', empty: 'Não há conteúdos para este filtro.', excerpt: 'Trecho', item: 'Item', of: 'de', here: 'Neste local', overlap: 'Locais sobrepostos' },
  en: { previous: 'Previous excerpt', next: 'Next excerpt', all: 'View all', loading: 'Loading content at this location…', error: 'Could not load content at this location.', retry: 'Try again', empty: 'No content for this filter.', excerpt: 'Excerpt', item: 'Item', of: 'of', here: 'At this location', overlap: 'Overlapping locations' },
  es: { previous: 'Fragmento anterior', next: 'Siguiente fragmento', all: 'Ver todos', loading: 'Cargando contenidos de este lugar…', error: 'No se pudieron cargar los contenidos.', retry: 'Reintentar', empty: 'No hay contenidos para este filtro.', excerpt: 'Fragmento', item: 'Elemento', of: 'de', here: 'En este lugar', overlap: 'Lugares superpuestos' },
  fr: { previous: 'Extrait précédent', next: 'Extrait suivant', all: 'Tout voir', loading: 'Chargement des contenus de ce lieu…', error: 'Impossible de charger les contenus.', retry: 'Réessayer', empty: 'Aucun contenu pour ce filtre.', excerpt: 'Extrait', item: 'Élément', of: 'sur', here: 'À cet endroit', overlap: 'Lieux superposés' },
  de: { previous: 'Vorheriger Auszug', next: 'Nächster Auszug', all: 'Alle anzeigen', loading: 'Inhalte für diesen Ort werden geladen…', error: 'Die Inhalte konnten nicht geladen werden.', retry: 'Erneut versuchen', empty: 'Keine Inhalte für diesen Filter.', excerpt: 'Auszug', item: 'Eintrag', of: 'von', here: 'An diesem Ort', overlap: 'Überlagerte Orte' },
  zh: { previous: '上一篇', next: '下一篇', all: '查看全部', loading: '正在加载此处的内容…', error: '无法加载此处的内容。', retry: '重试', empty: '此筛选条件下没有内容。', excerpt: '片段', item: '内容', of: '/', here: '此地点', overlap: '重叠地点' }
};

export function overlapCopy(lang: Lang, index: number, total: number, textOnly: boolean, single: boolean) {
  const copy = labels[lang as keyof typeof labels] ?? labels.pt;
  return { ...copy, count: `${textOnly ? copy.excerpt : copy.item} ${index + 1} ${copy.of} ${total}`, context: single ? copy.here : copy.overlap };
}
