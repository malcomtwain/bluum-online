export default function TermsPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
      <p className="text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="space-y-4 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
          <p>By using Bluum, you agree to these terms of service.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">2. Use of Service</h2>
          <p>Bluum is a video creation and management platform. Users must comply with all applicable laws.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">3. User Content</h2>
          <p>You retain ownership of content you create. By using our service, you grant us license to process your content.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">4. Privacy</h2>
          <p>Your privacy is important to us. Please review our Privacy Policy.</p>
        </section>
      </div>
    </div>
  );
}