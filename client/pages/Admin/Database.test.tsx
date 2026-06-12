import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDatabase from './Database';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiRequest: jest.fn(),
}));

// Мокаем Layout, чтобы не тащить всю боковую панель
jest.mock('@/components/Layout', () => ({ children }: any) => <div>{children}</div>);

describe('AdminDatabase.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.apiRequest as jest.Mock).mockResolvedValue({
      tables: ['users', 'materials'],
      schemas: { users: [{ name: 'id', type: 'number', editable: false, primary: true }] }
    });
  });

  it('должен загружать таблицы при монтировании', async () => {
    render(
      <MemoryRouter>
        <AdminDatabase />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/api/admin/tables');
    });
    expect(screen.getByText('Администрирование БД')).toBeInTheDocument();
  });

  it('должен фильтровать строки при вводе в поиск', async () => {
    (api.apiRequest as jest.Mock).mockResolvedValueOnce({ tables: ['users'] })
      .mockResolvedValueOnce([{ id: 1, Username: 'admin_user', Role: 'admin' }]);

    render(
      <MemoryRouter>
        <AdminDatabase />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Поиск по строкам'), { target: { value: 'nothing' } });
    
    expect(screen.queryByText('admin_user')).not.toBeInTheDocument();
  });
});