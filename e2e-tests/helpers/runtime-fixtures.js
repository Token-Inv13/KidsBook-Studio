const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const keytar = require('keytar');

const SERVICE_NAME = 'KidsBookStudio';
const ACCOUNT_NAME = 'OpenAI_API_Key';
const ONE_PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHZ8xQAAAAASUVORK5CYII=';

const toSlug = (value) => String(value || 'runtime')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'runtime';

const toFileUrl = (targetPath) => {
  const normalizedPath = targetPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `file:///${normalizedPath}`;
  }
  return `file://${normalizedPath}`;
};

const hash8 = (value) => crypto.createHash('md5').update(JSON.stringify(value)).digest('hex').slice(0, 8);

const getUserDataPath = () => path.join(os.homedir(), 'Documents', 'KidsBookStudio');
const getProjectsPath = () => path.join(getUserDataPath(), 'Projects');
const getStorePath = () => path.join(getUserDataPath(), 'config.json');

async function ensureDir(targetPath) {
  await fsp.mkdir(targetPath, { recursive: true });
}

function createPageText(pageNumber, difficultMode) {
  if (!difficultMode) {
    return `Mia avance dans la foret lumineuse, garde son imper jaune et decouvre un nouveau detail magique a la page ${pageNumber}.`;
  }

  const difficultPrompts = [
    'Mia traverse une bibliotheque magique tres chargee mais l image finale doit rester une seule scene lisible de livre jeunesse avec Mia uniquement.',
    'Mia observe des objets complexes, des notes, des cartes et des tableaux dans un atelier enchante, sans transformer l image finale en design sheet.',
    'Mia vit une scene de tempete avec beaucoup d elements visuels potentiels mais le rendu doit rester propre, narratif, simple et centre sur Mia.',
    'Mia explore un laboratoire de lucioles avec beaucoup de details et de tentations de multi panneaux, tout en gardant une illustration finale unique.'
  ];

  return difficultPrompts[(pageNumber - 1) % difficultPrompts.length];
}

function createVisualIdentity(referenceImagePath) {
  const mainCharacter = {
    name: 'Mia',
    age: '6',
    appearance: 'round face, freckles, brown bob haircut',
    description: 'friendly child with a bright smile',
    clothing: 'yellow raincoat and blue boots',
    referencePrompt: 'canonical Mia reference, round face, freckles, brown bob haircut, yellow raincoat, blue boots',
    referenceImage: toFileUrl(referenceImagePath),
    referenceImagePath,
    referenceImageBase64: null,
    referenceImageMimeType: 'image/png',
    referenceImageId: 'main-character-reference',
    colorPalette: ['#F2C14E', '#4A90E2', '#F7E7CE']
  };
  const artStyle = {
    id: 'watercolor',
    prompt: 'soft watercolor illustration, gentle washes, children book style'
  };
  const lockedAttributes = {
    ...mainCharacter,
    artStyle
  };
  const promptSections = {
    invariantPrompt: 'VISUAL IDENTITY LOCK: keep the same hero Mia on every page. Preserve face shape, hairstyle silhouette, age impression, and signature outfit.',
    referencePrompt: 'REFERENCE LOCK: use the selected visual identity image as the canonical visual anchor for every page.',
    stylePrompt: 'STYLE LOCK: maintain a constant children book watercolor art direction with gentle washes and soft textures.',
    palettePrompt: 'PALETTE LOCK: keep the validated palette dominant across the whole book: #F2C14E, #4A90E2, #F7E7CE.',
    sceneGuardPrompt: 'SCENE LIMIT: only the action, background, framing, and composition may change while character identity remains fixed.',
    qualityPrompt: 'QUALITY RULES: no redesign, no alternative character, no text, no watermark, no palette chart, no style drift.',
    negativePrompt: 'text, letters, watermark, palette chart, color chart, different face, different hairstyle, different outfit, style drift, palette drift'
  };

  const visualIdentitySpec = {
    version: '2.0',
    mainCharacter,
    artStyle,
    invariants: [
      'Conserver Mia avec la meme morphologie et les memes traits.',
      'Reference image lock: the selected visual identity image is canonical and must be replicated exactly.',
      'Palette verrouillee: #F2C14E, #4A90E2, #F7E7CE',
      'Le style artistique, le rendu et la texture doivent rester constants sur tout le livre.'
    ],
    promptProfile: {
      version: '2.0',
      identityHash: hash8({ mainCharacter, artStyle }),
      promptSections,
      consistencyAnchors: {
        faceHair: ['round', 'freckles', 'brown', 'bob', 'haircut'],
        age: ['6-year-old'],
        clothing: ['yellow', 'raincoat', 'blue', 'boots'],
        style: ['soft', 'watercolor', 'children', 'book'],
        palette: ['#F2C14E', '#4A90E2', '#F7E7CE']
      },
      lockedAttributes
    }
  };

  const visualIdentity = {
    validated: true,
    validatedAt: new Date().toISOString(),
    artisticStyle: artStyle.id,
    stylePrompt: artStyle.prompt,
    mainCharacter
  };

  return {
    visualIdentity,
    visualIdentitySpec
  };
}

