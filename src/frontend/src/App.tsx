import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    url: string;
  }>;
  id: string;
}

interface ApiResponse {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
}

export default function App() {
  // Stan aplikacji
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Automatyczne przewijanie do najnowszej wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Automatyczne skupienie na polu wprowadzania
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // Obsługa wysyłania wiadomości
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: question,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);
    setIsTyping(true);
    
    try {
      const response = await fetch('http://localhost:10000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content })
      });

      const data = await response.json() as ApiResponse;
      
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
    } catch (error) {
      console.error('Error:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: 'Przepraszam, wystąpił błąd podczas przetwarzania pytania.'
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Avatar dla bota
  const BotAvatar = () => (
    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white text-xs font-medium shadow-md">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0A10.01 10.01 0 0120 10c0 2.537-.939 4.852-2.48 6.626l2.48 2.48a1 1 0 01-1.414 1.414l-2.48-2.48A9.957 9.957 0 0110 20a9.957 9.957 0 01-6.626-2.461l-2.48 2.48a1 1 0 01-1.414-1.414l2.48-2.48A10.01 10.01 0 010 10C0 4.477 4.477 0 10 0c1.669 0 3.254.41 4.504 1.132zm.996 4.368a1 1 0 00-2 0v3.5c0 .279.114.531.3.714l2.5 2.5a1 1 0 001.4-1.4L10.3 8.414V5.5z" clipRule="evenodd" />
      </svg>
    </div>
  );

  // Avatar dla użytkownika
  const UserAvatar = () => (
    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium shadow-md">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
              {/* ikona */}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">Weegree One RAG Bot</h1>
              <p className="text-xs text-gray-500">Twój asystent ds. robotów humanoidalnych</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full text-xs text-gray-500">
            <span className="h-2 w-2 bg-green-500 rounded-full"></span>
            Asystent Weegree
          </div>
        </div>
      </header>

      {/* POWITANIE / SUGESTIE */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
        <img src="/logo.svg" alt="logo" className="w-16 h-16 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Asystent Weegree One</h2>
        <p className="text-sm text-gray-600 max-w-md mb-6">
          Witaj! Zadaj pytanie dotyczące produktów i usług Weegree One.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg w-full">
          {['Jakie są główne cechy robotów humanoidalnych?','Jaka jest cena robota Pepper?','Jak bezpieczne są roboty humanoidalne?','Jak długo trwa realizacja zlecenia?']
            .map((label) => (
              <button
                key={label}
                onClick={() => setQuestion(label)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm hover:shadow-md transition"
              >
                {label}
              </button>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-5xl mx-auto">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
            {m.role==='assistant' && <BotAvatar />}
            <div
              className={`
                max-w-prose px-4 py-3 rounded-2xl shadow 
                ${m.role==='user'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}
              `}
            >
              <p className="leading-relaxed text-sm whitespace-pre-wrap">{m.content}</p>
              {m.sources && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-400 mb-1">Źródła:</p>
                  <ul className="space-y-1">
                    {m.sources.map((s,i) =>
                      <li key={i}>
                        <a href={s.url} target="_blank" className="flex items-center text-xs text-primary hover:underline">
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1"/>
                          {s.title}
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            {m.role==='user' && <UserAvatar />}
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start space-x-2">
            <BotAvatar/>
            <div className="bg-white p-3 rounded-2xl shadow border border-gray-200">
              <span className="dot animate-bounce delay-0"></span>
              <span className="dot animate-bounce delay-200"></span>
              <span className="dot animate-bounce delay-400"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* INPUT */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-md">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto flex items-center space-x-2">
          <input
            ref={inputRef}
            value={question}
            onChange={e=>setQuestion(e.target.value)}
            disabled={isLoading||isTyping}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Zadaj pytanie o roboty Weegree One..."
          />
          <button
            type="submit"
            disabled={isLoading||isTyping||!question.trim()}
            className={`p-3 rounded-full 
              ${question.trim()
                ? 'bg-primary text-white hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <ArrowRightIcon className="h-5 w-5"/>
          </button>
        </form>
      </div>
    </div>
  )
} 