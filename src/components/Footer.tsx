import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-in">
        <div className="foot-brand">
          <div className="foot-logo">silicon<span>feed</span></div>
          <p>One place for all technology news. Built by people who work in tech, tired of checking 30+ tabs every morning.</p>
        </div>
        <div className="foot-col">
          <h4>Topics</h4>
          <Link href="/tag/ai">AI & Machine Learning</Link>
          <Link href="/tag/startups">Startups & Funding</Link>
          <Link href="/tag/hardware">Hardware & Chips</Link>
          <Link href="/tag/security">Cybersecurity</Link>
          <Link href="/tag/crypto">Crypto & Blockchain</Link>
        </div>
        <div className="foot-col">
          <h4>Company</h4>
          <Link href="/about">About Us</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/editorial-policy">Editorial Policy</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/rss.xml">RSS Feed</Link>
        </div>
      </div>
      <div className="foot-bot">© {new Date().getFullYear()} SiliconFeed. All rights reserved.</div>
    </footer>
  );
}
