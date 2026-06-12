import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  login: jest.fn(),
}));

// 1. Объявляем переменную на верхнем уровне модуля
let mockNavigate: jest.Mock;

// 2. jest.mock тоже должен быть на верхнем уровне
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Login.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 3. Инициализируем мок перед каждым тестом
    mockNavigate = jest.fn(); 
  });

  it('должен показывать ошибку, если поля пустые', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /войти в систему/i }));
    expect(await screen.findByText('Заполните логин и пароль')).toBeInTheDocument();
  });

  it('должен успешно выполнять вход и перенаправлять', async () => {
    (api.login as jest.Mock).mockResolvedValue({ username: 'admin', role: 'admin' });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('admin123'), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByRole('button', { name: /войти в систему/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('admin', 'admin123');
      expect(mockNavigate).toHaveBeenCalledWith('/admin/users', { replace: true });
    });
  });

  it('должен показывать ошибку API при неверных данных', async () => {
    (api.login as jest.Mock).mockRejectedValue(new Error('Неверный логин или пароль'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('admin123'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /войти в систему/i }));

    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();
  });
});