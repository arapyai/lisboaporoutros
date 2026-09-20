import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminLanguage, ContentGenerationBatch } from '@ecosdelisboa/shared';
import { fetchCsvTemplate, isAuthError, postCsv } from '../adminApi';
import { client } from '../adminConfig';
import { fallbackLanguages } from '../adminMocks';
import type {
  ImportPreviewRow,
  ImportResult,
  PointCatalogImportResult,
  PointCatalogPreviewRow
} from '../adminTypes';

export function CsvPanel({ token, onAuthExpired, onGenerate }: {
  token: string;
  onAuthExpired: () => void;
  onGenerate?: (textIds: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const [downloadError, setDownloadError] = useState('');
  const [mode, setMode] = useState<'literary' | 'points'>('literary');

  function invalidateImportQueries() {
    queryClient.invalidateQueries({ queryKey: ['admin-resource', 'authors', token] });
    queryClient.invalidateQueries({ queryKey: ['admin-resource', 'points', token] });
    queryClient.invalidateQueries({ queryKey: ['admin-resource', 'texts', token] });
    queryClient.invalidateQueries({ queryKey: ['admin-options', 'authors', token] });
    queryClient.invalidateQueries({ queryKey: ['admin-options', 'points', token] });
  }

  async function downloadTemplate() {
    setDownloadError('');
    try {
      const isPointCatalog = mode === 'points';
      const blob = await fetchCsvTemplate(
        token,
        isPointCatalog
          ? '/api/v1/admin/points/catalog-import/template'
          : '/api/v1/admin/points/import/template'
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = isPointCatalog ? 'point_catalog_template.csv' : 'content_import_template.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      if (isAuthError(cause)) {
        onAuthExpired();
        return;
      }
      setDownloadError('Não foi possível baixar o modelo CSV.');
    }
  }

  return (
    <section className="content-panel">
      <div className="panel-heading">
        <div>
          <span>CSV</span>
          <h2>{mode === 'points' ? 'Cadastro de pontos' : 'Importação de conteúdo'}</h2>
          <p>
            {mode === 'points'
              ? 'Cadastre pontos informativos sem alterar o importador editorial.'
              : 'Valide e importe pontos, autores e textos literários em lote.'}
          </p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void downloadTemplate()}>
          Baixar modelo CSV
        </button>
      </div>
      <div className="import-mode-tabs" role="tablist" aria-label="Modo de importação">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'literary'}
          className={mode === 'literary' ? 'active' : ''}
          onClick={() => setMode('literary')}
        >
          Conteúdo literário
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'points'}
          className={mode === 'points' ? 'active' : ''}
          onClick={() => setMode('points')}
        >
          Cadastro de pontos
        </button>
      </div>
      {downloadError ? <p className="import-error standalone-error">{downloadError}</p> : null}
      {mode === 'literary' ? (
        <CsvImportPanel
          token={token}
          onAuthExpired={onAuthExpired}
          onImported={invalidateImportQueries}
          onGenerate={onGenerate}
        />
      ) : (
        <PointCatalogImportPanel
          token={token}
          onAuthExpired={onAuthExpired}
          onImported={invalidateImportQueries}
        />
      )}
    </section>
  );
}

