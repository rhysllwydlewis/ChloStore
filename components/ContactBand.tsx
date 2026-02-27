'use client';

import { motion } from 'framer-motion';
import { useContact } from '@/components/ContactWidget';

export default function ContactBand() {
  const { openContact } = useContact();

  return (
    <section
      className="py-24 px-6"
      style={{ backgroundColor: '#E7D8C6' }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8 }}
        >
          <h2
            className="text-3xl md:text-4xl font-bold text-chlo-brown"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Interested in partnering with Chlo?
          </h2>
          <p className="text-chlo-muted mt-4 max-w-xl mx-auto leading-relaxed">
            Whether you have a brand concept, a product, or simply an idea —
            we&apos;d love to hear from you.
          </p>
          <button
            type="button"
            onClick={openContact}
            className="mt-10 px-10 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chlo-brown focus-visible:ring-offset-2"
            style={{ backgroundColor: '#3B2F2A', color: '#FFFCF7' }}
          >
            Contact
          </button>
        </motion.div>
      </div>
    </section>
  );
}
