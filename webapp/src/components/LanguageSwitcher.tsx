import { languages, t } from '../i18n/messages';
import { cityConfig } from '../config/city';
import type { Lang } from '../types';

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
  compact?: boolean;
}

export function LanguageSwitcher({ value, onChange, compact = false }: Props) {
  const availableLanguages = languages.filter((language) => cityConfig.supportedLanguages.includes(language.code));
  return (
    <div className={compact ? 'language-control compact' : 'language-control'}>
      <select className="language-select" aria-label={t(value, 'chooseLanguage')} value={value} onChange={(event) => onChange(event.target.value as Lang)}>
        {availableLanguages.map((language) => <option key={language.code} value={language.code}>{language.label} · {language.native}</option>)}
      </select>
      <div className={compact ? 'language-switcher compact' : 'language-switcher'} aria-label={t(value, 'chooseLanguage')}>
      {availableLanguages.map((language) => (
        <button
          key={language.code}
          className={value === language.code ? 'active' : ''}
          type="button"
          onClick={() => onChange(language.code)}
          title={language.native}
          aria-pressed={value === language.code}
        >
          {language.label}
        </button>
      ))}
      </div>
    </div>
  );
}