function PointCatalogImportPanel({
  token,
  onAuthExpired,
  onImported
}: {
  token: string;
  onAuthExpired: () => void;
  onImported: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PointCatalogPreviewRow[]>([]);
  const [result, setResult] = useState<PointCatalogImportResult | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [batchCreated, setBatchCreated] = useState(false);
  const [error, setError] = useState('');
  const languagesQuery = useQuery({
    queryKey: ['admin-languages', token],
    queryFn: () => client.get<AdminLanguage[]>('/api/v1/admin/languages?active=true', token)
  });
  const targetLanguages = (languagesQuery.data ?? fallbackLanguages).filter((language) => !language.is_source);

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um CSV antes de gerar o preview.');
      return postCsv<PointCatalogPreviewRow[]>('/api/v1/admin/points/catalog-import/preview', file, token);
    },
    onSuccess: (rows) => {
      setPreview(rows);
      setResult(null);
      setBatchCreated(false);
      setError('');
    },
    onError: (cause) => handleImportError(cause, onAuthExpired, setError)
  });
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um CSV antes de confirmar.');
      return postCsv<PointCatalogImportResult>('/api/v1/admin/points/catalog-import/confirm', file, token);
    },
    onSuccess: (nextResult) => {
      setResult(nextResult);
      setPreview((current) => (nextResult.errors.length > 0 ? nextResult.errors : current));
      setError('');
      onImported();
    },
    onError: (cause) => handleImportError(cause, onAuthExpired, setError)
  });
  const batchMutation = useMutation({
    mutationFn: () => {
      if (!result?.imported_point_ids.length || !selectedLanguages.length) {
        throw new Error('Escolha ao menos um idioma para gerar traduções.');
      }
      return client.post<ContentGenerationBatch>('/api/v1/admin/automation/point-batches', {
        point_ids: result.imported_point_ids,
        target_languages: selectedLanguages,
        policy: 'missing_only',
        source: 'point-csv'
      }, token);
    },
    onSuccess: async () => {
      setBatchCreated(true);
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['generation-batches', token] });
    },
    onError: (cause) => handleImportError(cause, onAuthExpired, setError)
  });
  const hasBlockingErrors = preview.some((row) => row.errors.length > 0);

  function updateFile(nextFile?: File) {
    setFile(nextFile ?? null);
    setPreview([]);
    setResult(null);
    setBatchCreated(false);
    setError('');
  }

  function toggleLanguage(code: string) {
    setSelectedLanguages((current) => (
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    ));
  }

  return (
    <section className="import-panel">
      <div className="import-heading">
        <div>
          <span>Cadastro CSV</span>
          <h3>Criar ou atualizar pontos</h3>
        </div>
        <p>Informe tipo, nome e coordenadas ou endereço. Campos vazios preservam dados existentes.</p>
      </div>
      <div className="import-actions">
        <label>
          Arquivo CSV
          <input accept=".csv,text/csv" type="file" onChange={(event) => updateFile(event.target.files?.[0])} />
        </label>
        <button type="button" className="secondary-action" disabled={!file || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
          {previewMutation.isPending ? 'A validar...' : 'Gerar preview'}
        </button>
        <button
          type="button"
          disabled={!file || !preview.length || hasBlockingErrors || confirmMutation.isPending}
          onClick={() => confirmMutation.mutate()}
        >
          {confirmMutation.isPending ? 'A importar...' : 'Confirmar importação'}
        </button>
      </div>
      {error ? <p className="import-error">{error}</p> : null}
      {result ? (
        <div className="point-import-result">
          <p className="import-summary">
            Cadastro concluído: {result.created} criados e {result.updated} atualizados.
          </p>
          {result.imported_point_ids.length ? (
            <fieldset className="batch-language-picker">
              <legend>Gerar traduções por IA para</legend>
              {targetLanguages.map((language) => (
                <label key={language.code}>
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(language.code)}
                    onChange={() => toggleLanguage(language.code)}
                  />
                  {language.name}
                </label>
              ))}
              <button
                type="button"
                disabled={!selectedLanguages.length || batchMutation.isPending || batchCreated}
                onClick={() => batchMutation.mutate()}
              >
                {batchCreated ? 'Lote criado' : batchMutation.isPending ? 'A criar lote...' : 'Gerar traduções'}
              </button>
              <small>As traduções geradas ficarão pendentes de revisão.</small>
            </fieldset>
          ) : null}
        </div>
      ) : null}
      {preview.length ? <PointCatalogPreviewTable rows={preview} /> : null}
    </section>
  );
}

