import React from 'react';
import { getStatusColor, getSeverityColor, CATEGORY } from '../utils/preflightCheck.js';

/**
 * Preflight Report Component
 * Displays KDP compliance check results
 */
function PreflightReport({ report, onRecheck }) {
  if (!report) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-600">Aucun rapport de vérification disponible</p>
        <button
          onClick={onRecheck}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Lancer la vérification
        </button>
      </div>
    );
  }

  const statusColor = getStatusColor(report.status);

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className={`${statusColor.bg} ${statusColor.border} border-2 rounded-lg p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`text-4xl ${statusColor.text}`}>
              {statusColor.icon}
            </div>
            <div>
              <h3 className={`text-2xl font-bold ${statusColor.text}`}>
                {statusColor.label}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Vérification effectuée le {new Date(report.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          <button
            onClick={onRecheck}
            className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Revérifier
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{report.summary.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{report.summary.critical}</div>
            <div className="text-sm text-gray-600">Critiques</div>
          </div>
          <div className="bg-white rounded p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{report.summary.warnings}</div>
            <div className="text-sm text-gray-600">Avertissements</div>
          </div>
          <div className="bg-white rounded p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{report.summary.info}</div>
            <div className="text-sm text-gray-600">Infos</div>
          </div>
        </div>

        {/* Export Status */}
        <div className="mt-4 p-4 bg-white rounded">
          {report.canExport ? (
            <p className="text-green-700 font-medium">
              ✓ Le livre peut être exporté
            </p>
          ) : (
            <p className="text-red-700 font-medium">
              ✕ Corrigez les erreurs critiques avant d'exporter
            </p>
          )}
        </div>
      </div>

      {/* Issues by Category */}
      {report.issues.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">Problèmes détectés</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {Object.entries(report.issuesByCategory).map(([category, issues]) => {
              if (issues.length === 0) return null;

              return (
                <CategorySection
                  key={category}
                  category={category}
                  issues={issues}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* No Issues */}
      {report.issues.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-4xl text-green-600 mb-2">✓</div>
          <h4 className="text-lg font-semibold text-green-900">Aucun problème détecté</h4>
          <p className="text-green-700 mt-2">
            Votre livre est conforme aux exigences KDP et prêt à être exporté.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Category Section Component
 */
function CategorySection({ category, issues }) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const categoryLabels = {
    [CATEGORY.PAGINATION]: 'Pagination',
    [CATEGORY.BLEED]: 'Marges perdues (Bleed)',
    [CATEGORY.SAFE_AREA]: 'Zone de sécurité',
    [CATEGORY.RESOLUTION]: 'Résolution des images',
    [CATEGORY.CONTENT]: 'Contenu',
    [CATEGORY.GUTTER]: 'Reliure (Gutter)',
    [CATEGORY.FONTS]: 'Polices'
  };

  return (
    <div className="p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-3">
          <span className="text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
          <h5 className="font-medium text-gray-900">
            {categoryLabels[category] || category}
          </h5>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
            {issues.length}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 ml-6">
          {issues.map((issue, index) => (
            <IssueCard key={index} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Issue Card Component
 */
function IssueCard({ issue }) {
  const severityColor = getSeverityColor(issue.severity);

  return (
    <div className={`${severityColor.bg} border-l-4 ${severityColor.text.replace('text-', 'border-')} p-4 rounded`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 ${severityColor.badge} text-xs font-medium rounded`}>
              {severityColor.label}
            </span>
            {issue.page && (
              <span className="text-xs text-gray-600">
                Page {issue.page}
              </span>
            )}
          </div>
          <p className={`font-medium ${severityColor.text} mb-1`}>
            {issue.message}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {issue.details}
          </p>
          {issue.fix && (
            <div className="flex items-start space-x-2 mt-2">
              <span className="text-xs text-gray-500">💡</span>
              <p className="text-sm text-gray-700 italic">
                {issue.fix}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PreflightReport;
