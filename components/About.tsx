'use client';

import { motion } from 'framer-motion';

const cards = [
  {
    label: 'Clean Formulas',
    description:
      'Every Chlo product is crafted with thoughtfully sourced ingredients. We believe great beauty starts with what you put on your skin — so we keep it clean, effective, and kind.',
    delay: 0,
  },
  {
    label: 'Effortless Glam',
    description:
      "Our products are designed to simplify your routine without compromising on results. Whether it's a bare-skin day or a full glam night, Chlo is with you every step.",
    delay: 0.15,
  },
  {
    label: 'Cruelty Free',
    description:
      'Beauty should never come at a cost to others. All Chlo products are 100% cruelty free — no animal testing, ever. Ethical beauty is the only beauty we believe in.',
    delay: 0.3,
  },
];

export default function About() {
  return (
    <section
      id="about"
      className="py-28 px-6"
      style={{ backgroundColor: '#FFFCF7' }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-chlo-muted mb-4">Our Story</p>
          <h2
            className="text-4xl md:text-5xl font-bold text-chlo-brown leading-tight"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Beauty with purpose.
          </h2>
          <p className="text-base text-chlo-muted mt-6 leading-relaxed">
            Chlo Beauty is a luxury cosmetics brand built on a simple belief: that
            feeling beautiful should be effortless. We create clean, high-performance
            formulas designed for real life — from everyday essentials to standout
            glam. Every product is a small act of confidence.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {cards.map((card) => (
            <motion.div
              key={card.label}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, delay: card.delay }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="rounded-xl p-8 cursor-default transition-shadow duration-300 hover:shadow-md"
              style={{
                backgroundColor: '#FFFCF7',
                border: '1px solid #E7D8C6',
              }}
            >
              <p
                className="text-2xl font-semibold text-chlo-brown"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                {card.label}
              </p>
              <p className="text-sm text-chlo-muted mt-4 leading-relaxed">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
