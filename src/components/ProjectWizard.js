import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { electronBridge } from '../utils/electronBridge';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { createCanonicalBookFormat } from '../utils/projectSchema';

const ProjectWizard = ({ onClose }) => {
  const { createProject, loadProject } = useApp();
  const [step, setStep] = useState(1);
  const defaultFormat = createCanonicalBookFormat({
    id: '8.5x8.5',
    label: '8.5x8.5 pouces (carré jeunesse)',
    width: 8.5,
    height: 8.5,
    unit: 'inches',
    bleed: true
  });
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    targetAge: '3-5',
    bookType: 'album illustré',
    format: defaultFormat,
    bookFormat: defaultFormat,
    savePath: ''
  });

  const formatPresets = [
    { name: '8.5x8.5 pouces (carré jeunesse)', width: 8.5, height: 8.5 },
    { name: '8x10 pouces', width: 8, height: 10 },
    { name: '6x9 pouces', width: 6, height: 9 },
    { name: 'A4 (210x297mm)', width: 210, height: 297, unit: 'mm' },
    { name: 'Personnalisé', width: 0, height: 0 }
  ];

  const bookTypes = [
    'album illustré',
    'imagier',
    'éducatif',
    'histoire du soir'
  ];

  const ageRanges = ['3-5', '5-7', '7-9'];

  const handleSelectFolder = async () => {
    const folder = await electronBridge.dialog.selectFolder();
    if (folder) {
      setFormData({ ...formData, savePath: folder });
    }
  };

  const handleFormatChange = (preset) => {
    const selected = formatPresets.find(f => f.name === preset);
    if (selected) {
      const canonicalFormat = createCanonicalBookFormat({
        id: selected.name === 'A4 (210x297mm)' ? 'a4' : selected.name.includes('8.5x8.5') ? '8.5x8.5' : selected.name.includes('8x10') ? '8x10' : selected.name.includes('6x9') ? '6x9' : selected.name,
        label: selected.name,
        width: selected.width,
        height: selected.height,
        unit: selected.unit || 'inches',
        bleed: formData.format.bleed
      });
      setFormData({
        ...formData,
        format: canonicalFormat,
        bookFormat: canonicalFormat
      });
    }
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        return formData.title && formData.author && formData.targetAge;
      case 2:
        return formData.format.width > 0 && formData.format.height > 0;
      case 3:
        return formData.bookType && formData.savePath;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFinish = async () => {
    if (validateStep()) {
      try {
        const project = await createProject(formData);
        await loadProject(project.id);
        onClose();
      } catch (error) {
        console.error('Error creating project:', error);
        alert('Erreur lors de la création du projet: ' + error.message);
      }
    }
  };

  const isKDPCompliant = () => {
    const { width, height, unit } = formData.format;
    if (unit === 'mm') return true;
    return width >= 4 && width <= 8.5 && height >= 6 && height <= 11.69;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Nouveau Projet</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  s === step ? 'bg-indigo-600 text-white' : 
                  s < step ? 'bg-green-500 text-white' : 
                  'bg-gray-200 text-gray-600'
                }`}>
                  {s < step ? <Check size={20} /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-24 h-1 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Informations du livre</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre du livre *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Le Petit Dragon Courageux"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auteur *
                </label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Marie Dupont"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Âge cible *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {ageRanges.map(age => (
                    <button
                      key={age}
                      onClick={() => setFormData({ ...formData, targetAge: age })}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        formData.targetAge === age
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {age} ans
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Format du livre</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format prédéfini
                </label>
                <select
                  value={formData.format.preset}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {formatPresets.map(preset => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.format.preset === 'Personnalisé' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Largeur
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.format.width}
                      onChange={(e) => setFormData({
                        ...formData,
                        format: createCanonicalBookFormat({
                          ...formData.format,
                          id: 'custom',
                          label: 'Personnalisé',
                          width: parseFloat(e.target.value)
                        }),
                        bookFormat: createCanonicalBookFormat({
                          ...formData.format,
                          id: 'custom',
                          label: 'Personnalisé',
                          width: parseFloat(e.target.value)
                        })
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hauteur
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.format.height}
                      onChange={(e) => setFormData({
                        ...formData,
                        format: createCanonicalBookFormat({
                          ...formData.format,
                          id: 'custom',
                          label: 'Personnalisé',
                          height: parseFloat(e.target.value)
                        }),
                        bookFormat: createCanonicalBookFormat({
                          ...formData.format,
                          id: 'custom',
                          label: 'Personnalisé',
                          height: parseFloat(e.target.value)
                        })
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="bleed"
                  checked={formData.format.bleed}
                  onChange={(e) => setFormData({
                    ...formData,
                    format: createCanonicalBookFormat({
                      ...formData.format,
                      bleed: e.target.checked
                    }),
                    bookFormat: createCanonicalBookFormat({
                      ...formData.format,
                      bleed: e.target.checked
                    })
                  })}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <label htmlFor="bleed" className="text-sm font-medium text-gray-700">
                  Activer le bleed (0.125" / 3.2mm)
                </label>
              </div>

              {!isKDPCompliant() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Attention : Ce format n'est pas conforme aux limites KDP (largeur 4"-8.5", hauteur 6"-11.69")
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Type de livre et emplacement</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de livre *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {bookTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, bookType: type })}
                      className={`px-4 py-3 rounded-lg border-2 transition-all capitalize ${
                        formData.bookType === type
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emplacement de sauvegarde *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.savePath}
                    readOnly
                    placeholder="Sélectionnez un dossier..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Parcourir
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 Un dossier sera créé automatiquement pour votre projet avec tous les fichiers nécessaires.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={step === 1 ? onClose : handleBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
            {step === 1 ? 'Annuler' : 'Précédent'}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!validateStep()}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!validateStep()}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={20} />
              Créer le projet
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectWizard;
