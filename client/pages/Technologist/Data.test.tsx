import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TechData from './Data';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiRequest: jest.fn(),
}));
jest.mock('@/components/Layout', () => ({ children }: any) => <div>{children}</div>);

describe('TechData.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.apiRequest as jest.Mock)
      .mockResolvedValueOnce([{ ID: 1, Name: 'Стеклоткань', Porosity: 0.4, Density: 1500, CriticalTemperature: 200, CapillaryRadius: 0.01, CapillaryLength: 10 }]) // materials
      .mockResolvedValueOnce([{ ID: 1, Name: 'Эпоксидка', CriticalTemperature: 80 }]) // compounds
      .mockResolvedValueOnce([]); // properties - пустой массив
  });
  it('должен загружать материалы и компаунды', async () => {
    render(
      <MemoryRouter>
        <TechData />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Стеклоткань')).toBeInTheDocument();
      expect(screen.getByText('Эпоксидка')).toBeInTheDocument();
    });
  });

  it('должен открывать модальное окно для добавления материала', async () => {
    render(
      <MemoryRouter>
        <TechData />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('Стеклоткань'));

    const buttons = screen.getAllByRole('button', { name: /добавить/i });
    fireEvent.click(buttons[0]); // Кликаем по самой первой кнопке "Добавить"

    await waitFor(() => {
      expect(screen.getByText('Новый материал')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument(); // или конкретный лейбл, если он есть
    });
  });
});