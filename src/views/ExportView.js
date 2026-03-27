import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AlertCircle, FileText, Image, Package, Download, CheckCircle } from 'lucide-react';
import PreflightReport from '../components/PreflightReport';
import { CATEGORY, runPreflightCheck } from '../utils/preflightCheck';
import { exportInteriorPDF, exportCoverPDF, savePDFToFile } from '../utils/pdfExporter';
import { createExportPackage, saveZipToFile } from '../utils/exportPackage';
import { generateCoverTemplate } from '../utils/coverGenerator';
import { getPrintFormatInches } from '../utils/printFormat';

const ExportView = () => {
  const { currentProject } = useApp();
  const [preflightReport, setPreflightReport] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [coverData, setCoverData] = useState(null);

  useEffect(() => {
    if (currentProject) {
      runPreflight();
      initializeCoverData();
    }
  }, [currentProject]);

  const initializeCoverData = () => {
    if (!currentProject) return;
    
    if (
      !currentProject.coverData
      || currentProject.coverData.pageCount !== (currentProject.pages?.length || 0)
    ) {
      const template = generateCoverTemplate(currentProject);
      setCoverData(template);
    } else {
      setCoverData(currentProject.coverData);
    }
  };

  const runPreflight = async () => {
    setIsChecking(true);
    try {
      const report = runPreflightCheck(currentProject);
      setPreflightReport(report);
    } catch (error) {
      console.error('Preflight check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleExportInterior = async () => {
    if (!preflightReport?.canExport) {
      alert('Veuillez corriger les erreurs critiques avant d\'exporter');
      return;
    }

    setIsExporting(true);
    setExportProgress('Génération du PDF intérieur...');

    try {
      const pdfBlob = await exportInteriorPDF(currentProject, {
        dpi: 300,
        applyColorAdjustment: true
      });

      setExportProgress('Enregistrement du fichier...');

      const filename = `${currentProject.title || 'book'}_interior.pdf`;
      await savePDFToFile(pdfBlob, filename);

      setExportProgress('Export terminé !');
      setTimeout(() => setExportProgress(null), 3000);
    } catch (error) {
      if (error?.canceled) {
        setExportProgress(null);
      } else {
        console.error('Export failed:', error);
        alert('Erreur lors de l\'export : ' + error.message);
        setExportProgress(null);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCover = async () => {
    const effectiveCoverData = coverData || generateCoverTemplate(currentProject);
    if (!effectiveCoverData) {
      alert('Veuillez configurer la couverture avant d\'exporter');
      return;
    }

    setIsExporting(true);
    setExportProgress('Génération du PDF couverture...');

    try {
      const pdfBlob = await exportCoverPDF(currentProject, effectiveCoverData, {
        dpi: 300,
        paperType: 'white'
      });

      setExportProgress('Enregistrement du fichier...');

      const filename = `${currentProject.title || 'book'}_cover.pdf`;
      await savePDFToFile(pdfBlob, filename);

      setExportProgress('Export terminé !');
      setTimeout(() => setExportProgress(null), 3000);
    } catch (error) {
      if (error?.canceled) {
        setExportProgress(null);
      } else {
        console.error('Cover export failed:', error);
        alert('Erreur lors de l\'export de la couverture : ' + error.message);
        setExportProgress(null);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPackage = async () => {
    if (!preflightReport?.canExport) {
      alert('Veuillez corriger les erreurs critiques avant d\'exporter');
      return;
    }

    const effectiveCoverData = coverData || generateCoverTemplate(currentProject);
    if (!effectiveCoverData) {
      alert('Couverture invalide. Veuillez réessayer.');
      return;
    }

    setIsExporting(true);
    setExportProgress('Création du package complet...');

    try {
      setExportProgress('Génération du PDF intérieur...');
      const interiorBlob = await exportInteriorPDF(currentProject);

      setExportProgress('Génération du PDF couverture...');
      const coverBlob = await exportCoverPDF(currentProject, effectiveCoverData);

      setExportProgress('Enregistrement des fichiers...');

      const baseName = currentProject.title || 'book';
      await savePDFToFile(interiorBlob, `${baseName}_interior.pdf`);
      await savePDFToFile(coverBlob, `${baseName}_cover.pdf`);

      setExportProgress('Package créé avec succès !');
      setTimeout(() => setExportProgress(null), 3000);
    } catch (error) {
      console.error('Package export failed:', error);
      alert('Erreur lors de la création du package : ' + error.message);
      setExportProgress(null);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportArchive = async () => {
    if (!preflightReport?.canExport) {
      alert('Veuillez corriger les erreurs critiques avant d\'exporter');
      return;
    }

    const effectiveCoverData = coverData || generateCoverTemplate(currentProject);
    if (!effectiveCoverData) {
      alert('Couverture invalide. Veuillez réessayer.');
      return;
    }

    setIsExporting(true);
    setExportProgress('Création du package complet...');

    try {
      setExportProgress('Génération des fichiers du package...');
      const packageBlob = await createExportPackage(
        currentProject,
        effectiveCoverData,
        preflightReport
      );

      setExportProgress('Enregistrement du package...');

      const baseName = currentProject.title || 'book';
      await saveZipToFile(packageBlob, `${baseName}_kdp_package.zip`);

      setExportProgress('Package créé avec succès !');
      setTimeout(() => setExportProgress(null), 3000);
    } catch (error) {
      if (error?.canceled) {
        setExportProgress(null);
      } else {
        console.error('Package export failed:', error);
        alert('Erreur lors de la création du package : ' + error.message);
        setExportProgress(null);
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={64} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Aucun projet ouvert
          </h2>
          <p className="text-gray-500">
            Sélectionnez ou créez un projet pour exporter vers KDP
          </p>
        </div>
      </div>
    );
  }

  const printFormat = getPrintFormatInches(currentProject?.format);
  const resolutionIssues = preflightReport?.issuesByCategory?.[CATEGORY.RESOLUTION] || [];
  const resolutionReady = resolutionIssues.every(
    (issue) => issue.severity !== 'critical' && issue.severity !== 'info'
  );

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Export KDP Print
          </h1>
          <p className="text-gray-600">
            Vérification de conformité et export print-ready pour Amazon KDP
          </p>
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Informations du projet
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Titre</p>
              <p className="font-medium text-gray-900">{currentProject.title || 'Sans titre'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Auteur</p>
              <p className="font-medium text-gray-900">{currentProject.author || 'Non défini'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Format</p>
              <p className="font-medium text-gray-900">
                {printFormat.width.toFixed(2)}" × {printFormat.height.toFixed(2)}"
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pages</p>
              <p className="font-medium text-gray-900">{currentProject.pages?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Preflight Check */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Vérification de conformité KDP
            </h2>
            {isChecking && (
              <span className="text-sm text-gray-600">Vérification en cours...</span>
            )}
          </div>

          <PreflightReport
            report={preflightReport}
            onRecheck={runPreflight}
          />
        </div>

        {/* Export Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Export des fichiers
          </h2>

          {exportProgress && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <p className="text-blue-800 font-medium">{exportProgress}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Interior PDF */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <FileText className="text-blue-600" size={24} />
                <h3 className="font-semibold text-gray-900">PDF Intérieur</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Toutes les pages du livre avec marges perdues et résolution print
              </p>
              <button
                onClick={handleExportInterior}
                disabled={!preflightReport?.canExport || isExporting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Download size={16} />
                <span>Exporter</span>
              </button>
            </div>

            {/* Cover PDF */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <Image className="text-green-600" size={24} />
                <h3 className="font-semibold text-gray-900">PDF Couverture</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Couverture complète (dos + tranche + face) avec calcul automatique du spine
              </p>
              <button
                onClick={handleExportCover}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Download size={16} />
                <span>Exporter</span>
              </button>
            </div>

            {/* Complete Package */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <Package className="text-purple-600" size={24} />
                <h3 className="font-semibold text-gray-900">Package Complet</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Intérieur + Couverture + Rapport de vérification
              </p>
              <button
                onClick={handleExportArchive}
                disabled={!preflightReport?.canExport || isExporting}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Package size={16} />
                <span>Tout exporter</span>
              </button>
            </div>
          </div>

          {/* Export Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Spécifications d'export</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Résolution : 300 DPI (minimum KDP)</li>
              <li>• Marges perdues : 0.125" (bleed)</li>
              <li>• Polices : Embarquées automatiquement</li>
              <li>• Couleurs : Ajustement automatique pour l'impression</li>
              <li>• Format : PDF/X-1a compatible KDP</li>
            </ul>
          </div>
        </div>

        {/* Cover Configuration */}
        {coverData && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Configuration de la couverture
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Largeur totale</p>
                <p className="font-medium text-gray-900">
                  {coverData.dimensions.totalWidth.toFixed(3)}"
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Hauteur totale</p>
                <p className="font-medium text-gray-900">
                  {coverData.dimensions.totalHeight.toFixed(3)}"
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Largeur de la tranche</p>
                <p className="font-medium text-gray-900">
                  {coverData.dimensions.spineWidth.toFixed(3)}"
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type de papier</p>
                <p className="font-medium text-gray-900 capitalize">
                  {coverData.paperType}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="text-sm text-blue-800">
                💡 La couverture sera générée automatiquement avec le titre, l'auteur et un espace pour le code-barres KDP
              </p>
            </div>
          </div>
        )}

        {/* KDP Guidelines */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Checklist KDP
          </h2>
          <div className="space-y-2">
            <ChecklistItem
              checked={preflightReport?.summary.critical === 0}
              label="Aucune erreur critique"
            />
            <ChecklistItem
              checked={currentProject.pages?.length >= 24}
              label="Minimum 24 pages"
            />
            <ChecklistItem
              checked={printFormat.bleed >= 0.125}
              label='Marges perdues configurées (0.125")'
            />
            <ChecklistItem
              checked={coverData !== null}
              label="Couverture configurée"
            />
            <ChecklistItem
              checked={resolutionReady}
              label="Résolution 300 DPI minimum"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function ChecklistItem({ checked, label }) {
  return (
    <div className="flex items-center space-x-3">
      {checked ? (
        <CheckCircle className="text-green-600" size={20} />
      ) : (
        <AlertCircle className="text-orange-600" size={20} />
      )}
      <span className={checked ? 'text-gray-900' : 'text-gray-600'}>
        {label}
      </span>
    </div>
  );
}

export default ExportView;
