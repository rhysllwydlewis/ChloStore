'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContactContextType {
  isOpen: boolean;
  openContact: () => void;
  closeContact: () => void;
}

const ContactContext = createContext<ContactContextType>({
  isOpen: false,
  openContact: () => {},
  closeContact: () => {},
});

export function useContact() {
  return useContext(ContactContext);
}

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

function ContactModal({ onClose }: { onClose: () => void }) {
  // Note: the backdrop/overlay is rendered by ContactProvider so it gets a
  // guaranteed top-level stacking context. This component renders only the
  // dialog panel itself.
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: 'General',
    message: '',
    website: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    // Lock body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => onClose(), 2500);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.subject) newErrors.subject = 'Subject is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'w-full bg-chlo-cream border rounded-lg px-4 py-3 text-chlo-brown placeholder:text-chlo-muted/60 focus:outline-none transition text-sm';
  const inputClass = `${inputBase} border-chlo-beige focus:border-chlo-tan focus:ring-1 focus:ring-chlo-tan/30`;
  const errorInputClass = `${inputBase} border-red-400/60 focus:border-red-400 focus:ring-1 focus:ring-red-300/30`;

  return (
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 180 }}
        className="max-w-lg w-full mx-4 rounded-2xl shadow-2xl p-8 relative"
        style={{
          backgroundColor: '#FFFCF7',
          border: '1px solid #E7D8C6',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={success ? 'contact-success-title' : 'contact-modal-title'}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-chlo-muted hover:text-chlo-brown transition"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15, delay: 0.1 }}
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: '#E7D8C6' }}
            >
              <svg
                className="w-8 h-8 text-chlo-brown"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <h3 className="text-xl font-semibold text-chlo-brown mb-2" id="contact-success-title" style={{ fontFamily: 'var(--font-playfair)' }}>
              Message Sent
            </h3>
            <p className="text-sm text-chlo-muted">
              {`We'll be in touch soon.`}
            </p>
          </motion.div>
        ) : (
          <>
            <div className="mb-6">
              <h2
                id="contact-modal-title"
                className="text-2xl font-semibold text-chlo-brown"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Get in Touch
              </h2>
              <p className="text-sm text-chlo-muted mt-2">
                {`We'd love to hear from you. Fill in the form and we'll get back to you.`}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Honeypot – hidden from real users, bots fill it in */}
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-chlo-muted uppercase tracking-wider mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    ref={firstInputRef}
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={errors.name ? errorInputClass : inputClass}
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-chlo-muted uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={errors.email ? errorInputClass : inputClass}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="subject" className="block text-xs font-medium text-chlo-muted uppercase tracking-wider mb-1.5">
                  Subject
                </label>
                <div className="relative">
                  <select
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className={`${errors.subject ? errorInputClass : inputClass} appearance-none pr-10`}
                  >
                    <option value="General">General</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Press">Press</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-chlo-muted">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
              </div>

              <div className="mb-6">
                <label htmlFor="message" className="block text-xs font-medium text-chlo-muted uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={4}
                  placeholder="Tell us about your enquiry..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className={`${errors.message ? errorInputClass : inputClass} resize-none`}
                />
                {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
              </div>

              {submitError && <p className="text-sm text-red-500 mb-4">{submitError}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-3 text-sm font-medium tracking-wide transition-all duration-200 disabled:opacity-60 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chlo-brown focus-visible:ring-offset-2 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#3B2F2A',
                  color: '#FFFCF7',
                }}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </button>
            </form>
          </>
        )}
      </motion.div>
  );
}

export function ContactProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openContact = useCallback(() => setIsOpen(true), []);
  const closeContact = useCallback(() => setIsOpen(false), []);

  return (
    <ContactContext.Provider value={{ isOpen, openContact, closeContact }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="contact-overlay"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
              backgroundColor: 'rgba(59,47,42,0.35)',
              backdropFilter: 'blur(4px)',
              isolation: 'isolate',
              willChange: 'opacity',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeContact}
          >
            <ContactModal onClose={closeContact} />
          </motion.div>
        )}
      </AnimatePresence>
    </ContactContext.Provider>
  );
}
