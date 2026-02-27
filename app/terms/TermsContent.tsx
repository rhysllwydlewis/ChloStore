'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ContactProvider } from '@/components/ContactWidget';
import LegalNav from '@/components/LegalNav';
import Footer from '@/components/Footer';

const sections = [
  {
    title: 'Who we are',
    content: (
      <>
        This site is operated by Chlo (sole trader trading as &apos;Chlo&apos;). By using this
        site, you agree to these terms.
      </>
    ),
  },
  {
    title: 'Use of this site',
    content:
      'This site is provided for informational purposes. You may browse and use the site for personal, non-commercial purposes. You must not misuse this site or attempt to gain unauthorised access to any part of it.',
  },
  {
    title: 'Intellectual property',
    content:
      'All content on this site, including text, images, and design, is owned by or licensed to Chlo. You may not reproduce or distribute any content without prior written permission.',
  },
  {
    title: 'Limitation of liability',
    content:
      'We make no warranties about the accuracy or completeness of the content on this site. To the fullest extent permitted by law, Chlo shall not be liable for any losses arising from your use of this site.',
  },
  {
    title: 'Changes to these terms',
    content:
      'We may update these terms from time to time. Continued use of the site after any changes constitutes acceptance of the new terms.',
  },
  {
    title: 'Governing law',
    content: 'These terms are governed by the laws of England and Wales.',
  },
  {
    title: 'Contact',
    content: (
      <>
        For any questions about these terms, please email us at{' '}
        <a
          href="mailto:hello@chlo.co.uk"
          className="underline hover:text-chlo-brown transition-colors duration-200"
        >
          hello@chlo.co.uk
        </a>
        .
      </>
    ),
  },
];

export default function TermsContent() {
  return (
    <ContactProvider>
      <LegalNav />

      <main
        className="min-h-screen pt-36 pb-24 px-6"
        style={{ backgroundColor: '#FFFCF7' }}
      >
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Link
              href="/legal"
              className="text-xs uppercase tracking-[0.3em] text-chlo-muted hover:text-chlo-brown transition-colors duration-200 mb-8 inline-flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Legal Hub
            </Link>
          </motion.div>

          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold text-chlo-brown mb-3 mt-6"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Terms of Use
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-sm text-chlo-muted mb-14"
          >
            Last updated: February 2026
          </motion.p>

          <div className="space-y-10">
            {sections.map((section, i) => (
              <motion.section
                key={section.title}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="pb-10 border-b last:border-b-0"
                style={{ borderColor: '#E7D8C6' }}
              >
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{ color: '#3B2F2A', fontFamily: 'var(--font-playfair)' }}
                >
                  {section.title}
                </h2>
                <p className="text-chlo-muted leading-relaxed">{section.content}</p>
              </motion.section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </ContactProvider>
  );
}
