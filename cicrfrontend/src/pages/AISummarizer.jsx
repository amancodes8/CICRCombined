import { Sparkles } from 'lucide-react';
import CicrAssistant from '../components/CicrAssistant';

export default function AISummarizer() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-8">
        <Sparkles className="text-blue-500 animate-pulse" size={32} />
        <h2 className="text-3xl font-bold">CICR AI Assistant</h2>
      </div>
      <CicrAssistant />
    </div>
  );
}
