'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ContactProvider } from '@/components/ContactWidget';
import LegalNav from '@/components/LegalNav';
import Footer from '@/components/Footer';

const cards = [
  {
    href: '/privacy',
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal information.',
    delay: 0.5,
  },
  {
    href: '/terms',
    title: 'Terms of Use',
    description: 'The terms and conditions that apply when you use this site.',
    delay: 0.65,
  },
];

export default function LegalHubContent() {
  return (
    <ContactProvider>
      <LegalNav />

      <main
        className="min-h-screen pt-36 pb-24 px-6"
        style={{ backgroundColor: '#FFFCF7' }}
      >
        <div className="max-w-2xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xs uppercase tracking-[0.3em] text-chlo-muted mb-6"
          >
            Legal
          </motion.p>

          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold text-chlo-brown mb-5"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Legal Hub
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-chlo-muted leading-relaxed mb-14"
          >
            This page brings together the legal documents that govern your use of Chlo. We&apos;re
            committed to being transparent about how we operate and handle your information.
          </motion.p>

          <div className="flex flex-col gap-5 mb-14">
            {cards.map((card) => (
              <motion.div
                key={card.href}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: card.delay }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
              >
                <Link
                  href={card.href}
                  className="group block p-7 rounded-xl border transition-shadow duration-300 hover:shadow-md"
                  style={{ borderColor: '#E7D8C6', backgroundColor: '#F7F1E7' }}
                >
                  <p
                    className="text-lg font-semibold mb-2"
                    style={{ color: '#3B2F2A', fontFamily: 'var(--font-playfair)' }}
                  >
                    {card.title}
                    <span className="ml-2 opacity-50 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true">→</span>
                  </p>
                  <p className="text-sm text-chlo-muted">{card.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="p-7 rounded-xl border mb-10"
            style={{ borderColor: '#E7D8C6', backgroundColor: '#F7F1E7' }}
          >
            <h2
              className="text-base font-semibold mb-2"
              style={{ color: '#3B2F2A', fontFamily: 'var(--font-playfair)' }}
            >
              Cookies
            </h2>
            <p className="text-sm text-chlo-muted leading-relaxed">
              This site uses only essential cookies required for basic functionality. We do not use
              tracking or advertising cookies. No cookie consent banner is needed as we do not set
              non-essential cookies.
            </p>
          </motion.section>

          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.9 }}
          >
            <h2
              className="text-base font-semibold mb-2"
              style={{ color: '#3B2F2A', fontFamily: 'var(--font-playfair)' }}
            >
              Questions?
            </h2>
            <p className="text-sm text-chlo-muted leading-relaxed">
              If you have any questions about these documents or how we handle your data, please{' '}
              <a
                href="mailto:hello@chlo.co.uk"
                className="underline hover:text-chlo-brown transition-colors duration-200"
              >
                get in touch
              </a>
              .
            </p>
          </motion.section>
        </div>
      </main>

      <Footer />
    </ContactProvider>
  );
}
