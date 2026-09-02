import { LegalDocument } from '@/components/LegalDocument';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function TermsScreen() {
  const { legal } = useLanguage();
  return <LegalDocument document={legal.terms} version={legal.version} />;
}
