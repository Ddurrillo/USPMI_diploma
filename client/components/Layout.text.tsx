import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getCurrentUser: jest.fn(),
  clearSession: jest.fn(),
}));

describe('Layout.tsx', () => {
  const mockNavigate = jest.fn();
  
  // Мокаем useNavigate из react-router-dom
  jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/operator/work' }),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('должен отображать меню оператора для роли operator', () => {
    (api.getCurrentUser as jest.Mock).mockReturnValue({ username: 'op1', role: 'operator' });
    
    render(
      <MemoryRouter>
        <Layout><div>Content</div></Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('Оператор')).toBeInTheDocument();
    expect(screen.getByText('Назначенные работы')).toBeInTheDocument();
    expect(screen.getByText('Диспетчерская панель')).toBeInTheDocument();
  });

  it('должен вызывать clearSession и navigate при выходе', () => {
    (api.getCurrentUser as jest.Mock).mockReturnValue({ username: 'admin', role: 'admin' });
    
    render(
      <MemoryRouter>
        <Layout><div>Content</div></Layout>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Выйти из системы'));
    
    expect(api.clearSession).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});