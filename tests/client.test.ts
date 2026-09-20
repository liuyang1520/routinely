import { afterEach, expect, it, vi } from 'vitest';

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage } } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  sendMessage.mockReset();
});

it('never treats an invalidated content script as the local preview', async () => {
  const runtime: { id?: string } = { id: 'routinely-extension' };
  const localStorage = { getItem: vi.fn(), setItem: vi.fn() };
  const open = vi.fn();
  vi.stubGlobal('chrome', { runtime });
  vi.stubGlobal('location', { protocol: 'https:' });
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('window', { open });
  const client = await import('../lib/client');

  delete runtime.id;
  sendMessage.mockImplementation(() => {
    throw new Error('Extension context invalidated.');
  });
  await expect(client.readState()).rejects.toThrow('Extension context invalidated');
  await expect(client.dispatch({ type: 'scratchpad', value: 'Private note' })).rejects.toThrow(
    'Extension context invalidated',
  );
  await expect(client.openDashboard()).rejects.toThrow('Extension context invalidated');
  await expect(client.openLink('https://example.com')).rejects.toThrow(
    'Extension context invalidated',
  );
  expect(localStorage.getItem).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
