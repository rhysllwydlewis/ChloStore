'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

type Category = 'All' | 'Foundations' | 'Lashes' | 'Lip' | 'Accessories';

interface Product {
  name: string;
  category: Exclude<Category, 'All'>;
  description: string;
  price: string;
  emoji: string;
  gradient: string;
}

const products: Product[] = [
  {
    name: 'Chlo Silk Veil Foundation',
    category: 'Foundations',
    description: 'Weightless, buildable coverage with a luminous satin finish.',
    price: '£34.00',
    emoji: '✨',
    gradient: 'from-chlo-beige to-chlo-tan',
  },
  {
    name: 'Chlo Skin Tint',
    category: 'Foundations',
    description: 'Sheer coverage with SPF 30. Your skin, but better.',
    price: '£28.00',
    emoji: '🌿',
    gradient: 'from-chlo-cream to-chlo-beige',
  },
  {
    name: 'Chlo Matte Luxe Foundation',
    category: 'Foundations',
    description: 'Full coverage, flawless matte finish that lasts all day.',
    price: '£36.00',
    emoji: '💎',
    gradient: 'from-chlo-tan to-chlo-beige',
  },
  {
    name: 'Chlo Natural Wisp Lashes',
    category: 'Lashes',
    description: 'Everyday elegance. Lightweight and barely-there.',
    price: '£12.00',
    emoji: '🌸',
    gradient: 'from-chlo-surface to-chlo-cream',
  },
  {
    name: 'Chlo Drama Queen Lashes',
    category: 'Lashes',
    description: 'Full volume, full glam. For nights that matter.',
    price: '£16.00',
    emoji: '💫',
    gradient: 'from-chlo-tan to-chlo-beige',
  },
  {
    name: 'Chlo Magnetic Lash Kit',
    category: 'Lashes',
    description: 'Effortless application with our signature magnetic system.',
    price: '£24.00',
    emoji: '🪄',
    gradient: 'from-chlo-cream to-chlo-tan',
  },
  {
    name: 'Chlo Velvet Lip Stain',
    category: 'Lip',
    description: 'Long-lasting colour with a velvet-soft finish.',
    price: '£18.00',
    emoji: '💄',
    gradient: 'from-chlo-beige to-chlo-tan',
  },
  {
    name: 'Chlo Glass Lip Gloss',
    category: 'Lip',
    description: 'High-shine, non-sticky gloss for the perfect pout.',
    price: '£14.00',
    emoji: '✨',
    gradient: 'from-chlo-beige to-chlo-tan',
  },
  {
    name: 'Chlo Beauty Blender Duo',
    category: 'Accessories',
    description: 'Flawless blending for a seamless finish.',
    price: '£10.00',
    emoji: '🫧',
    gradient: 'from-chlo-cream to-chlo-beige',
  },
  {
    name: 'Chlo Lash Applicator',
    category: 'Accessories',
    description: 'Precision tool for effortless lash application.',
    price: '£8.00',
    emoji: '🔍',
    gradient: 'from-chlo-surface to-chlo-cream',
  },
];

const categories: Category[] = ['All', 'Foundations', 'Lashes', 'Lip', 'Accessories'];

export default function Store() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const filtered =
    activeCategory === 'All'
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <section id="shop" className="py-28 px-6" style={{ backgroundColor: '#F7F1E7' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-chlo-muted mb-4">Store</p>
          <h2
            className="text-4xl md:text-5xl font-bold text-chlo-brown leading-tight"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Shop
          </h2>
          <p className="text-base text-chlo-muted mt-6 leading-relaxed">
            Discover our curated collection of luxury beauty essentials — each one crafted
            to bring effortless elegance to your everyday routine.
          </p>
        </motion.div>

        {/* Category filter pills */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="flex flex-wrap gap-2 mt-10"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chlo-brown ${
                activeCategory === cat
                  ? 'text-chlo-surface'
                  : 'text-chlo-muted hover:text-chlo-brown hover:border-chlo-brown border border-chlo-beige'
              }`}
              style={
                activeCategory === cat
                  ? { backgroundColor: '#3B2F2A' }
                  : { backgroundColor: '#FFFCF7' }
              }
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-10">
          {filtered.map((product, i) => (
            <motion.div
              key={product.name}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.08, 0.4) }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="rounded-2xl overflow-hidden flex flex-col cursor-default transition-shadow duration-300 hover:shadow-md"
              style={{ backgroundColor: '#FFFCF7', border: '1px solid #E7D8C6' }}
            >
              {/* Product image placeholder */}
              <div
                className={`h-44 flex items-center justify-center bg-gradient-to-br ${product.gradient}`}
              >
                <span className="text-5xl select-none">{product.emoji}</span>
              </div>

              {/* Product info */}
              <div className="flex flex-col flex-1 p-5">
                <span
                  className="self-start text-xs px-3 py-1 rounded-full font-medium tracking-wide mb-3"
                  style={{ backgroundColor: '#E7D8C6', color: '#3B2F2A' }}
                >
                  {product.category}
                </span>
                <h3
                  className="text-base font-semibold text-chlo-brown leading-snug"
                  style={{ fontFamily: 'var(--font-playfair)' }}
                >
                  {product.name}
                </h3>
                <p className="text-xs text-chlo-muted mt-2 leading-relaxed flex-1">
                  {product.description}
                </p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-base font-semibold text-chlo-brown">
                    {product.price}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium tracking-wide px-4 py-2 rounded-full transition-all duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chlo-brown"
                    style={{ backgroundColor: '#3B2F2A', color: '#FFFCF7' }}
                  >
                    Add to Bag
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
