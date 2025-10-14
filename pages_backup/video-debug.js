import { useState } from 'react';
import Head from 'next/head';

export default function VideoDebug() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [alternativeTest, setAlternativeTest] = useState(null);
  const [loading, setLoading] = useState({ diagnostics: false, alternative: false });
  const [error, setError] = useState(null);

  const runDiagnostics = async () => {
    setLoading(prev => ({ ...prev, diagnostics: true }));
    setError(null);
    try {
      const response = await fetch('/api/video-debug');
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const data = await response.json();
      setDiagnostics(data);
    } catch (err) {
      setError(`Erreur de diagnostic: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, diagnostics: false }));
    }
  };

  const testAlternative = async () => {
    setLoading(prev => ({ ...prev, alternative: true }));
    setError(null);
    try {
      const response = await fetch('/api/alternative-video');
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const data = await response.json();
      setAlternativeTest(data);
    } catch (err) {
      setError(`Erreur alternative: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, alternative: false }));
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Débogage Vidéo</title>
      </Head>

      <h1 style={{ marginBottom: '20px', fontSize: '24px' }}>Page de débogage pour la génération vidéo</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>Diagnostics FFmpeg</h2>
          <button 
            onClick={runDiagnostics}
            disabled={loading.diagnostics}
            style={{
              backgroundColor: loading.diagnostics ? '#cccccc' : '#4285f4',
              color: 'white',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '4px',
              cursor: loading.diagnostics ? 'default' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {loading.diagnostics ? 'Chargement...' : 'Exécuter les diagnostics'}
          </button>
          
          {diagnostics && (
            <div style={{ marginTop: '15px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Résultats:</h3>
              <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflowX: 'auto', fontSize: '14px' }}>
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>API Alternative (Test)</h2>
          <button 
            onClick={testAlternative}
            disabled={loading.alternative}
            style={{
              backgroundColor: loading.alternative ? '#cccccc' : '#34a853',
              color: 'white',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '4px',
              cursor: loading.alternative ? 'default' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {loading.alternative ? 'Chargement...' : 'Tester l\'API alternative'}
          </button>
          
          {alternativeTest && (
            <div style={{ marginTop: '15px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Résultats:</h3>
              <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflowX: 'auto', fontSize: '14px' }}>
                {JSON.stringify(alternativeTest, null, 2)}
              </pre>
              
              {alternativeTest.videoUrl && (
                <div style={{ marginTop: '15px' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Aperçu de la vidéo:</h4>
                  <video 
                    controls 
                    style={{ maxWidth: '100%', borderRadius: '4px' }} 
                    src={alternativeTest.videoUrl}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div style={{ backgroundColor: '#ffebee', border: '1px solid #f44336', color: '#d32f2f', padding: '10px 15px', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      
      <div style={{ backgroundColor: '#fff8e1', border: '1px solid #ffc107', color: '#ff8f00', padding: '15px', borderRadius: '4px' }}>
        <p style={{ marginBottom: '10px' }}><strong>Note:</strong> Cette page est uniquement destinée au débogage et ne modifie pas votre code de génération vidéo principal.</p>
        <p>Une fois le problème identifié, nous pourrons résoudre les erreurs sans modifier la logique que vous avez développée pendant 3 mois.</p>
      </div>
    </div>
  );
} 