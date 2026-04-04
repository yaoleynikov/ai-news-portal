import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy — SiliconFeed',
  description: 'How SiliconFeed collects, uses, and protects your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>Privacy Policy</h1>
        <p><strong>Last updated: April 4, 2026</strong></p>

        <p>SiliconFeed ("we", "our", or "us") is committed to protecting your privacy. This policy explains how we collect, use, and share information when you visit our website.</p>

        <h2>Information We Collect</h2>
        <p><strong>Automatically collected:</strong> We use Google Analytics to collect standard web analytics data, including pages visited, time spent on pages, browser type, device type, and approximate geographic location. This data is anonymized and does not identify individual users.</p>
        <p><strong>We do not collect:</strong> Names, email addresses, phone numbers, or any personally identifiable information unless you voluntarily provide them through email correspondence.</p>

        <h2>How We Use Your Information</h2>
        <p>We use analytics data solely to understand how visitors interact with our website, improve user experience, and measure content performance.</p>

        <h2>Cookies</h2>
        <p>We use Google Analytics cookies to track website usage. You can control cookies through your browser settings. Blocking cookies may affect website functionality and analytics accuracy.</p>

        <h2>Third-Party Services</h2>
        <p><strong>Google Analytics:</strong> We use Google Analytics to measure website traffic. Google's privacy policy applies to data collected through this service. You can opt out of Google Analytics via the Google Analytics Opt-out Browser Add-on.</p>
        <p><strong>Vercel:</strong> Our website is hosted on Vercel's infrastructure. Vercel's privacy policy applies to server-side data processing.</p>

        <h2>Data Retention</h2>
        <p>Google Analytics data is retained according to Google's retention policies. We do not store analytics data on our own servers.</p>

        <h2>Your Rights</h2>
        <p>Depending on your location, you may have rights to access, correct, or delete data collected about you. For EU residents, this includes rights under the GDPR. Contact us at hello@siliconfeed.online for any privacy-related requests.</p>

        <h2>Changes to This Policy</h2>
        <p>We may update this policy from time to time. Changes will be posted on this page with an updated "last updated" date.</p>

        <h2>Contact</h2>
        <p>Privacy inquiries: hello@siliconfeed.online</p>
      </div>
      <Footer />
    </div>
  );
}
