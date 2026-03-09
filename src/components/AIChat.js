import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Send, Sparkles, Loader, Copy, FileText, Scissors } from 'lucide-react';

const AIChat = ({ selectedPageId, className = '' }) => {
  const { currentProject, updateProject, callOpenAI } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentProject?.chatHistory) {
      setMessages(currentProject.chatHistory);
    }
  }, [currentProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickPrompts = [
    { 
      label: 'Écrire l\'histoire', 
      icon: Sparkles,
      prompt: `Écris une histoire pour enfants de ${currentProject?.targetAge} ans, de type "${currentProject?.bookType}". Le titre est "${currentProject?.title}". L'histoire doit être adaptée à l'âge cible et captivante.`
    },
    { 
      label: 'Simplifier', 
      icon: FileText,
      prompt: 'Simplifie le texte précédent pour le rendre plus accessible aux jeunes enfants.'
    },
    { 
      label: 'Découper en pages', 
      icon: Scissors,
      prompt: `Découpe cette histoire en ${Math.max(8, currentProject?.pages?.length || 8)} pages. Pour chaque page, fournis le texte et une description de l'illustration nécessaire. Format: "Page X: [texte] | Illustration: [description]"`
    }
  ];

  const handleSend = async (customPrompt = null) => {
    const messageText = customPrompt || input.trim();
    if (!messageText || loading) return;

    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const pagesText = currentProject?.pages?.length > 0
        ? currentProject.pages.map(p => {
            const text = p.textBlocks?.map(b => b.content).join(' ') || '';
            return `Page ${p.number} (${p.template || 'standard'}): ${text}`;
          }).join('\n')
        : 'Aucune page créée pour le moment.';

      const charactersText = currentProject?.characters?.length > 0
        ? currentProject.characters.map(c => `- ${c.name}: ${c.description || c.appearance}`).join('\n')
        : 'Aucun personnage défini.';

      const summaryText = currentProject?.summary || 'Aucun résumé disponible.';

      const systemPrompt = {
        role: 'system',
        content: `Tu es un assistant narratif spécialisé dans l'écriture de livres pour enfants.

📚 CONTEXTE DU PROJET:
Titre: "${currentProject?.title}"
Auteur: ${currentProject?.author}
Âge cible: ${currentProject?.targetAge} ans
Type de livre: ${currentProject?.bookType}
Format: ${currentProject?.format?.preset}
Nombre de pages actuelles: ${currentProject?.pages?.length || 0}

📖 RÉSUMÉ DE L'HISTOIRE:
${summaryText}

👥 PERSONNAGES:
${charactersText}

📄 CONTENU DES PAGES EXISTANTES:
${pagesText}

🎯 TON RÔLE:
- Maintenir la cohérence narrative avec le résumé et les pages existantes
- Adapter le langage aux enfants de ${currentProject?.targetAge} ans
- Respecter les personnages déjà définis
- Proposer des suggestions créatives et éducatives
- Aider à structurer l'histoire de manière cohérente

IMPORTANT: Utilise toujours le contexte ci-dessus pour donner des réponses cohérentes avec l'histoire en cours.`
      };

      const apiMessages = [
        systemPrompt,
        ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await callOpenAI(apiMessages);

      const assistantMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      
      await updateProject({ chatHistory: finalMessages });
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Erreur: ${error.message}. Vérifiez que votre clé API OpenAI est configurée dans les paramètres.`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertInPage = async (text) => {
    if (!selectedPageId) {
      alert('Sélectionnez d\'abord une page');
      return;
    }

    const updatedPages = currentProject.pages.map(p => {
      if (p.id === selectedPageId) {
        const newBlock = {
          id: Date.now().toString(),
          type: 'text',
          content: text,
          style: 'narration',
          x: 50,
          y: 50,
          width: 400,
          height: 150,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000'
        };
        return {
          ...p,
          textBlocks: [...(p.textBlocks || []), newBlock]
        };
      }
      return p;
    });

    await updateProject({ pages: updatedPages });
  };

  const handleAutoCutPages = async (text) => {
    const pageMatches = text.match(/Page \d+:([^|]+)\|?\s*Illustration:\s*([^\n]+)/gi);
    
    if (!pageMatches || pageMatches.length === 0) {
      alert('Format non reconnu. Utilisez le bouton "Découper en pages" d\'abord.');
      return;
    }

    const newPages = pageMatches.map((match, index) => {
      const textMatch = match.match(/Page \d+:\s*([^|]+)/i);
      const illustrationMatch = match.match(/Illustration:\s*([^\n]+)/i);

      return {
        id: Date.now().toString() + index,
        number: index + 1,
        position: index % 2 === 0 ? 'left' : 'right',
        textBlocks: textMatch ? [{
          id: Date.now().toString() + '-text-' + index,
          type: 'text',
          content: textMatch[1].trim(),
          style: 'narration',
          x: 50,
          y: 300,
          width: 400,
          height: 150,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000'
        }] : [],
        imageUrl: null,
        illustrationPrompt: illustrationMatch ? illustrationMatch[1].trim() : '',
        createdAt: new Date().toISOString()
      };
    });

    await updateProject({ pages: newPages });
    alert(`${newPages.length} pages créées avec succès!`);
  };

  return (
    <div className={`w-96 bg-white border-l border-zinc-200 flex flex-col ${className}`.trim()}>
      <div className="p-4 border-b border-indigo-200 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} />
          <h3 className="font-semibold">Assistant IA</h3>
        </div>
        <p className="text-xs text-indigo-100">Propulsé par OpenAI GPT-4</p>
      </div>

      <div className="p-3 border-b border-zinc-200 bg-zinc-50/80">
        <p className="text-xs font-semibold text-zinc-600 mb-2">Actions rapides</p>
        <div className="grid grid-cols-1 gap-2">
          {quickPrompts.map((prompt, idx) => {
            const Icon = prompt.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(prompt.prompt)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
              >
                <Icon size={14} className="text-indigo-600" />
                {prompt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-zinc-50/30">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <Sparkles size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Commencez une conversation</p>
            <p className="text-xs mt-1">Utilisez les actions rapides ou tapez votre message</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.isError
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-zinc-100 text-zinc-800 border border-zinc-200/70'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
              
              {msg.role === 'assistant' && !msg.isError && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-200">
                  <button
                    onClick={() => handleInsertInPage(msg.content)}
                    className="text-xs px-2 py-1 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors flex items-center gap-1"
                    title="Insérer dans la page active"
                  >
                    <Copy size={12} />
                    Insérer
                  </button>
                  <button
                    onClick={() => handleAutoCutPages(msg.content)}
                    className="text-xs px-2 py-1 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors flex items-center gap-1"
                    title="Découper automatiquement"
                  >
                    <Scissors size={12} />
                    Auto-découpe
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 rounded-lg px-4 py-3 border border-zinc-200">
              <Loader size={20} className="animate-spin text-indigo-600" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Votre message..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
