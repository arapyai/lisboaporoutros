import type { RouteReadiness } from '@ecosdelisboa/shared';
import { adminFailureMessage } from '../adminErrorMessages';

type ReadinessQuery = { data?: RouteReadiness; isFetching: boolean; error: unknown; refetch: () => unknown };

export function RoutePublicationCard({ published, disabled, publishing, hasLocalChanges, canUseServerTools, ptReadiness, enReadiness, selectSegment, onPublication }: {
  published: boolean;
  disabled: boolean;
  publishing: boolean;
  hasLocalChanges: boolean;
  canUseServerTools: boolean;
  ptReadiness: ReadinessQuery;
  enReadiness: ReadinessQuery;
  selectSegment: (id?: string) => void;
  onPublication: () => void;
}) {
  return (
    <section className="route-readiness-card">
      <div className="spatial-heading">
        <div>
          <span className="eyebrow">Publicação</span>
          <h3>Prontidão PT/EN</h3>
        </div>
      </div>
      <p>{published ? 'Publicado' : 'Não publicado'} — guardar a narrativa não altera a publicação.</p>
      <button type="button" disabled={disabled}
        onClick={onPublication}>
        {publishing ? 'A atualizar publicação…' : published ? 'Retirar de publicação' : 'Publicar percurso'}
      </button>
      {hasLocalChanges ? <p>Resolva as alterações da narrativa, idiomas e caminhada antes de alterar a publicação.</p> : null}
      {!canUseServerTools ? <p>Guarde a narrativa antes de verificar as pendências.</p> : null}
      {canUseServerTools ? (
        <>
          <ReadinessSummary label="PT" readiness={ptReadiness.data} loading={ptReadiness.isFetching} error={ptReadiness.error} onRetry={() => { void ptReadiness.refetch(); }} onIssue={selectSegment} />
          <ReadinessSummary label="EN" readiness={enReadiness.data} loading={enReadiness.isFetching} error={enReadiness.error} onRetry={() => { void enReadiness.refetch(); }} onIssue={selectSegment} />
        </>
      ) : null}
    </section>

  );
}

function ReadinessSummary({
  label,
  readiness,
  loading,
  error,
  onRetry,
  onIssue
}: {
  label: string;
  readiness?: RouteReadiness;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onIssue: (segmentId: string) => void;
}) {
  return (
    <div className={`readiness-language${readiness?.ready && !error ? ' ready' : ''}`}>
      <div>
        <strong>{label}</strong>
        <span>{loading ? 'a verificar…' : error ? 'verificação indisponível' : readiness?.ready ? 'pronto' : readiness ? `${readiness.issues.length} pendências` : 'por verificar'}</span>
      </div>
      {error ? <p role="alert">{adminFailureMessage(error, `Não foi possível verificar a prontidão ${label}.`)} {readiness ? 'Dados anteriores: a prontidão precisa de nova confirmação.' : 'As pendências ainda não são conhecidas.'} <button type="button" disabled={loading} onClick={onRetry}>Tentar novamente</button></p> : null}
      {readiness?.issues.slice(0, 5).map((issue) =>
        issue.segment_id ? (
          <button type="button" key={`${issue.code}-${issue.path}`} onClick={() => onIssue(issue.segment_id!)}>
            {readinessIssueLabel(issue.code)}
          </button>
        ) : issue.code.includes('route_translation') ? (
          <a key={`${issue.code}-${issue.path}`} href="#route-metadata-en" onClick={event => {
            event.preventDefault();
            document.getElementById('route-metadata-en')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.querySelector<HTMLInputElement>('#route-metadata-en input')?.focus();
          }}>{readinessIssueLabel(issue.code)}</a>
        ) : (
          <p key={`${issue.code}-${issue.path}`}>{readinessIssueLabel(issue.code)}</p>
        )
      )}
    </div>
  );
}


function readinessIssueLabel(code: string) {
  const labels: Record<string, string> = {
    missing_title: 'Completar título',
    missing_description: 'Completar descrição',
    missing_difficulty: 'Definir dificuldade',
    missing_route_translation: 'Traduzir metadados',
    too_few_texts: 'Adicionar pelo menos dois textos',
    missing_text_translation: 'Rever tradução do texto',
    missing_text_audio: 'Gerar áudio do texto',
    missing_bridge_translation: 'Traduzir ponte',
    missing_bridge_audio: 'Gerar áudio da ponte',
    routing_stale: 'Recalcular caminhada',
    legacy_segment: 'Rever etapa legada'
  };
  return labels[code] ?? code;
}
