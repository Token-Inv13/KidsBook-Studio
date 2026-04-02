/** @jest-environment node */

import {
  PROJECT_SCHEMA_VERSION,
  createCanonicalBookFormat,
  migrateProject,
  prepareProjectForSave,
  validateProjectSchema
} from './projectSchema';

describe('projectSchema', () => {
  test('creates a canonical format from legacy preset data', () => {
    const format = createCanonicalBookFormat({
      preset: '8x10 pouces',
      width: 8,
      height: 10,
      unit: 'inches',
      bleed: true
    });

    expect(format.id).toBe('8x10');
    expect(format.label).toBe('8x10 pouces');
    expect(format.preset).toBe('8x10 pouces');
    expect(format.bleed).toBe(0.125);
    expect(format.orientation).toBe('portrait');
  });

  test('migrates a legacy project to the versioned schema', () => {
    const migrated = migrateProject({
      id: 'project-1',
      title: 'Mon Livre',
      author: 'Auteur',
      targetAge: '3-5',
      bookType: 'album illustré',
      format: {
        preset: '8.5x8.5',
        width: 8.5,
        height: 8.5,
        unit: 'inches',
        bleed: true
      },
      pages: [
        {
          id: 'page-1',
          number: 1,
          template: 'mixte',
          textBlocks: [],
          imageUrl: 'file:///tmp/page-1.png',
          imageLocalPath: '/tmp/page-1.png',
          generationMeta: {
            promptSections: {
              invariantPrompt: 'VISUAL IDENTITY LOCK',
              stylePrompt: 'STYLE LOCK',
              palettePrompt: 'PALETTE LOCK'
            },
            promptTrace: {
              identityHash: 'abcd1234'
            },
            consistencyProfile: {
              faceHair: ['round', 'hair']
            },
            evaluation: {
              evaluationVersion: '2.0',
              componentScores: {
                identity: 0.82,
                style: 0.71
              }
            },
            generatorStrategy: {
              id: 'guided-generator',
              mode: 'guided'
            },
            constraintBundleSummary: {
              version: '2.0',
              referenceImageId: 'main-character-reference'
            },
            identityHash: 'abcd1234'
          }
        }
      ]
    });

    expect(migrated.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated.metadata.title).toBe('Mon Livre');
    expect(migrated.bookFormat.id).toBe('8.5x8.5');
    expect(migrated.format.id).toBe('8.5x8.5');
    expect(migrated.images).toHaveLength(1);
    expect(migrated.images[0].pageId).toBe('page-1');
    expect(migrated.images[0].promptSections?.invariantPrompt).toBe('VISUAL IDENTITY LOCK');
    expect(migrated.images[0].evaluation?.evaluationVersion).toBe('2.0');
    expect(migrated.images[0].generatorStrategy?.mode).toBe('guided');
    expect(migrated.images[0].constraintBundleSummary?.referenceImageId).toBe('main-character-reference');
    expect(migrated.images[0].identityHash).toBe('abcd1234');
  });

  test('validates an invalid project with readable errors', () => {
    const validation = validateProjectSchema({
      schemaVersion: 1,
      metadata: {},
      bookFormat: { id: '', width: 0, height: 8.5, unit: 'cm' },
      pages: [{ id: '', number: 0, textBlocks: null }],
      characters: {},
      images: {}
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      'bookFormat.id est requis.',
      'bookFormat.width doit etre un nombre positif.',
      'bookFormat.unit doit etre "inches" ou "mm".',
      'pages[0].id est requis.',
      'pages[0].number doit etre positif.',
      'pages[0].textBlocks doit etre un tableau.',
      'characters doit etre un tableau.',
      'images doit etre un tableau.'
    ]));
  });

  test('prepareProjectForSave normalizes and validates in one pass', () => {
    const prepared = prepareProjectForSave({
      id: 'project-2',
      title: 'Livre test',
      author: 'Auteur test',
      targetAge: '5-7',
      bookType: 'éducatif',
      format: { width: 210, height: 297, unit: 'mm', bleed: 3.2 },
      pages: []
    });

    expect(prepared.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(prepared.bookFormat.unit).toBe('mm');
    expect(prepared.metadata.author).toBe('Auteur test');
  });
});
