import { parseActionItems } from '../actionItemParser';

describe('parseActionItems', () => {
  it('parses valid compact JSON', () => {
    const content = '{"items":[{"title":"Simplifier les outils","deadline_text":null,"deadline_date":null,"target":null}]}';
    const result = parseActionItems(content);
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe('Simplifier les outils');
  });

  it('strips markdown code fence before parsing', () => {
    const content = '```json\n{"items":[{"title":"Test action","deadline_text":null,"deadline_date":null,"target":null}]}\n```';
    const result = parseActionItems(content);
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe('Test action');
  });

  it('repairs truncated JSON missing closing ]}', () => {
    // Simulates LLM stopping before closing the outer array and object
    const content = '{"items":[{"title":"Simplifier les outils pour les indépendants","deadline_text":null,"deadline_date":null,"target":"mes proches"}';
    const result = parseActionItems(content);
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe('Simplifier les outils pour les indépendants');
    expect(result![0].target).toBe('mes proches');
  });

  it('repairs truncated JSON wrapped in code fence', () => {
    // Exact reproduction of the bug from logs
    const content = '```json\n{"items":[{"title":"Simplifier les outils pour les indépendants","deadline_text":null,"deadline_date":null,"target":"mes proches"}\n```';
    const result = parseActionItems(content);
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe('Simplifier les outils pour les indépendants');
  });

  it('returns null when no items key found', () => {
    const result = parseActionItems('{"something":"else"}');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseActionItems('');
    expect(result).toBeNull();
  });

  it('returns empty array for {"items":[]}', () => {
    const result = parseActionItems('{"items":[]}');
    expect(result).toEqual([]);
  });

  it('handles multiple items', () => {
    const content = '{"items":[{"title":"Action 1","deadline_text":null,"deadline_date":null,"target":null},{"title":"Action 2","deadline_text":null,"deadline_date":null,"target":"Paul"}]}';
    const result = parseActionItems(content);
    expect(result).toHaveLength(2);
    expect(result![1].target).toBe('Paul');
  });
});
