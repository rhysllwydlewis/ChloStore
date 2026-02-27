import { ContactProvider } from '@/components/ContactWidget';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Collections from '@/components/Collections';
import ContactBand from '@/components/ContactBand';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <ContactProvider>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Collections />
        <ContactBand />
      </main>
      <Footer />
    </ContactProvider>
  );
}
