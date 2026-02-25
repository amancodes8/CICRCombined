import { useState } from 'react';
import { Bot, Loader2, Send, User } from 'lucide-react';
import { askCicrAssistant } from '../api';

export default function CicrAssistant({ title = 'CICR Assistant', placeholder = 'Ask about CICR, members, projects, events...' }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Ask me about CICR society, member contributions, roles, projects, and events.' },
  ]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await askCicrAssistant({ question });
      setMessages((prev) => [...prev, { role: 'bot', text: data.answer || 'No response available.' }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: err.response?.data?.answer || err.response?.data?.message || 'Assistant request failed.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-gray-800">
        <h3 className="text-xl font-black text-white">{title}</h3>
      </div>
      <div className="h-[360px] overflow-y-auto p-6 space-y-5">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'bot' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`${msg.role === 'bot' ? 'bg-[#1c1c21] border border-gray-800 text-gray-200' : 'bg-blue-600 text-white'} p-4 rounded-2xl text-sm leading-relaxed`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="bg-[#1c1c21] border border-gray-800 p-3 rounded-xl">
              <Loader2 className="animate-spin text-blue-500" size={16} />
            </div>
          </div>
        )}
      </div>
      <div className="p-5 border-t border-gray-800 bg-[#1c1c21]/40">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={placeholder}
            className="flex-1 bg-[#0a0a0c] border border-gray-800 rounded-2xl px-5 py-4 text-sm outline-none focus:border-blue-500 text-white"
          />
          <button onClick={handleSend} disabled={loading} className="bg-blue-600 hover:bg-blue-700 px-5 rounded-2xl transition-all disabled:opacity-60">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

