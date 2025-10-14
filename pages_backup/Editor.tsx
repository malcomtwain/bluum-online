import { useState } from 'react';
import { TemplateEditor } from '../components/TemplateEditor';
import { MediaSelector } from '../components/MediaSelector';
import { HookEditor } from '../components/HookEditor';
import { VideoGenerator } from '../components/VideoGenerator';

type Step = 'template' | 'media' | 'hooks' | 'generate';

// Renommer en EditorComponent pour l'export nommé
export const EditorComponent = () => {
  const [currentStep, setCurrentStep] = useState<Step>('template');

  const steps: { id: Step; label: string }[] = [
    { id: 'template', label: 'Template' },
    { id: 'media', label: 'Media' },
    { id: 'hooks', label: 'Hooks' },
    { id: 'generate', label: 'Generate' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Bluum Editor</h1>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    currentStep === step.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {currentStep === 'template' && <TemplateEditor />}
          {currentStep === 'media' && <MediaSelector />}
          {currentStep === 'hooks' && <HookEditor />}
          {currentStep === 'generate' && <VideoGenerator />}
        </div>
      </main>

      {/* Navigation Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
          <button
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1].id);
              }
            }}
            disabled={currentStep === 'template'}
            className={`px-4 py-2 rounded-md text-white
              ${
                currentStep === 'template'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
          >
            Previous
          </button>
          <button
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              if (currentIndex < steps.length - 1) {
                setCurrentStep(steps[currentIndex + 1].id);
              }
            }}
            disabled={currentStep === 'generate'}
            className={`px-4 py-2 rounded-md text-white
              ${
                currentStep === 'generate'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

// Désactiver le prérendu statique pour cette page
export function getServerSideProps() {
  return {
    props: {},
  };
}

// Ajouter une exportation par défaut pour Next.js
export default function Editor() {
  return <EditorComponent />;
} 