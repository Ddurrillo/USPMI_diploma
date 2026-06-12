import { decodeJwtPayload, getCurrentUser, clearSession, login } from './api';

// Мок fetch для теста login
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('api.ts', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('decodeJwtPayload', () => {
    it('должен корректно декодировать JWT payload', () => {
      // Base64 для {"Username":"admin","Role":"admin"}
      const token = 'header.eyJVc2VybmFtZSI6ImFkbWluIiwiUm9sZSI6ImFkbWluIn0.signature';
      const result = decodeJwtPayload(token);
      expect(result).toEqual({ Username: 'admin', Role: 'admin' });
    });
  });

  describe('getCurrentUser', () => {
    it('должен вернуть null, если токена нет', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('должен вернуть пользователя из localStorage', () => {
      localStorage.setItem('user', JSON.stringify({ username: 'tech', role: 'technologist' }));
      expect(getCurrentUser()).toEqual({ username: 'tech', role: 'technologist' });
    });
  });

  describe('clearSession', () => {
    it('должен очищать localStorage', () => {
      localStorage.setItem('authToken', 'fake-token');
      localStorage.setItem('user', 'fake-user');
      clearSession();
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('login', () => {
    it('должен успешно выполнять вход и сохранять токен', async () => {
      const fakeToken = 'header.eyJ1c2VybmFtZSI6ImFkbWluIiwiUm9sZSI6ImFkbWluIn0.signature';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: fakeToken }),
      } as Response);

      const user = await login('admin', 'admin123');
      
      expect(user).toEqual({ username: 'admin', role: 'admin' });
      expect(localStorage.getItem('authToken')).toBe(fakeToken);
    });

    it('должен выбрасывать ошибку при неверных данных', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Неверный логин или пароль' }),
      } as Response);

      await expect(login('bad', 'bad')).rejects.toThrow('Неверный логин или пароль');
    });
  });
});