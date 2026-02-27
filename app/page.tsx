import { ContactProvider } from '@/components/ContactWidget';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Store from '@/components/Store';
import About from '@/components/About';
import ContactBand from '@/components/ContactBand';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <ContactProvider>
      <Navbar />
      <main>
        <Hero />
        <Store />
        <About />
        <ContactBand />
      </main>
      <Footer />
    </ContactProvider>
  );
}
