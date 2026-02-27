'use client';

import { motion } from 'framer-motion';

const collections = [
  {
    name: 'Chlo.co.uk',
    tag: 'Now',
    tagStyle: { backgroundColor: '#E7D8C6', color: '#3B2F2A' },
    description:
      'The flagship home of the Chlo brand — a curated digital destination bringing together thoughtfully designed products and experiences.',
    href: 'https://chlo.co.uk',
    delay: 0,
  },
  {
    name: 'New Collection',
    tag: 'Soon',
    tagStyle: { backgroundColor: '#F7F1E7', color: '#6E5B52', border: '1px solid #E7D8C6' },
    description:
      "We're cultivating something new. A carefully considered addition to the Chlo family, coming soon.",
    href: null,
    delay: 0.15,
  },
  {
    name: 'New Collection',
    tag: 'Soon',
    tagStyle: { backgroundColor: '#F7F1E7', color: '#6E5B52', border: '1px solid #E7D8C6' },
    description:
      'Another thoughtful addition in development — crafted with the same care and intention as everything we do.',
    href: null,
    delay: 0.3,
  },
];

export default function Collections() {
  return (
    <section
      id="collections"
      className="py-28 px-6"
      style={{ backgroundColor: '#F7F1E7' }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-chlo-muted mb-4">Portfolio</p>
          <h2
            className="text-4xl md:text-5xl font-bold text-chlo-brown leading-tight"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Collections
          </h2>
          <p className="text-base text-chlo-muted mt-6 leading-relaxed">
            A growing family of brands, each built with purpose.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {collections.map((item, i) => (
            <motion.div
              key={i}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: item.delay }}
              whileHover={{ y: -3, transition: { duration: 0.25 } }}
              className="rounded-2xl p-8 flex flex-col transition-shadow duration-300 hover:shadow-md"
              style={{
                backgroundColor: '#FFFCF7',
                border: '1px solid #E7D8C6',
              }}
            >
              <span
                className="inline-block self-start text-xs px-3 py-1 rounded-full font-medium tracking-wide"
                style={item.tagStyle}
              >
                {item.tag}
              </span>
              <h3
                className="text-xl font-semibold text-chlo-brown mt-5"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                {item.name}
              </h3>
              <p className="text-sm text-chlo-muted mt-3 leading-relaxed flex-1">
                {item.description}
              </p>
              {item.href && (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 text-sm text-chlo-tan hover:text-chlo-brown transition-colors duration-200"
                >
                  Visit →
                </a>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
