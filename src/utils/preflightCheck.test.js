/** @jest-environment node */

import { runPreflightCheck, CATEGORY, SEVERITY } from './preflightCheck';

const createProject = (overrides = {}) => {
  const pages = Array.from({ length: 24 }, (_, index) => ({
    id: `p-${index + 1}`,
    number: index + 1,
    template: 'mixte',
    textBlocks: [
      {
        x: 120,
        y: 120,
        width: 200,
        height: 80,
        content: `Page ${index + 1}`
      }
    ]
  }));

  return {
    title: 'Test Book',
    author: 'Test Author',
    format: {
      width: 8.5,
      height: 8.5,
      unit: 'inches',
      bleed: true
    },
    pages,
    ...overrides
  };
};

describe('runPreflightCheck', () => {
  test('treats boolean bleed=true as valid KDP bleed amount', () => {
    const report = runPreflightCheck(createProject());

    const bleedCriticals = report.issues.filter(
      (issue) => issue.category === CATEGORY.BLEED && issue.severity === SEVERITY.CRITICAL
    );

    expect(bleedCriticals).toHaveLength(0);
  });

  test('accepts localized short-text template as intentionally minimal content', () => {
    const project = createProject({
      pages: [
        ...Array.from({ length: 23 }, (_, index) => ({
          id: `p-${index + 1}`,
          number: index + 1,
          template: 'mixte',
          textBlocks: [{ x: 120, y: 120, width: 200, height: 80, content: `Page ${index + 1}` }]
        })),
        {
          id: 'p-24',
          number: 24,
          template: 'texte-court',
          textBlocks: []
        }
      ]
    });

    const report = runPreflightCheck(project);

    const localizedTemplateEmptyIssue = report.issues.find(
      (issue) => issue.category === CATEGORY.CONTENT && issue.page === 24
    );

    expect(localizedTemplateEmptyIssue).toBeUndefined();
  });
});