function createProjectObject({ projectId, title, pagesCount, difficultMode, projectPath, savePath, referenceImagePath }) {
  const createdAt = new Date().toISOString();
  const { visualIdentity, visualIdentitySpec } = createVisualIdentity(referenceImagePath);

  const pages = Array.from({ length: pagesCount }, (_, index) => ({
    id: `page-${index + 1}`,
    number: index + 1,
    position: index % 2 === 0 ? 'left' : 'right',
    template: 'mixte',
    textBlocks: [
      {
        id: `text-${index + 1}`,
        content: createPageText(index + 1, difficultMode)
      }
    ],
    imageZones: [],
    generationMeta: {}
  }));

  return {
    id: projectId,
    schemaVersion: 1,
    title,
    author: 'Codex E2E',
    targetAge: '5-7',
    bookType: 'album illustré',
    summary: 'Livre de test runtime pour valider le pipeline d’illustration.',
    description: 'Projet de test Electron + Playwright.',
    createdAt,
    updatedAt: createdAt,
    savePath,
    path: projectPath,
    metadata: {
      title,
      author: 'Codex E2E',
      targetAge: '5-7',
      bookType: 'album illustré',
      summary: 'Livre de test runtime pour valider le pipeline d’illustration.',
      description: 'Projet de test Electron + Playwright.',
      language: 'fr',
      tags: ['e2e', 'runtime']
    },
    bookFormat: {
      id: '8x10',
      label: '8x10 pouces',
      preset: '8x10 pouces',
      width: 8,
      height: 10,
      unit: 'inches',
      bleed: 0.125,
      orientation: 'portrait'
    },
    format: {
      id: '8x10',
      label: '8x10 pouces',
      preset: '8x10 pouces',
      width: 8,
      height: 10,
      unit: 'inches',
      bleed: 0.125,
      orientation: 'portrait'
    },
    pages,
    characters: [
      {
        name: 'Mia',
        description: 'Friendly child with a bright smile'
      }
    ],
    locations: [],
    artStyle: 'watercolor',
    visualIdentity,
    visualIdentitySpec,
    chatHistory: [],
    images: [],
    versions: [],
    generationMeta: {},
    coverData: null
  };
}

