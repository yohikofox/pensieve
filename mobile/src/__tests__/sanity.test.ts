// Sanity test to validate Jest configuration works
describe('Jest Configuration', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should have access to Jest matchers', () => {
    expect([1, 2, 3]).toContain(2);
    expect({ foo: 'bar' }).toHaveProperty('foo');
  });
});
