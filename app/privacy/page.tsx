export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="space-y-4 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
          <p>We collect information you provide when creating videos and connecting social media accounts.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
          <p>We use your information to provide and improve our video creation services.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">3. Data from TikTok/Instagram</h2>
          <p>When you connect your accounts, we access only the data you authorize:</p>
          <ul className="list-disc ml-6 mt-2">
            <li>Profile information</li>
            <li>Video/Media lists</li>
            <li>Account statistics</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">4. Data Security</h2>
          <p>We implement security measures to protect your data. Access tokens are encrypted.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">5. Your Rights</h2>
          <p>You can disconnect accounts and delete your data at any time.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">6. Contact</h2>
          <p>For privacy concerns, contact us at privacy@bluum.app</p>
        </section>
      </div>
    </div>
  );
}