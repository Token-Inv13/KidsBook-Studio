import JSZip from 'jszip';
import { exportCoverPDF, exportInteriorPDF } from './pdfExporter';
import { electronBridge } from './electronBridge';

export async function createExportPackage(project, coverData, preflightReport) {
  const interiorPDF = await exportInteriorPDF(project);
  const coverPDF = await exportCoverPDF(project, coverData);
  const zip = new JSZip();
  const safeBaseName = (project?.title || 'book')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim() || 'book';

  zip.file(`${safeBaseName}_interior.pdf`, interiorPDF);
  zip.file(`${safeBaseName}_cover.pdf`, coverPDF);
  zip.file('preflight-report.json', JSON.stringify(preflightReport || {}, null, 2));
  zip.file(
    'README.txt',
    [
      'KidsBook Studio export package',
      '',
      `Project: ${project?.title || 'Untitled'}`,
      `Author: ${project?.author || 'Unknown'}`,
      `Generated at: ${new Date().toISOString()}`,
      '',
      'Contents:',
      '- Interior PDF for KDP upload',
      '- Cover PDF for KDP upload',
      '- Preflight JSON report'
    ].join('\n')
  );

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

export async function saveZipToFile(zipBlob, filename) {
  const arrayBuffer = await zipBlob.arrayBuffer();
  const result = await electronBridge.saveFile({
    filename,
    data: arrayBuffer,
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (!result || result.canceled) {
    const error = new Error('Enregistrement annulé');
    error.canceled = true;
    throw error;
  }

  if (result.success === false) {
    throw new Error(result.error || 'Enregistrement impossible');
  }

  return result;
}
