import type { AdminLanguage, AdminVoice, ContentGenerationBatch, GenerationPolicy } from '@ecosdelisboa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { client } from '../adminConfig';
import { redirectIfAuthError } from '../adminApi';
import { confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { EditorDrawer } from '../components/EditorDrawer';

export function BulkGenerationDrawer({ token, textIds, languages, voices, batchSource, onClose, onCreated, onAuthExpired }: {
  token: string;
  textIds: string[];
  languages: AdminLanguage[];
  voices: AdminVoice[];
  batchSource: 'texts' | 'csv';
  onClose: () => void;
  onCreated: () => void;
  onAuthExpired: () => void;
}) {
  const queryClient = useQueryClient();
  const sourceLanguage = languages.find((item) => item.is_source)?.code ?? 'pt';
  const initial = languages.some((item) => item.code === 'en' && !item.is_source) ? ['en'] : languages.filter((item) => !item.is_source).slice(0, 1).map((item) => item.code);
  const [enabledLanguages, setEnabledLanguages] = useState<Set<string>>(() => new Set([sourceLanguage, ...initial]));
  const [policy, setPolicy] = useState<GenerationPolicy>('missing_only');
  const [voiceOverrides, setVoiceOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const generationLanguages = useMemo(
    () => [...languages].sort((first, second) => Number(second.is_source) - Number(first.is_source)),
    [languages]
  );
  const targetLanguages = generationLanguages.filter((language) => !language.is_source && enabledLanguages.has(language.code));
  const compatibleVoices = (language: string) => voices.filter((voice) => {
    const voiceLanguages = voice.languages?.length ? voice.languages : voice.lang ? [voice.lang] : [];
    return !voiceLanguages.length || voiceLanguages.includes(language as AdminLanguage['code']);
  });
  const defaultVoice = (language: string) => {
    const compatible = compatibleVoices(language);
    return compatible.find((voice) => voice.is_default) ?? compatible[0];
  };
  const selectedVoiceId = (language: string) => voiceOverrides[language] ?? defaultVoice(language)?.elevenlabs_id ?? '';
  const selectedVoice = (language: string) => voices.find((voice) => voice.elevenlabs_id === selectedVoiceId(language));
  const mutation = useMutation({
    mutationFn: () => client.post<ContentGenerationBatch>('/api/v1/admin/automation/batches', {
      text_ids: textIds,
      target_languages: targetLanguages.map((language) => language.code),
      audio_languages: targetLanguages.map((language) => language.code),
      generate_source_audio: enabledLanguages.has(sourceLanguage),
      generate_translated_audio: targetLanguages.length > 0,
      auto_approve_translations: false,
      voice_overrides: Object.fromEntries(generationLanguages.flatMap((language) => {
        if (!enabledLanguages.has(language.code)) return [];
        const voiceId = selectedVoiceId(language.code);
        return voiceId ? [[language.code, voiceId]] : [];
      })),
      policy,
      source: batchSource
    }, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['generation-batches', token] });
      onCreated();
    },
    onError: (cause) => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a geração.');
    }
  });
  useUnsavedChanges(false, mutation.isPending);
  const closeDrawer = () => { if (confirmAdminNavigation()) onClose(); };
  return <EditorDrawer className="bulk-drawer" label="Gerar conteúdo em lote" onClose={closeDrawer}>
    <header className="text-editor-header"><div><h3>Gerar conteúdo</h3><span>{textIds.length} texto{textIds.length === 1 ? '' : 's'} selecionado{textIds.length === 1 ? '' : 's'}</span></div><button type="button" className="close-editor" aria-label="Fechar" onClick={closeDrawer}>×</button></header>
    <fieldset className="bulk-drawer-body language-editing-fields" disabled={mutation.isPending} aria-busy={mutation.isPending}>
      <section><h4>Idiomas e vozes</h4>
        <p>Marque os idiomas que deseja gerar e escolha a voz de cada um.</p>
        <p className="batch-review-policy">As traduções geradas ficam pendentes de revisão. Depois de aprová-las, inicie o áudio traduzido no painel do lote.</p>
        <div className="batch-voice-grid" aria-label="Geração e voz por idioma">
          {generationLanguages.map((language) => {
            const enabled = enabledLanguages.has(language.code);
            const availableVoices = compatibleVoices(language.code);
            const voice = selectedVoice(language.code);
            const voiceLanguages = voice?.languages?.length ? voice.languages : voice?.lang ? [voice.lang] : [];
            return <div className={`batch-voice-row${enabled ? ' enabled' : ''}`} key={language.code}>
              <label className="batch-language-toggle">
                <input type="checkbox" checked={enabled} onChange={() => setEnabledLanguages((current) => { const next = new Set(current); if (next.has(language.code)) next.delete(language.code); else next.add(language.code); return next; })} />
                <span><strong>{language.code.toUpperCase()} · {language.name}</strong><small>{language.is_source ? 'Gerar áudio original' : 'Gerar tradução · áudio após revisão'}</small></span>
              </label>
              <label className="batch-voice-select">
                <span>Voz</span>
                <select disabled={!enabled} value={selectedVoiceId(language.code)} onChange={(event) => setVoiceOverrides((current) => ({ ...current, [language.code]: event.target.value }))}>
                  {!availableVoices.length ? <option value="">Automática (regra do texto)</option> : null}
                  {availableVoices.map((item) => <option key={item.id} value={item.elevenlabs_id}>{item.name}{item.is_default ? ' · padrão' : ''}</option>)}
                </select>
              </label>
              <span className="voice-language-meta">{voiceLanguages.length ? `Idioma${voiceLanguages.length === 1 ? '' : 's'} da voz: ${voiceLanguages.map((code) => code.toUpperCase()).join(', ')}` : 'Voz sem restrição de idioma'}</span>
            </div>;
          })}
        </div>
      </section>
      <details className="advanced-disclosure"><summary>Opções avançadas</summary><label className="bulk-check"><input type="checkbox" checked={policy === 'replace_automatic'} onChange={(event) => setPolicy(event.target.checked ? 'replace_automatic' : 'missing_only')} />Regenerar conteúdo criado por IA</label><p>Conteúdo revisto manualmente e áudio enviado manualmente nunca serão substituídos.</p></details>
      {error ? <p className="form-error bulk-error" role="alert">{error}</p> : null}
    </fieldset>
    <footer className="text-editor-footer"><span /><div><button type="button" className="secondary-action" onClick={closeDrawer}>Cancelar</button><button type="button" disabled={mutation.isPending || !enabledLanguages.size} onClick={() => { setError(''); mutation.mutate(); }}>{mutation.isPending ? 'A iniciar…' : 'Iniciar geração'}</button></div></footer>
  </EditorDrawer>;
}