function PointCatalogPreviewTable({ rows }: { rows: PointCatalogPreviewRow[] }) {
  return (
    <div className="table-wrap import-preview">
      <table>
        <thead>
          <tr><th>Linha</th><th>Tipo</th><th>Ponto</th><th>Coordenadas</th><th>Ação</th><th>Erros</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.row_number}-${row.point_name}`}>
              <td>{row.row_number}</td>
              <td>{row.point_type || '-'}</td>
              <td>{row.point_name || '-'}</td>
              <td>{row.lat != null && row.lng != null ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}` : '-'}</td>
              <td><span className={`status-pill ${row.action}`}>{importActionLabel(row.action)}</span></td>
              <td>{row.errors.length ? row.errors.join('; ') : row.geocoded ? 'Geocodificado' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function handleImportError(
  cause: unknown,
  onAuthExpired: () => void,
  setError: (message: string) => void
) {
  if (isAuthError(cause)) {
    onAuthExpired();
    return;
  }
  setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
}

function CsvImportPanel({
  token,
  onAuthExpired,
  onImported,
  onGenerate
}: {
  token: string;
  onAuthExpired: () => void;
  onImported: () => void;
  onGenerate?: (textIds: string[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um CSV antes de gerar o preview.');
      return postCsv<ImportPreviewRow[]>('/api/v1/admin/points/import/preview', file, token);
    },
    onSuccess: (rows) => {
      setPreview(rows);
      setResult(null);
      setError('');
    },
    onError: (cause) => {
      if (isAuthError(cause)) {
        onAuthExpired();
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o preview.');
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um CSV antes de confirmar.');
      return postCsv<ImportResult>('/api/v1/admin/points/import/confirm', file, token);
    },
    onSuccess: (nextResult) => {
      setResult(nextResult);
      setPreview((current) => (nextResult.errors.length > 0 ? nextResult.errors : current));
      setError('');
      onImported();
    },
    onError: (cause) => {
      if (isAuthError(cause)) {
        onAuthExpired();
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar a importação.');
    }
  });

  const hasBlockingErrors = preview.some((row) => row.errors.length > 0);
  const canConfirm = Boolean(file && preview.length > 0 && !hasBlockingErrors && !confirmMutation.isPending);

  function updateFile(nextFile?: File) {
    setFile(nextFile ?? null);
    setPreview([]);
    setResult(null);
    setError('');
  }

  return (
    <section className="import-panel">
      <div className="import-heading">
        <div>
          <span>Importação CSV</span>
          <h3>Adicionar pontos em lote</h3>
        </div>
        <p>Colunas obrigatórias: point_name, address, neighborhood, city, country, lat_override, lng_override, author_name, content_pt, content_type, source_work, source_year.</p>
      </div>

      <div className="import-actions">
        <label>
          Arquivo CSV
          <input accept=".csv,text/csv" type="file" onChange={(event) => updateFile(event.target.files?.[0])} />
        </label>
        <button type="button" className="secondary-action" disabled={!file || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
          {previewMutation.isPending ? 'A validar...' : 'Gerar preview'}
        </button>
        <button type="button" disabled={!canConfirm} onClick={() => confirmMutation.mutate()}>
          {confirmMutation.isPending ? 'A importar...' : 'Confirmar importação'}
        </button>
      </div>

      {error ? <p className="import-error">{error}</p> : null}
      {result ? (
        <div className="import-complete-row">
          <p className="import-summary">
            Importação concluída: {result.created} criados, {result.updated} atualizados
            {result.errors.length > 0 ? `, ${result.errors.length} linhas ignoradas` : ''}.
          </p>
          {result.imported_text_ids.length > 0 && onGenerate ? (
            <button type="button" onClick={() => onGenerate(result.imported_text_ids)}>
              Gerar traduções e áudios
            </button>
          ) : null}
        </div>
      ) : null}

      {preview.length > 0 ? <ImportPreviewTable rows={preview} /> : null}
    </section>
  );
}

function ImportPreviewTable({ rows }: { rows: ImportPreviewRow[] }) {
  return (
    <div className="table-wrap import-preview">
      <table>
        <thead>
          <tr>
            <th>Linha</th>
            <th>Autor</th>
            <th>Ponto</th>
            <th>Ação</th>
            <th>Erros</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.row_number}-${row.title}`}>
              <td>{row.row_number}</td>
              <td>{row.author_name || '-'}</td>
              <td>{row.title || '-'}</td>
              <td>
                <span className={`status-pill ${row.action}`}>{importActionLabel(row.action)}</span>
              </td>
              <td>{row.errors.length > 0 ? row.errors.join('; ') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function importActionLabel(action: ImportPreviewRow['action']) {
  if (action === 'create') return 'Criar';
  if (action === 'update') return 'Atualizar';
  return 'Corrigir';
}
