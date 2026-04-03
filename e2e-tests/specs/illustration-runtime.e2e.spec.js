const path = require('path');
const fs = require('fs/promises');
const { test, expect, _electron: electron } = require('@playwright/test');
const {
  appendRuntimeResult,
  copyGeneratedImages,
  createSeededProjectSet,
  ensureRuntimeApiKey,
  hasConfiguredApiKey,
  readProjectFromDisk,
  summarizeProjectRun,
  toSlug
} = require('../helpers/runtime-fixtures');

async function launchElectronApp() {
  const electronApp = await electron.launch({
    args: ['electron/main.js'],
    env: {
      ...process.env,
      ELECTRON_USE_LOCAL_BUILD: '1',
      KIDSBOOK_E2E: '1',
      ELECTRON_DISABLE_DEVTOOLS: '1'
    }
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('nav-projects')).toBeVisible();

  return { electronApp, page };
}

async function openSeededProject(page, project) {
  await page.getByTestId('nav-projects').click();
  await expect(page.getByTestId(`project-card-${project.id}`)).toBeVisible();
  await page.getByTestId(`project-card-${project.id}`).click();
  await expect(page.getByTestId('current-project-title')).toHaveText(project.title);
}

async function runBatchGeneration(page, project, { timeoutMs }) {
  await page.getByTestId('nav-illustrations').click();
  await expect(page.getByTestId('generate-all-illustrations')).toBeVisible();
  await page.getByTestId('generate-all-illustrations').click();

  await expect
    .poll(async () => {
      const persistedProject = await readProjectFromDisk(project.path);
      return (persistedProject.pages || []).filter((entry) => entry.imageLocalPath || entry.illustration?.localPath).length;
    }, {
      timeout: timeoutMs,
      intervals: [2000, 5000, 7000, 10000]
    })
    .toBe(project.pages.length);

  await expect(page.getByTestId('illustrations-error')).toHaveCount(0);
  return readProjectFromDisk(project.path);
}

async function recordArtifacts(testInfo, name, page, project, extra = {}) {
  const slug = toSlug(name);
  const screenshotDir = path.join(testInfo.config.rootDir, '..', 'test-results', 'screenshots', slug);
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, 'app.png'),
    fullPage: true
  });

  const copiedImages = await copyGeneratedImages(project, screenshotDir);
  await appendRuntimeResult({
    testName: name,
    status: extra.status || 'passed',
    durationMs: extra.durationMs || null,
    fallbackPages: extra.fallbackPages || 0,
    averageScore: extra.averageScore || null,
    failedPages: extra.failedPages || 0,
    generatedPages: extra.generatedPages || 0,
    errors: extra.errors || [],
    screenshots: copiedImages
  });
}

