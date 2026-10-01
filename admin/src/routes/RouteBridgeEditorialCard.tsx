import type { AdminRouteSegment } from '@ecosdelisboa/shared';
import type { RefObject } from 'react';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { adminFailureMessage } from '../adminErrorMessages';

type MutationState = { isPending: boolean; isError: boolean; error: unknown };
type RecoveryState = {
  candidate: { savedAt: number } | null;
  baseChanged: boolean;
  restore: () => void;
  clear: () => void;
  warning: string;
  notice: string;
};
const BRIDGE_UPLOAD_FAILURE = 'Falha no upload do áudio da ponte. O áudio anterior foi preservado. Selecione o ficheiro novamente para tentar.';

export function RouteBridgeEditorialCard({ selectedSegment, selectedId, remoteBridge, bridgeReady, bridgeBlocked, bridgeEnglish, bridgeInput, bridgeRecovery, bridgeUploadMutation, bridgeTranslationMutation, audioPending, canUseServerTools, busy, onEnglish, onReview, onGenerate, onUpload }: {
  selectedSegment: AdminRouteSegment;
  selectedId?: string;
  remoteBridge: boolean;
  bridgeReady: boolean;
  bridgeBlocked: boolean;
  bridgeEnglish: string;
  bridgeInput: RefObject<HTMLTextAreaElement | null>;
  bridgeRecovery: RecoveryState;
  bridgeUploadMutation: MutationState & { isSuccess: boolean; variables?: { routeId: string; segmentId: string; lang: 'pt' | 'en' } };
  bridgeTranslationMutation: MutationState;
  audioPending: boolean;
  canUseServerTools: boolean;
  busy: boolean;
  onEnglish: (value: string) => void;
  onReview: () => void;
  onGenerate: (lang: 'pt' | 'en') => void;
  onUpload: (lang: 'pt' | 'en', file?: File) => void;
}) {
  return (
    <section className="route-bridge-editorial-card">
      <div className="spatial-heading">
        <div>
          <span className="eyebrow">Ponte selecionada</span>
          <h3>EN e áudio curatorial</h3>
        </div>
      </div>
      {bridgeUploadMutation.variables && bridgeUploadMutation.variables.segmentId === selectedSegment.id && bridgeUploadMutation.variables.routeId === selectedId ? <>
        {bridgeUploadMutation.isPending ? <p role="status">A enviar MP3 {bridgeUploadMutation.variables.lang.toUpperCase()}… Aguarde a confirmação antes de sair.</p> : null}
        {bridgeUploadMutation.isError ? <p role="alert" className="form-error">{adminFailureMessage(bridgeUploadMutation.error, BRIDGE_UPLOAD_FAILURE)}</p> : null}
        {bridgeUploadMutation.isSuccess ? <p role="status">Áudio manual {bridgeUploadMutation.variables.lang.toUpperCase()} guardado e protegido.</p> : null}
      </> : null}
      <LocalDraftRecovery contextLabel="Ponte EN selecionada" savedAt={bridgeRecovery.candidate?.savedAt}
        baseChanged={bridgeRecovery.baseChanged} onRestore={bridgeRecovery.restore}
        onDiscard={() => { bridgeRecovery.clear(); requestAnimationFrame(() => bridgeInput.current?.focus()); }}
        warning={bridgeRecovery.warning} notice={bridgeRecovery.notice} />
      {!remoteBridge ? <p>Guarde primeiro a narrativa para criar esta etapa no servidor e editar a sua versão EN.</p> : null}
      <label>
        Texto em inglês
        <textarea
          ref={bridgeInput}
          value={bridgeEnglish}
          disabled={!bridgeReady || bridgeBlocked || bridgeTranslationMutation.isPending}
          onChange={event => onEnglish(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary-action"
        disabled={!canUseServerTools || !bridgeReady || bridgeBlocked || !selectedSegment.id || !bridgeEnglish.trim() || bridgeTranslationMutation.isPending}
        onClick={() => { onReview(); }}
      >
        Rever e guardar EN
      </button>
      {bridgeTranslationMutation.isError ? <p role="alert" className="form-error">{adminFailureMessage(bridgeTranslationMutation.error, 'Não foi possível guardar a ponte EN. O rascunho foi preservado.')}</p> : null}
      {(['pt', 'en'] as const).map((lang) => {
        const audio = selectedSegment.audio_files?.find((item) => item.lang === lang);
        return (
          <div className="bridge-audio-row" key={lang}>
            <div>
              <strong>{lang.toUpperCase()}</strong>
              <span>{audio?.public_url ? (audio.manually_uploaded ? 'manual protegido' : 'gerado') : 'em falta'}</span>
            </div>
            <button
              type="button"
              className="secondary-action"
              disabled={!canUseServerTools || audioPending}
              onClick={() => { onGenerate(lang); }}
            >
              Gerar
            </button>
            <label className="bridge-upload-action">
              MP3
              <input
                type="file"
                accept="audio/mpeg,.mp3"
                aria-label={`Enviar MP3 ${lang.toUpperCase()} da ponte selecionada`}
                disabled={!canUseServerTools || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  onUpload(lang, file);
                }}
              />
            </label>
          </div>
                  );
                })}
              </section>
  );
}
