import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManagerStatistics from './Statistics';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiRequest: jest.fn(),
}));
jest.mock('@/components/Layout', () => ({ children }: any) => <div>{children}</div>);

describe('ManagerStatistics.tsx', () => {
  const mockStats = {
    period: 'month',
    total_orders: 42,
    by_recipe: [{ RecipeID: 1, Count: 10 }],
    material_usage_kg: [{ MaterialID: 1, MaterialName: 'Steel', TotalMass: 100 }],
    compound_usage_kg: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.apiRequest as jest.Mock).mockResolvedValue(mockStats);
  });

  it('должен отображать статистику за месяц по умолчанию', async () => {
    render(
      <MemoryRouter>
        <ManagerStatistics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/api/manager/stats?period=month');
    });
    expect(screen.getByText('42')).toBeInTheDocument(); // total_orders
  });

  it('должен запрашивать новые данные при смене периода на "Неделя"', async () => {
    render(
      <MemoryRouter>
        <ManagerStatistics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalled();
    });

    jest.clearAllMocks(); // Сбрасываем вызовы начальной загрузки

    fireEvent.click(screen.getByText('Неделя'));

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/api/manager/stats?period=week');
    });
  });
});