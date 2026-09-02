import { LegalDocument } from '@/components/LegalDocument';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function SourcesScreen() {
  const { legal } = useLanguage();
  return <LegalDocument document={legal.sources} version={legal.version} />;
}
