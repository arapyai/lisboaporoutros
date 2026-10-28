import { ApiError } from '@ecosdelisboa/shared';
import type { Draft } from './adminTypes';

const fieldMessages = {
  point_id: 'Selecione um ponto para este texto. Se o lugar ainda não existe, cadastre-o em Pontos primeiro.',
  author_id: 'Selecione o autor deste texto. Se ainda não existe, cadastre-o em Autores primeiro.',
  content_pt: 'Preencha o conteúdo do texto no idioma-fonte antes de guardar.',
  source_year: 'Informe um ano da obra inteiro ou deixe o campo vazio.',
  content_type: 'Selecione o tipo do texto: Prosa, Poesia ou Letra de música.'
} as const;

export class TextSaveValidationError extends Error {
  readonly field: keyof typeof fieldMessages;

  constructor(field: keyof typeof fieldMessages) {
    super(fieldMessages[field]);
    this.name = 'TextSaveValidationError';
    this.field = field;
  }
}

export function validateTextSave(draft: Draft): void {
  for (const field of ['point_id', 'author_id', 'content_pt'] as const) {
    if (!String(draft[field] ?? '').trim()) throw new TextSaveValidationError(field);
  }
  if (!['prose', 'poetry', 'lyrics'].includes(String(draft.content_type))) {
    throw new TextSaveValidationError('content_type');
  }
  const year = draft.source_year;
  if (year !== null && year !== undefined && year !== '' && !Number.isInteger(Number(year))) {
    throw new TextSaveValidationError('source_year');
  }
}

export function textSaveValidationError(cause: unknown): TextSaveValidationError | null {
  if (cause instanceof TextSaveValidationError) return cause;
  if (!(cause instanceof ApiError) || cause.status !== 422 || !Array.isArray(cause.detail)) return null;
  for (const issue of cause.detail) {
    if (!issue || !Array.isArray(issue.loc) || issue.loc[0] !== 'body') continue;
    const field = issue.loc[1];
    if (typeof field === 'string' && Object.hasOwn(fieldMessages, field)) {
      return new TextSaveValidationError(field as keyof typeof fieldMessages);
    }
  }
  return null;
}
