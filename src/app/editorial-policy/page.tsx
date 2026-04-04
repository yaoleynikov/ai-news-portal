import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Editorial Policy — SiliconFeed',
  description: 'How SiliconFeed selects, verifies, and publishes technology news.',
};

export default function EditorialPolicyPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>Editorial Policy</h1>
        <p><strong>Our commitment is to accuracy, transparency, and relevance.</strong></p>

        <h2>How We Select Stories</h2>
        <p>We monitor over 130 sources across the technology landscape. Stories are selected based on their impact on the tech industry, relevance to IT professionals, and potential to influence where technology is headed. We don't chase clicks — we chase what matters.</p>

        <h2>Verification Process</h2>
        <p>Every story is verified against primary sources before publication. We never publish rumors as facts. When a story develops, we update existing articles rather than publishing duplicate coverage.</p>

        <h2>News vs. Opinion</h2>
        <p>We clearly distinguish between reported news and editorial analysis. The "Monster Take" sections at the end of articles are explicitly labeled as editorial opinion and represent the view of our editorial team.</p>

        <h2>Corrections</h2>
        <p>When we make mistakes, we correct them promptly and transparently. Corrections are noted at the top of the affected article. If you spot an error, contact us at corrections@siliconfeed.online.</p>

        <h2>Sponsored Content & Advertising</h2>
        <p>We do not accept paid placement or sponsored content disguised as editorial coverage. Any advertising or sponsored content will be clearly labeled as such.</p>

        <h2>Sources & Attribution</h2>
        <p>Every article includes a source link to the original reporting. We attribute information to its original publisher when appropriate.</p>

        <h2>Diversity of Coverage</h2>
        <p>We cover the full spectrum of technology — from AI and machine learning to hardware, software, gaming, robotics, gadgets, cybersecurity, space tech, startups, crypto, and tech policy. Our editorial team brings diverse perspectives to every topic we cover.</p>
      </div>
      <Footer />
    </div>
  );
}
