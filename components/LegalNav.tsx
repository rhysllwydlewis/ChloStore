'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useContact } from '@/components/ContactWidget';

export default function LegalNav() {
  const { openContact } = useContact();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5"
      aria-label="Site navigation"
      style={{
        backgroundColor: 'rgba(255,252,247,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E7D8C6',
      }}
    >
      <Link
        href="/"
        className="text-xl font-bold tracking-[0.15em] text-chlo-brown"
        style={{ fontFamily: 'var(--font-playfair)' }}
      >
        Chlo
      </Link>

      <button
        type="button"
        onClick={openContact}
        className="text-sm text-chlo-brown border border-chlo-brown rounded-full px-5 py-2 hover:bg-chlo-brown hover:text-chlo-surface transition-all duration-200 tracking-wide"
      >
        Contact
      </button>
    </motion.nav>
  );
}
