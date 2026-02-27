import type { Metadata } from 'next';
import PrivacyContent from './PrivacyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy | Chlo',
  description:
    'Read the Privacy Policy for Chlo. Learn how we collect, use, and protect your personal information, and understand your data rights.',
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}

