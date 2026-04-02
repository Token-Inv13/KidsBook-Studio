/** @jest-environment node */

import { buildIllustrationSelectionState, finalizePageIllustrationSelection } from './illustrationPersistence';

describe('illustrationPersistence', () => {
  test('builds a canonical illustration state for a selected page image', () => {
    const page = { id: 'page-1', number: 1 };
    const { imageAsset, illustration } = buildIllustrationSelectionState({
      page,
      localFileUrl: 'file:///tmp/page_1.png',
      localPath: '/tmp/page_1.png',
      sourceUrl: 'https://example.com/generated.png',
      variant: {
        revised_prompt: 'prompt revise',
        dalleParams: { size: '1024x1024' },
        variants: [
          { url: 'https://example.com/generated.png', consistencyScore: 0.81 },
          { url: 'https://example.com/generated-2.png', consistencyScore: 0.76 }
        ],
        autoSelected: true
      },
      generationMeta: {
        promptFinal: 'prompt final',
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        requestId: 'req_123',
        selectionMode: 'auto-best-result',
        fallbackAccepted: true,
        fallbackReason: 'all candidates rejected -> fallback triggered',
        finalDecisionType: 'fallback',
        autoSelectedVariantIndex: 0
      },
      timestamp: '2026-03-09T12:00:00.000Z'
    });

    expect(imageAsset.id).toBe('page-illustration:page-1');
    expect(imageAsset.localPath).toBe('/tmp/page_1.png');
    expect(imageAsset.promptFinal).toBe('prompt final');
    expect(illustration.assetId).toBe('page-illustration:page-1');
    expect(illustration.url).toBe('file:///tmp/page_1.png');
    expect(illustration.selectionMode).toBe('auto-best-result');
    expect(illustration.fallbackAccepted).toBe(true);
    expect(illustration.fallbackReason).toBe('all candidates rejected -> fallback triggered');
    expect(illustration.finalDecisionType).toBe('fallback');
    expect(illustration.autoSelected).toBe(true);
    expect(illustration.variants).toHaveLength(2);
  });

  test('downloads, validates and atomically associates a remote illustration to the page and image registry', async () => {
    const project = {
      id: 'project-1',
      path: '/projects/project-1',
      pages: [{ id: 'page-2', number: 2, textBlocks: [] }],
      images: []
    };
    const updateProject = jest.fn(async (updater) => updater(project));
    const bridge = {
      isElectronMode: () => true,
      fs: {
        downloadImage: jest.fn(async () => ({ success: true })),
        stat: jest.fn(async () => ({ success: true, isFile: true, size: 12000 }))
      }
    };

    await finalizePageIllustrationSelection({
      currentProject: project,
      page: project.pages[0],
      variant: {
        url: 'https://example.com/final.png',
        revised_prompt: 'prompt revise',
        dalleParams: { size: '1792x1024', quality: 'standard' }
      },
      generationMeta: {
        promptFinal: 'prompt final',
        model: 'dall-e-3',
        size: '1792x1024',
        quality: 'standard',
        requestId: 'req_456',
        createdAt: '2026-03-09T12:30:00.000Z'
      },
      updateProject,
      bridge
    });

    expect(bridge.fs.downloadImage).toHaveBeenCalledTimes(1);
    expect(updateProject).toHaveBeenCalledTimes(1);

    const updatedProject = await updateProject.mock.results[0].value;
    expect(updatedProject.images).toHaveLength(1);
    expect(updatedProject.images[0].pageId).toBe('page-2');
    expect(updatedProject.pages[0].imageAssetId).toBe('page-illustration:page-2');
    expect(updatedProject.pages[0].imageLocalPath).toContain('/projects/project-1/images/page_2_');
    expect(updatedProject.pages[0].illustration.assetId).toBe('page-illustration:page-2');
  });

  test('reuses an already local file without re-downloading it', async () => {
    const project = {
      id: 'project-2',
      path: '/projects/project-2',
      pages: [{ id: 'page-3', number: 3, textBlocks: [] }],
      images: []
    };
    const updateProject = jest.fn(async (updater) => updater(project));
    const bridge = {
      isElectronMode: () => true,
      fs: {
        downloadImage: jest.fn(async () => ({ success: true })),
        stat: jest.fn(async () => ({ success: true, isFile: true, size: 16000 }))
      }
    };

    await finalizePageIllustrationSelection({
      currentProject: project,
      page: project.pages[0],
      variant: {
        url: 'file:///projects/project-2/images/existing.png',
        localPath: '/projects/project-2/images/existing.png',
        revised_prompt: 'prompt revise'
      },
      generationMeta: {},
      updateProject,
      bridge
    });

    expect(bridge.fs.downloadImage).not.toHaveBeenCalled();
    const updatedProject = await updateProject.mock.results[0].value;
    expect(updatedProject.pages[0].imageLocalPath).toBe('/projects/project-2/images/existing.png');
  });
});
