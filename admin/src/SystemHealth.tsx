import { useQuery } from '@tanstack/react-query';
import { client } from './adminConfig';

type CheckStatus = 'ok' | 'error' | 'missing_config' | 'configuration_only' | 'disabled';
type HealthReport = {
  checked_at: string;
  checks: Array<{ service: string; status: CheckStatus; message: string }>;
};

const serviceNames: Record<string, string> = {
  routing: 'Rotas pedonais',
  database: 'Banco de dados',
  media: 'Arquivos de áudio',
  translation: 'Tradução',
  voice: 'Geração de voz',
  email: 'Envio de e-mail',
  maps: 'Mapa de revisão',
  geocoding: 'Busca de endereços',
  workers: 'Fila de geração'
};

const statusNames: Record<CheckStatus, string> = {
  ok: 'Respondeu',
  error: 'Falha',
  missing_config: 'Falta configurar',
  configuration_only: 'Só configuração verificada',
  disabled: 'Desativado'
};

export function useSystemHealth(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ['system-health', token],
    queryFn: async () => {
      const report = await client.get<HealthReport>('/api/v1/admin/health', token);
      if (!report || !Array.isArray(report.checks) || !report.checked_at) {
        throw new Error('Diagnóstico inválido');
      }
      return report;
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false
  });
}

export function systemHealthNotice(report: ReturnType<typeof useSystemHealth>) {
  if (report.isError) return 'Diagnóstico indisponível';
  const issues = report.data?.checks.filter(check =>
    check.status === 'missing_config' || check.status === 'error'
  ) ?? [];
  if (issues.length > 1) return `${issues.length} integrações precisam de atenção`;
  return issues[0] ? serviceNames[issues[0].service] ?? issues[0].service : '';
}

export function SystemHealthPanel({ report }: { report: ReturnType<typeof useSystemHealth> }) {
  return (
    <section className="content-panel system-health-panel" aria-labelledby="system-health-title">
      <h2 id="system-health-title">Saúde do sistema</h2>
      <p>Diagnóstico das integrações. Nenhum conteúdo é alterado e nenhum e-mail é enviado.</p>
      <button type="button" onClick={() => void report.refetch()} disabled={report.isFetching}>
        {report.isFetching ? 'A consultar…' : 'Consultar diagnóstico'}
      </button>
      {report.isPending && <p role="status">A verificar as integrações…</p>}
      {report.isError && <p role="alert">Não foi possível consultar agora.
        {report.data && ' Abaixo está o último resultado disponível.'}</p>}
      {report.data && <>
        <p>Verificado em <time dateTime={report.data.checked_at}>
          {new Date(report.data.checked_at).toLocaleString('pt-PT')}
        </time>. O servidor reutiliza o resultado durante cinco minutos.</p>
        <ul className="system-health-checks">
          {report.data.checks.map(check => (
            <li key={check.service}>
              <strong>{serviceNames[check.service] ?? check.service}</strong>
              <p><b>{statusNames[check.status]}</b> · {check.message}</p>
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}