test.describe('KidsBook Studio runtime Electron illustration pipeline', () => {
  test('TEST 1 - lancement app', async ({}, testInfo) => {
    let electronApp;
    let page;

    try {
      ({ electronApp, page } = await launchElectronApp());
      await expect(page.getByRole('heading', { name: 'KidsBook Studio' })).toBeVisible();
      await expect(page.getByTestId('nav-projects')).toBeVisible();
      await expect(page.getByTestId('nav-illustrations')).toBeVisible();

      await recordArtifacts(testInfo, 'test-1-launch', page, { pages: [] }, {
        generatedPages: 0,
        fallbackPages: 0,
        failedPages: 0
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
    }
  });

  test('TEST 2 - chargement projet', async ({}, testInfo) => {
    const seeded = await createSeededProjectSet('test-2-load-project', [
      { title: 'E2E Load Project', pagesCount: 2 }
    ]);
    let electronApp;
    let page;

    try {
      ({ electronApp, page } = await launchElectronApp());
      await openSeededProject(page, seeded.projects[0]);

      await page.getByTestId('nav-characters').click();
      await expect(page.getByText('Identité visuelle validée')).toBeVisible();
      await expect(page.getByTestId('character-reference-image')).toBeVisible();

      await recordArtifacts(testInfo, 'test-2-load-project', page, seeded.projects[0], {
        generatedPages: 0,
        fallbackPages: 0,
        failedPages: 0
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await seeded.cleanup();
    }
  });

  test('TEST 3 - génération complète batch critique', async ({}, testInfo) => {
    test.skip(!(await hasConfiguredApiKey()), 'OpenAI API key required for live image generation.');
    test.setTimeout(12 * 60 * 1000);

    const seeded = await createSeededProjectSet('test-3-full-batch', [
      { title: 'E2E Full Batch', pagesCount: 8 }
    ]);
    let electronApp;
    let page;
    const start = Date.now();

    try {
      ({ electronApp, page } = await launchElectronApp());
      await ensureRuntimeApiKey(page);
      await openSeededProject(page, seeded.projects[0]);

      const persistedProject = await runBatchGeneration(page, seeded.projects[0], {
        timeoutMs: 10 * 60 * 1000
      });
      const summary = summarizeProjectRun(persistedProject);

      expect(summary.failedPages).toBe(0);
      expect(summary.generatedPages).toBe(8);

      await recordArtifacts(testInfo, 'test-3-full-batch', page, persistedProject, {
        durationMs: Date.now() - start,
        generatedPages: summary.generatedPages,
        fallbackPages: summary.fallbackPages,
        failedPages: summary.failedPages,
        averageScore: summary.averageScore
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await seeded.cleanup();
    }
  });

  test('TEST 4 - cohérence minimale des images générées', async ({}, testInfo) => {
    test.skip(!(await hasConfiguredApiKey()), 'OpenAI API key required for live image generation.');
    test.setTimeout(10 * 60 * 1000);

    const seeded = await createSeededProjectSet('test-4-coherence', [
      { title: 'E2E Coherence', pagesCount: 4 }
    ]);
    let electronApp;
    let page;

    try {
      ({ electronApp, page } = await launchElectronApp());
      await ensureRuntimeApiKey(page);
      await openSeededProject(page, seeded.projects[0]);

      const persistedProject = await runBatchGeneration(page, seeded.projects[0], {
        timeoutMs: 4 * 60 * 1000
      });

      const parasiteKeys = new Set(['colorPalettePanel', 'gridLayout', 'designSheet', 'colorSwatch']);
      for (const generatedPage of persistedProject.pages) {
        const detectedArtifacts = [
          ...(generatedPage.illustration?.detectedNonNarrativeArtifacts || []),
          ...(generatedPage.generationMeta?.consistencyProfile?.detectedNonNarrativeArtifacts || []),
          ...(generatedPage.generationMeta?.evaluation?.detectedNonNarrativeArtifacts || [])
        ];
        const hardRejectedArtifacts = [
          ...(generatedPage.illustration?.hardRejectedArtifacts || []),
          ...(generatedPage.generationMeta?.consistencyProfile?.hardRejectedArtifacts || []),
          ...(generatedPage.generationMeta?.evaluation?.hardRejectedArtifacts || [])
        ];
        const score = generatedPage.illustration?.consistencyScore ?? generatedPage.generationMeta?.evaluation?.score ?? 0;
        const fallbackAccepted = Boolean(generatedPage.illustration?.fallbackAccepted || generatedPage.generationMeta?.fallbackAccepted);
        const finalDecisionType = generatedPage.illustration?.finalDecisionType || generatedPage.generationMeta?.finalDecisionType || 'accepted';
        const hardRejectSeverity = generatedPage.illustration?.hardRejectSeverity || generatedPage.generationMeta?.evaluation?.hardRejectSeverity || 'none';
        const parasiteArtifactsDetected = detectedArtifacts.filter((artifact) => parasiteKeys.has(artifact.key));
        const hardRejectedParasiteArtifacts = hardRejectedArtifacts.filter((artifact) => parasiteKeys.has(artifact.key));

        expect(generatedPage.imageLocalPath || generatedPage.illustration?.localPath).toBeTruthy();
        if (fallbackAccepted) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(finalDecisionType).toMatch(/fallback/);
        } else {
          expect(score).toBeGreaterThan(0);
        }

        if (hardRejectedParasiteArtifacts.length > 0 || hardRejectSeverity === 'strong') {
          expect(fallbackAccepted).toBe(true);
          expect(finalDecisionType).toMatch(/fallback/);
        }

        if (!fallbackAccepted) {
          expect(parasiteArtifactsDetected).toEqual([]);
          expect(hardRejectedParasiteArtifacts).toEqual([]);
        }
      }

      const summary = summarizeProjectRun(persistedProject);
      await recordArtifacts(testInfo, 'test-4-coherence', page, persistedProject, {
        generatedPages: summary.generatedPages,
        fallbackPages: summary.fallbackPages,
        failedPages: summary.failedPages,
        averageScore: summary.averageScore
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await seeded.cleanup();
    }
  });

  test('TEST 5 - pipeline fallback sur cas difficile', async ({}, testInfo) => {
    test.skip(!(await hasConfiguredApiKey()), 'OpenAI API key required for live image generation.');
    test.setTimeout(10 * 60 * 1000);

    const seeded = await createSeededProjectSet('test-5-fallback', [
      { title: 'E2E Fallback', pagesCount: 4, difficultMode: true }
    ]);
    let electronApp;
    let page;

    try {
      ({ electronApp, page } = await launchElectronApp());
      await ensureRuntimeApiKey(page);
      await openSeededProject(page, seeded.projects[0]);

      const persistedProject = await runBatchGeneration(page, seeded.projects[0], {
        timeoutMs: 6 * 60 * 1000
      });
      const summary = summarizeProjectRun(persistedProject);
      const fallbackPages = persistedProject.pages.filter((entry) => entry.generationMeta?.fallbackAccepted || entry.illustration?.fallbackAccepted);

      expect(summary.failedPages).toBe(0);
      expect(fallbackPages.length).toBeGreaterThan(0);

      await recordArtifacts(testInfo, 'test-5-fallback', page, persistedProject, {
        generatedPages: summary.generatedPages,
        fallbackPages: summary.fallbackPages,
        failedPages: summary.failedPages,
        averageScore: summary.averageScore
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await seeded.cleanup();
    }
  });

  test('TEST 6 - performance batch 8 pages', async ({}, testInfo) => {
    test.skip(!(await hasConfiguredApiKey()), 'OpenAI API key required for live image generation.');
    test.setTimeout(12 * 60 * 1000);

    const thresholdMs = Number(process.env.KIDSBOOK_E2E_BATCH_THRESHOLD_MS || 480000);
    const seeded = await createSeededProjectSet('test-6-performance', [
      { title: 'E2E Performance', pagesCount: 8 }
    ]);
    let electronApp;
    let page;
    const start = Date.now();

    try {
      ({ electronApp, page } = await launchElectronApp());
      await ensureRuntimeApiKey(page);
      await openSeededProject(page, seeded.projects[0]);

      const persistedProject = await runBatchGeneration(page, seeded.projects[0], {
        timeoutMs: 10 * 60 * 1000
      });
      const durationMs = Date.now() - start;
      const summary = summarizeProjectRun(persistedProject);

      expect(summary.failedPages).toBe(0);
      expect(durationMs).toBeLessThan(thresholdMs);

      await recordArtifacts(testInfo, 'test-6-performance', page, persistedProject, {
        durationMs,
        generatedPages: summary.generatedPages,
        fallbackPages: summary.fallbackPages,
        failedPages: summary.failedPages,
        averageScore: summary.averageScore
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await seeded.cleanup();
    }
  });

  test('TEST 7 - robustesse sur 3 générations consécutives', async ({}, testInfo) => {
    test.skip(!(await hasConfiguredApiKey()), 'OpenAI API key required for live image generation.');
    test.setTimeout(15 * 60 * 1000);

    const seeded = await createSeededProjectSet('test-7-robustesse', [
      { title: 'E2E Robustness A', pagesCount: 2 },
      { title: 'E2E Robustness B', pagesCount: 2, difficultMode: true },
      { title: 'E2E Robustness C', pagesCount: 2 }
    ]);
    let electronApp;
    let page;
    const errors = [];
    let generatedPages = 0;
    let fallbackPages = 0;

    try {
      ({ electronApp, page } = await launchElectronApp());
      await ensureRuntimeApiKey(page);

      for (const project of seeded.projects) {
        await openSeededProject(page, project);
        const persistedProject = await runBatchGeneration(page, project, {
          timeoutMs: 6 * 60 * 1000
        });
        const summary = summarizeProjectRun(persistedProject);

        if (summary.failedPages > 0) {
          errors.push(`Project ${project.title} failed with ${summary.failedPages} page(s).`);
        }

        generatedPages += summary.generatedPages;
        fallbackPages += summary.fallbackPages;
      }

      expect(errors).toEqual([]);

      await recordArtifacts(testInfo, 'test-7-robustesse', page, seeded.projects[seeded.projects.length - 1], {
        generatedPages,
        fallbackPages,
        failedPages: errors.length,
        errors
      });
    } finally {
      if (electronApp) {
        await electronApp.close();
      }
      await seeded.cleanup();
    }
  });
});
