import type { AdminPoint, AdminRouteReadiness, AdminText, ContentGenerationBatch } from '@ecosdelisboa/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { client } from '../adminConfig';
import { isAuthError } from '../adminApi';
import { adminFailureMessage } from '../adminErrorMessages';
import { batchTasks, localDraftTasks, reviewTasks, routeTasks, type EditorialTask } from './editorialTasks';

type SourceState = { isPending: boolean; isFetching: boolean; isError: boolean; error: unknown; dataUpdatedAt: number; refetch: () => unknown };
export function TasksPanel({ token, userId, navigateHash, onAuthExpired }: {
  token: string; userId: string; navigateHash: (hash: string) => boolean; onAuthExpired: () => void;
}) {
  const texts = useQuery({ queryKey: ['admin-resource', 'texts', token],
    queryFn: () => client.get<AdminText[]>('/api/v1/admin/texts', token), retry: false });
  const points = useQuery({ queryKey: ['admin-resource', 'points', token],
    queryFn: () => client.get<AdminPoint[]>('/api/v1/admin/points', token), retry: false });
  const routes = useQuery({ queryKey: ['route-readiness-inventory', token],
    queryFn: () => client.get<AdminRouteReadiness[]>('/api/v1/admin/routes/readiness', token), retry: false });
  const batches = useQuery({ queryKey: ['generation-batches', token],
    queryFn: () => client.get<ContentGenerationBatch[]>('/api/v1/admin/automation/batches?active=false', token), retry: false });
  const [local, setLocal] = useState<{ tasks: EditorialTask[]; error: boolean }>(() => inspectLocal(userId));
  useEffect(() => {
    if ([texts.error, points.error, routes.error, batches.error].some(isAuthError)) onAuthExpired();
  }, [texts.error, points.error, routes.error, batches.error, onAuthExpired]);
  useEffect(() => {
    const refresh = () => setLocal(inspectLocal(userId));
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [userId]);
  function refresh() {
    setLocal(inspectLocal(userId));
    void Promise.all([texts.refetch(), points.refetch(), routes.refetch(), batches.refetch()]);
  }
  return <section className="content-panel tasks-panel" aria-labelledby="tasks-title">
    <header className="tasks-heading">
      <div><span>Trabalho editorial</span><h2 id="tasks-title">Pendências</h2>
        <p>Escolha uma tarefa para abrir o item e idioma certos. Abrir não aprova, publica nem inicia geração.</p></div>
      <button type="button" onClick={refresh} disabled={[texts, points, routes, batches].some(query => query.isFetching)}>Atualizar pendências</button>
    </header>
    <TaskSection title="Traduções de textos" tasks={texts.data ? reviewTasks(texts.data, []) : []} source={texts} hasData={texts.data !== undefined} navigateHash={navigateHash} />
    <TaskSection title="Traduções de pontos" tasks={points.data ? reviewTasks([], points.data) : []} source={points} hasData={points.data !== undefined} navigateHash={navigateHash} />
    <TaskSection title="Bloqueios de percursos" tasks={routes.data ? routeTasks(routes.data) : []} source={routes} hasData={routes.data !== undefined} navigateHash={navigateHash} />
    <TaskSection title="Falhas de lotes" tasks={batches.data ? batchTasks(batches.data) : []} source={batches} hasData={batches.data !== undefined} navigateHash={navigateHash} />
    <section className="tasks-section" aria-label="Rascunhos neste navegador">
      <h3>Rascunhos neste navegador</h3>
      <p>Somente desta conta e deste navegador. A restauração e a comparação com o servidor acontecem no editor, por confirmação.</p>
      {local.error ? <><p role="alert">Não foi possível consultar as cópias locais. Isto não significa que não existam rascunhos.</p>
        <button type="button" onClick={() => setLocal(inspectLocal(userId))}>Consultar rascunhos novamente</button></>
        : <TaskList tasks={local.tasks} navigateHash={navigateHash} empty="Nenhuma cópia local válida identificada para esta conta." />}
    </section>
  </section>;
}
function inspectLocal(userId: string) {
  try { return { tasks: localDraftTasks(localStorage, userId), error: false }; }
  catch { return { tasks: [], error: true }; }
}
function TaskSection({ title, tasks, source, hasData, navigateHash }: {
  title: string; tasks: EditorialTask[]; source: SourceState; hasData: boolean; navigateHash: (hash: string) => boolean;
}) {
  return <section className="tasks-section" aria-label={title}>
    <h3>{title}{hasData ? ` · ${tasks.length}` : ''}</h3>
    {source.isPending ? <p role="status">A consultar {title.toLowerCase()}…</p> : null}
    {source.isError ? <><p role="alert">{adminFailureMessage(source.error, 'Consulta indisponível. Não foi possível confirmar as pendências desta área.')}</p>
      {hasData ? <p>Os itens abaixo são da última consulta; podem estar desatualizados.</p> : null}
      <button type="button" onClick={() => { void source.refetch(); }}>Tentar novamente: {title}</button></> : null}
    {hasData && source.dataUpdatedAt ? <p className="tasks-updated">Última consulta: {new Date(source.dataUpdatedAt).toLocaleTimeString('pt-PT')}{source.isFetching ? ' · A atualizar…' : ''}</p> : null}
    {hasData && (!source.isError || tasks.length > 0) ? <TaskList tasks={tasks} navigateHash={navigateHash} empty="Nenhuma pendência identificada nesta consulta." /> : null}
  </section>;
}
function TaskList({ tasks, navigateHash, empty }: { tasks: EditorialTask[]; navigateHash: (hash: string) => boolean; empty: string }) {
  if (!tasks.length) return <p>{empty}</p>;
  return <ul className="tasks-list">{tasks.map(task => <li key={task.id}>
    <div><strong>{task.title}</strong><p>{task.detail}</p></div>
    <button type="button" className="secondary-action" aria-label={`Abrir: ${task.title} · ${task.detail}`} onClick={() => navigateHash(task.hash)}>Abrir tarefa</button>
  </li>)}</ul>;
}
