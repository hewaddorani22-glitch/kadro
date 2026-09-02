import { LegalDocument } from '@/components/LegalDocument';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function PrivacyScreen() {
  const { legal } = useLanguage();
  return <LegalDocument document={legal.privacy} version={legal.version} />;
}
