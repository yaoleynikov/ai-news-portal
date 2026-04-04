import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'About SiliconFeed — The IT News Portal We Built Ourselves',
  description: 'We got tired of checking 30+ sources every morning. So we built one place for all tech news.',
};

export default function AboutPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>About SiliconFeed</h1>
        
        <p><strong>We're a team of IT people who got tired.</strong></p>

        <p>Tired of opening TechCrunch, Ars Technica, Bloomberg, The Verge, HackerNews, Reddit, and a dozen more tabs every morning just to catch up on what matters. Tired of missing important news because it was buried on page 3 of some blog.</p>

        <p>So we built SiliconFeed — one place for all technology news, curated by people who actually work in tech.</p>

        <h2>What We Cover</h2>
        <p>If it's technology, we cover it. AI and machine learning, hardware and GPUs, software development and open source, gaming and entertainment, robotics and automation, gadgets and consumer tech, cybersecurity and privacy, cloud infrastructure, startups and funding, crypto and blockchain, space technology, tech policy and regulation.</p>
        <p>We don't do celebrity gossip. We don't do clickbait. We cover the technology that shapes how we work, play, and live.</p>

        <h2>How It Works</h2>
        <p>We monitor over 130 sources continuously — from major tech publications to niche developer blogs, from GitHub trending to HackerNews. Our editorial team reviews, rewrites, and publishes stories with analysis and context, not just copy-paste.</p>
        <p>Every story goes through our editorial process: source verification, context checking, and our signature "Monster Take" editorial analysis at the end of key articles.</p>

        <h2>Our Team</h2>
        <p>SiliconFeed is run by IT professionals with backgrounds in software engineering, systems architecture, and technology journalism. We've worked at startups, Fortune 500 companies, and everything in between. We know what matters because we use the same technologies we write about.</p>

        <h2>Editorial Standards</h2>
        <p>We verify every story against primary sources before publishing. We distinguish clearly between reported news and editorial opinion. When we make mistakes — and we will — we correct them transparently. We don't accept paid placement or sponsored content disguised as news.</p>
      </div>
      <div className="wrap" style={{ marginTop: '40px' }}>
        <div className="side">
          <p className="side-l" style={{ textAlign: 'center' }}>Quick Links</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <Link href="/editorial-policy" className="tag-btn" style={{ width: '200px', textAlign: 'center' }}>Editorial Policy</Link>
            <Link href="/contact" className="tag-btn" style={{ width: '200px', textAlign: 'center' }}>Contact Us</Link>
            <Link href="/privacy-policy" className="tag-btn" style={{ width: '200px', textAlign: 'center' }}>Privacy Policy</Link>
            <Link href="/tag/all" className="tag-btn" style={{ width: '200px', textAlign: 'center' }}>All Stories</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
