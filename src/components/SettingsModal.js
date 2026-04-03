import React, { useEffect, useState } from 'react';
import { X, Key, Save, Eye, EyeOff } from 'lucide-react';
import { electronBridge } from '../utils/electronBridge';

const SECRET_PLACEHOLDER = '*'.repeat(32);

const SettingsModal = ({ onClose }) => {
  const [openaiKey, setOpenaiKey] = useState('');
  const [ideogramKey, setIdeogramKey] = useState('');
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showIdeogramKey, setShowIdeogramKey] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [hasIdeogramKey, setHasIdeogramKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkExistingKeys();
  }, []);

  const checkExistingKeys = async () => {
    try {
      const [openaiResult, ideogramResult] = await Promise.all([
        electronBridge.apiKey.get(),
        electronBridge.ideogramApiKey.get()
      ]);

      if (openaiResult?.success && openaiResult.hasApiKey) {
        setHasOpenAIKey(true);
        setOpenaiKey(SECRET_PLACEHOLDER);
      }

      if (ideogramResult?.success && ideogramResult.hasApiKey) {
        setHasIdeogramKey(true);
        setIdeogramKey(SECRET_PLACEHOLDER);
      }
    } catch (error) {
      console.error('Error checking API keys:', error);
    }
  };

  const isPlaceholder = (value) => typeof value === 'string' && value.startsWith('*');

  const reinitializeService = async (service, path) => {
    try {
      const port = await service.getPort();
      const response = await fetch(`http://localhost:${port}/api/reinitialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.warn(`${path} reinitialize failed, but the key was saved`);
      }
    } catch (fetchError) {
      console.warn(`Could not reach ${path} service:`, fetchError.message);
    }
  };

  const handleSave = async () => {
    const openaiValue = isPlaceholder(openaiKey) ? null : openaiKey.trim();
    const ideogramValue = isPlaceholder(ideogramKey) ? null : ideogramKey.trim();

    if (!openaiValue && !ideogramValue) {
      setMessage({ type: 'error', text: 'Enter at least one API key' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (openaiValue) {
        const result = await electronBridge.apiKey.set(openaiValue);
        if (!result.success) {
          throw new Error(result.error || 'OpenAI key save failed');
        }
        await reinitializeService(electronBridge.openai, 'OpenAI');
        setHasOpenAIKey(true);
        setOpenaiKey(SECRET_PLACEHOLDER);
      }

      if (ideogramValue) {
        const result = await electronBridge.ideogramApiKey.set(ideogramValue);
        if (!result.success) {
          throw new Error(result.error || 'Ideogram key save failed');
        }
        await reinitializeService(electronBridge.ideogram, 'Ideogram');
        setHasIdeogramKey(true);
        setIdeogramKey(SECRET_PLACEHOLDER);
      }

      setMessage({ type: 'success', text: 'API keys saved successfully' });
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      console.error('Error saving API keys:', error);
      setMessage({ type: 'error', text: error.message || 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpenAI = async () => {
    if (window.confirm('Delete the OpenAI API key?')) {
      await electronBridge.apiKey.delete();
      setOpenaiKey('');
      setHasOpenAIKey(false);
      setMessage({ type: 'success', text: 'OpenAI key deleted' });
    }
  };

  const handleDeleteIdeogram = async () => {
    if (window.confirm('Delete the Ideogram API key?')) {
      await electronBridge.ideogramApiKey.delete();
      setIdeogramKey('');
      setHasIdeogramKey(false);
      setMessage({ type: 'success', text: 'Ideogram key deleted' });
    }
  };

  const renderSecretField = ({
    label,
    value,
    onChange,
    showValue,
    onToggleShow,
    placeholder,
    helpText,
    deleteAction,
    hasKey
  }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        <div className="relative">
          <input
            type={showValue ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showValue ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">{helpText}</p>
      </div>

      {hasKey && (
        <button
          type="button"
          onClick={deleteAction}
          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          Delete key
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
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
              <h3 className="text-lg font-semibold text-gray-800">API keys</h3>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                Keys are stored securely in the system keychain and are never exposed in React.
                OpenAI powers story and fallback tasks. Ideogram powers the main illustration pipeline.
              </p>
            </div>

            <div className="space-y-6">
              {renderSecretField({
                label: 'OpenAI API key',
                value: openaiKey,
                onChange: setOpenaiKey,
                showValue: showOpenAIKey,
                onToggleShow: () => setShowOpenAIKey(!showOpenAIKey),
                placeholder: 'sk-...',
                helpText: 'Get your key at platform.openai.com/api-keys',
                deleteAction: handleDeleteOpenAI,
                hasKey: hasOpenAIKey
              })}

              {renderSecretField({
                label: 'Ideogram API key',
                value: ideogramKey,
                onChange: setIdeogramKey,
                showValue: showIdeogramKey,
                onToggleShow: () => setShowIdeogramKey(!showIdeogramKey),
                placeholder: 'ideogram_...',
                helpText: 'Get your key from the Ideogram API dashboard.',
                deleteAction: handleDeleteIdeogram,
                hasKey: hasIdeogramKey
              })}

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
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">About</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Version:</strong> 0.1.0</p>
              <p><strong>Electron:</strong> Yes</p>
              <p><strong>Offline mode:</strong> Supported (except AI)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
