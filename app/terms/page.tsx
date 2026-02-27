import type { Metadata } from 'next';
import TermsContent from './TermsContent';

export const metadata: Metadata = {
  title: 'Terms of Use | Chlo',
  description:
    'Read the Terms of Use for Chlo. Understand the conditions that apply when you use this site, including intellectual property and governing law.',
};

export default function TermsPage() {
  return <TermsContent />;
}

