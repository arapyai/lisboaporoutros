export function LocalDraftRecovery({ savedAt, baseChanged, onRestore, onDiscard, warning, notice, contextLabel }: {
  savedAt?: number; baseChanged: boolean; onRestore: () => void; onDiscard: () => void;
  warning: string; notice: string;
  contextLabel?: string;
}) {
  return <>
    {savedAt ? <section className="admin-state" role="alert" aria-label={contextLabel ? `Recuperação de rascunho: ${contextLabel}` : 'Recuperação de rascunho'}>
      {contextLabel ? <h4>{contextLabel}</h4> : null}
      <p>Há um rascunho local desta conta neste navegador, de {new Date(savedAt).toLocaleString('pt-PT')}.
        Não foi guardado no servidor. Cópias locais expiram após sete dias e são apagadas ao sair da conta.</p>
      {baseChanged ? <p>A base no servidor mudou desde esta edição. Restaurar repõe os campos do rascunho;
        reveja as diferenças antes de guardar. Não há fusão automática nem bloqueio de edições de outra pessoa.</p> : null}
      <div className="form-actions">
        <button type="button" onClick={onRestore}>{baseChanged ? 'Restaurar mesmo assim' : 'Restaurar rascunho'}</button>
        <button type="button" className="secondary-action" onClick={onDiscard}>Descartar rascunho local</button>
      </div>
    </section> : null}
    {warning ? <p role="alert" className="form-error">{warning}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </>;
}
