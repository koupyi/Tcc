describe('api client', () => {
  it('uses the API v1 path when VITE_API_URL is not configured', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.resetModules();

    const { apiClient } = await import('./client');
    const baseUrl = (apiClient as any).baseUrl;
    const expected = new URL('/api/v1', window.location.origin).toString();

    expect(baseUrl).toBe(expected);
  });
});
