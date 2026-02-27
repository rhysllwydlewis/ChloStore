'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContact } from '@/components/ContactWidget';

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Collections', href: '#collections' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { openContact } = useContact();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContactClick = () => {
    setMenuOpen(false);
    openContact();
  };

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7 }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5 transition-all duration-500 ${
          scrolled || menuOpen ? 'shadow-sm' : ''
        }`}
        aria-label="Site navigation"
        style={
          scrolled || menuOpen
            ? {
                backgroundColor: 'rgba(255,252,247,0.95)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #E7D8C6',
              }
            : {}
        }
      >
        <a
          href="#"
          className="text-xl font-bold tracking-[0.15em] text-chlo-brown"
          style={{ fontFamily: 'var(--font-playfair)' }}
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Chlo
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-sm text-chlo-muted hover:text-chlo-brown transition-colors duration-200 tracking-wide"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={handleContactClick}
            className="text-sm text-chlo-brown border border-chlo-brown rounded-full px-5 py-2 hover:bg-chlo-brown hover:text-chlo-surface transition-all duration-200 tracking-wide"
          >
            Contact
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex flex-col gap-1.5 p-1 text-chlo-brown"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <motion.span
            animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-0.5 bg-current"
          />
          <motion.span
            animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-0.5 bg-current"
          />
          <motion.span
            animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-0.5 bg-current"
          />
        </button>
      </motion.nav>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed top-[73px] left-0 right-0 z-40 md:hidden overflow-hidden"
            style={{
              backgroundColor: 'rgba(255,252,247,0.97)',
              borderBottom: '1px solid #E7D8C6',
            }}
          >
            <div className="flex flex-col px-6 py-4 gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-base text-chlo-muted hover:text-chlo-brown transition-colors duration-200 py-2 border-b border-chlo-beige last:border-0"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={handleContactClick}
                className="text-base text-chlo-brown font-medium py-2 text-left"
              >
                Contact
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
