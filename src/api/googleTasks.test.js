import { describe, it, expect, vi, afterEach } from 'vitest';
import * as api from './googleTasks';

function mockFetchOnce(status, body = {}) {
  global.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

afterEach(() => { vi.restoreAllMocks(); });

describe('googleTasks HTTP 오류 처리', () => {
  it('createTask: 성공 시 json 반환', async () => {
    mockFetchOnce(200, { id: 'g1' });
    await expect(api.createTask('t', 'L', { title: 'x' })).resolves.toEqual({ id: 'g1' });
  });

  it('createTask: 실패(500) 시 throw → 큐에 남아 재시도됨', async () => {
    mockFetchOnce(500, {});
    await expect(api.createTask('t', 'L', { title: 'x' })).rejects.toThrow('HTTP 500');
  });

  it('patchTask: 실패(401) 시 throw', async () => {
    mockFetchOnce(401, {});
    await expect(api.patchTask('t', 'L', 'id', { status: 'completed' })).rejects.toThrow('HTTP 401');
  });

  it('deleteTask: 404/410은 성공으로 취급(idempotent)', async () => {
    mockFetchOnce(404, {});
    await expect(api.deleteTask('t', 'L', 'gone')).resolves.toBeUndefined();
    mockFetchOnce(410, {});
    await expect(api.deleteTask('t', 'L', 'gone')).resolves.toBeUndefined();
  });

  it('deleteTask: 진짜 실패(500)는 throw', async () => {
    mockFetchOnce(500, {});
    await expect(api.deleteTask('t', 'L', 'id')).rejects.toThrow('HTTP 500');
  });

  it('fetchTasks: 실패 시 throw(상위 load가 캐시 폴백)', async () => {
    mockFetchOnce(403, {});
    await expect(api.fetchTasks('t', 'L')).rejects.toThrow('HTTP 403');
  });
});
