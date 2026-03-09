import React, { useState, useEffect } from 'react';
import { X, Key, Save, Eye, EyeOff } from 'lucide-react';
import { electronBridge } from '../utils/electronBridge';

const SettingsModal = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkExistingKey();
  }, []);

  const checkExistingKey = async () => {
    try {
      const result = await electronBridge.apiKey.get();
      if (result && result.success && result.apiKey) {
        setHasExistingKey(true);
        setApiKey('••••••••••••••••••••••••••••••••');
      }
    } catch (error) {
      console.error('Error checking API key:', error);
    }
  };

  const handleSave = async () => {
    if (!apiKey || apiKey.startsWith('••••')) {
      setMessage({ type: 'error', text: 'Veuillez entrer une clé API valide' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await electronBridge.apiKey.set(apiKey);
      
      if (result.success) {
        const port = await electronBridge.openai.getPort();
        
        // Try to reinitialize OpenAI service (may fail in browser mode)
        try {
          const response = await fetch(`http://localhost:${port}/api/reinitialize`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (!response.ok) {
            console.warn('OpenAI service reinitialize failed, but key was saved');
          }
        } catch (fetchError) {
          console.warn('Could not reach OpenAI service:', fetchError.message);
        }
        
        setMessage({ type: 'success', text: 'Clé API enregistrée avec succès' });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      setMessage({ type: 'error', text: error.message || 'Erreur inconnue' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer la clé API ?')) {
      await electronBridge.apiKey.delete();
      setApiKey('');
      setHasExistingKey(false);
      setMessage({ type: 'success', text: 'Clé API supprimée' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Paramètres</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Key size={20} className="text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-800">Clé API OpenAI</h3>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Important :</strong> Votre clé API est stockée de manière sécurisée dans le trousseau système.
                Elle n'est jamais exposée dans l'interface et tous les appels OpenAI passent par un service local sécurisé.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clé API
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Obtenez votre clé sur <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">platform.openai.com</a>
                </p>
              </div>

              {message && (
                <div className={`p-4 rounded-lg ${
                  message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={18} />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                
                {hasExistingKey && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">À propos</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Version :</strong> 0.1.0</p>
              <p><strong>Electron :</strong> Oui</p>
              <p><strong>Mode hors-ligne :</strong> Supporté (sauf IA)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
