import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Contact SiliconFeed — Get in Touch',
  description: 'Have a tip, question, or want to collaborate? Reach out to the SiliconFeed team.',
};

export default function ContactPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>Contact Us</h1>
        <p>We'd love to hear from you. Whether it's a news tip, a correction, a partnership inquiry, or just a hello — reach out.</p>
        <h2>General Inquiries</h2>
        <p>hello@siliconfeed.online</p>

        <h2>News Tips</h2>
        <p>Have a story we should cover? tips@siliconfeed.online</p>

        <h2>Corrections</h2>
        <p>Found an error? corrections@siliconfeed.online</p>

        <h2>Partnerships & Advertising</h2>
        <p>partnerships@siliconfeed.online</p>

        <h2>Location</h2>
        <p>We're a remote-first team spread across multiple time zones. No physical office — just Slack, email, and a shared obsession with staying current on tech.</p>

        <h2>Response Time</h2>
        <p>We aim to respond to all inquiries within 24 hours on business days.</p>
      </div>
      <Footer />
    </div>
  );
}
