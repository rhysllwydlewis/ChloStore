'use client';

import { motion } from 'framer-motion';

const cards = [
  {
    label: 'Craft',
    description:
      'Every brand within Chlo is built with intention. We believe that thoughtful design and careful execution are the foundations of lasting value.',
    delay: 0,
  },
  {
    label: 'Care',
    description:
      'We take a hands-on approach to every collection, ensuring each product and experience meets the standard our customers expect and deserve.',
    delay: 0.15,
  },
  {
    label: 'Continuity',
    description:
      'Chlo is built for the long term. We cultivate brands that grow gracefully, creating enduring connections with the people who matter most.',
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
          <p className="text-xs uppercase tracking-[0.3em] text-chlo-muted mb-4">About</p>
          <h2
            className="text-4xl md:text-5xl font-bold text-chlo-brown leading-tight"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            About Chlo
          </h2>
          <p className="text-base text-chlo-muted mt-6 leading-relaxed">
            Chlo is a home for modern brands — a curated group of digital and lifestyle
            experiences united by a commitment to quality, authenticity, and thoughtful
            design. We believe that the best brands are built slowly, with care.
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
