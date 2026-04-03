/** @jest-environment node */

import {
  fallbackImageProvider,
  imageProviderIdeogram,
  imageProviderOpenAI,
  selectPrimaryImageProvider
} from './imageProviders';

describe('imageProviders', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        url: 'https://example.com/generated.png',
        revised_prompt: 'A generated image',
        requestId: 'req-123',
        images: [
          {
            url: 'https://example.com/generated.png',
            prompt: 'A generated image',
            style_type: 'GENERAL',
            seed: 7,
            resolution: '1024x1024',
            is_image_safe: true
          }
        ]
      })
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('selects Ideogram as primary when available and OpenAI as fallback', () => {
    expect(selectPrimaryImageProvider({
      ideogramServiceUrl: 'http://localhost:3002',
      openaiServiceUrl: 'http://localhost:3001'
    })).toBe('ideogram');

    expect(fallbackImageProvider('ideogram')).toBe('openai');
    expect(fallbackImageProvider('openai')).toBeNull();
  });

  test('builds an Ideogram generate payload with character and style references', async () => {
    const provider = imageProviderIdeogram({ serviceUrl: 'http://localhost:3002' });

    const result = await provider.generateCandidate({
      prompt: 'A child in a rainy village',
      dalleParams: { size: '1024x1792' },
      constraintBundle: {
        characterPack: {
          canonicalReference: {
            url: 'file:///tmp/character.png',
            path: '/tmp/character.png',
            mimeType: 'image/png'
          },
          referenceImages: [
            {
              path: '/tmp/character.png',
              mimeType: 'image/png'
            }
          ]
        },
        stylePack: {
          canonicalReference: {
            url: 'file:///tmp/character.png',
            path: '/tmp/character.png',
            mimeType: 'image/png'
          },
          referenceImages: [
            {
              path: '/tmp/character.png',
              mimeType: 'image/png'
            }
          ]
        },
        palette: ['#F2C14E', '#4A90E2'],
        reference: {
          imagePath: '/tmp/character.png'
        }
      },
      strategyMetadata: {
        negativePrompt: 'no text'
      },
      variantIndex: 2
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.mode).toBe('generate');
    expect(body.resolution).toBe('1024x1792');
    expect(body.character_reference_images).toHaveLength(1);
    expect(body.style_reference_images).toHaveLength(1);
    expect(body.image).toBeNull();
    expect(result.url).toBe('https://example.com/generated.png');
  });

  test('builds an Ideogram remix payload with the selected source image', async () => {
    const provider = imageProviderIdeogram({ serviceUrl: 'http://localhost:3002' });

    await provider.remixCandidate({
      prompt: 'A child in a rainy village',
      dalleParams: { size: '1024x1792' },
      constraintBundle: {
        selectedImage: 'https://example.com/source.png',
        characterPack: {
          canonicalReference: {
            url: 'file:///tmp/character.png',
            path: '/tmp/character.png',
            mimeType: 'image/png'
          }
        },
        stylePack: {
          canonicalReference: {
            url: 'file:///tmp/character.png',
            path: '/tmp/character.png',
            mimeType: 'image/png'
          }
        },
        reference: {
          imagePath: '/tmp/character.png'
        }
      },
      strategyMetadata: {
        negativePrompt: 'no text'
      },
      variantIndex: 0
    });

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.mode).toBe('remix');
    expect(body.image).toBe('https://example.com/source.png');
    expect(body.image_weight).toBe(65);
  });

  test('builds the OpenAI fallback payload used by the local service', async () => {
    const provider = imageProviderOpenAI({ serviceUrl: 'http://localhost:3001' });

    const result = await provider.generateCandidate({
      prompt: 'A child in a rainy village',
      dalleParams: { size: '1024x1024' },
      strategyMetadata: {
        mode: 'guided'
      },
      referenceImageId: 'main-character-reference',
      referenceImagePath: '/tmp/character.png'
    });

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.referenceImageId).toBe('main-character-reference');
    expect(body.referenceImagePath).toBe('/tmp/character.png');
    expect(body.generatorMode).toBe('guided');
    expect(result.url).toBe('https://example.com/generated.png');
  });
});
