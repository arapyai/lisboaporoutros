import type { Author, Point, TextEntry } from './types';

/** A multi-author point must use the selected text's author, never its first author. */
export function pointTextAuthor(point: Point, text?: TextEntry): Pick<Author, 'id' | 'name'> | null {
  const id = text?.author_id ?? text?.author?.id;
  if (text) {
    if (!id) return null;
    const author = [text.author, ...(point.authors ?? []), point.author].find((item) => item?.id === id);
    return { id, name: author?.name ?? '' };
  }
  return null;
}