async function seedProjects(projects) {
  const userDataPath = getUserDataPath();
  const projectsPath = getProjectsPath();
  const storePath = getStorePath();

  await ensureDir(userDataPath);
  await ensureDir(projectsPath);

  let previousStoreContents = null;
  try {
    previousStoreContents = await fsp.readFile(storePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  for (const project of projects) {
    await ensureDir(project.path);
    await ensureDir(path.join(project.path, 'images'));
    await ensureDir(path.join(project.path, 'exports'));
    await ensureDir(path.join(project.path, 'versions'));
    await fsp.writeFile(path.join(project.path, 'project.json'), JSON.stringify(project, null, 2), 'utf8');
  }

  await fsp.writeFile(storePath, JSON.stringify({ projects }, null, 2), 'utf8');

  return async () => {
    for (const project of projects) {
      await fsp.rm(project.path, { recursive: true, force: true });
    }

    if (previousStoreContents == null) {
      await fsp.rm(storePath, { force: true });
    } else {
      await fsp.writeFile(storePath, previousStoreContents, 'utf8');
    }
  };
}

async function createSeededProjectSet(testName, variants) {
  const projectsPath = getProjectsPath();
  const savePath = projectsPath;
  const teardownProjects = [];
  const projects = [];

  for (const variant of variants) {
    const projectId = `e2e-${toSlug(testName)}-${toSlug(variant.slug || variant.title)}-${crypto.randomUUID().slice(0, 8)}`;
    const projectPath = path.join(projectsPath, projectId);
    const referenceImagePath = path.join(projectPath, 'images', 'reference.png');
    await ensureDir(path.dirname(referenceImagePath));
    await fsp.writeFile(referenceImagePath, Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));

    const project = createProjectObject({
      projectId,
      title: variant.title,
      pagesCount: variant.pagesCount,
      difficultMode: Boolean(variant.difficultMode),
      projectPath,
      savePath,
      referenceImagePath
    });

    projects.push(project);
    teardownProjects.push(project);
  }

  const restore = await seedProjects(projects);
  return {
    projects,
    cleanup: restore
  };
}

async function readProjectFromDisk(projectPath) {
  const projectFile = path.join(projectPath, 'project.json');
  const contents = await fsp.readFile(projectFile, 'utf8');
  return JSON.parse(contents);
}

async function hasConfiguredApiKey() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return true;
  }

  try {
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return Boolean(apiKey);
  } catch (error) {
    return false;
  }
}

async function ensureRuntimeApiKey(page) {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    await page.evaluate(async (apiKey) => {
      await window.electron.apiKey.set(apiKey);
      const port = await window.electron.openai.getPort();
      await fetch(`http://localhost:${port}/api/reinitialize`, { method: 'POST' });
    }, process.env.OPENAI_API_KEY.trim());
    return true;
  }

  const result = await page.evaluate(async () => window.electron.apiKey.get());
  return Boolean(result?.success && result?.apiKey);
}

async function copyGeneratedImages(project, targetDir) {
  await ensureDir(targetDir);
  const copies = [];

  for (const page of project.pages || []) {
    const sourcePath = page.imageLocalPath || page.illustration?.localPath;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      continue;
    }

    const fileName = `page-${String(page.number).padStart(2, '0')}.png`;
    const destinationPath = path.join(targetDir, fileName);
    await fsp.copyFile(sourcePath, destinationPath);
    copies.push(destinationPath);
  }

  return copies;
}

function summarizeProjectRun(project) {
  const pages = project.pages || [];
  const generatedPages = pages.filter((page) => page.imageLocalPath || page.illustration?.localPath);
  const fallbackPages = pages.filter((page) => page.generationMeta?.fallbackAccepted || page.illustration?.fallbackAccepted);
  const failedPages = pages.filter((page) => !page.imageLocalPath && !page.illustration?.localPath);
  const scores = generatedPages
    .map((page) => page.illustration?.consistencyScore ?? page.generationMeta?.evaluation?.score)
    .filter((value) => Number.isFinite(value));
  const averageScore = scores.length > 0
    ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(3))
    : null;

  return {
    totalPages: pages.length,
    generatedPages: generatedPages.length,
    fallbackPages: fallbackPages.length,
    failedPages: failedPages.length,
    averageScore
  };
}

async function appendRuntimeResult(entry) {
  const rootDir = path.join(__dirname, '..', '..');
  const resultsPath = path.join(rootDir, 'test-results', 'runtime-results.json');
  await ensureDir(path.dirname(resultsPath));

  let existing = [];
  try {
    existing = JSON.parse(await fsp.readFile(resultsPath, 'utf8'));
    if (!Array.isArray(existing)) {
      existing = [];
    }
  } catch (error) {
    existing = [];
  }

  existing.push(entry);
  await fsp.writeFile(resultsPath, JSON.stringify(existing, null, 2), 'utf8');
}

module.exports = {
  appendRuntimeResult,
  copyGeneratedImages,
  createSeededProjectSet,
  ensureRuntimeApiKey,
  getProjectsPath,
  hasConfiguredApiKey,
  readProjectFromDisk,
  summarizeProjectRun,
  toSlug
};
