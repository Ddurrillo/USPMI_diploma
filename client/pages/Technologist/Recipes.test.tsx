import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TechRecipes from './Recipes';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/components/Layout', () => ({ children }: any) => <div>{children}</div>);

describe('TechRecipes.tsx', () => {
  const mockRecipes = [
    { 
      ID: 1, 
      MaterialID: 1, 
      CompoundID: 1, 
      Material: { ID: 1, Name: 'Стеклоткань' }, 
      Compound: { ID: 1, Name: 'Эпоксидка' },
      Length: 10, Width: 10, Height: 10, Volume: 1000, SurfaceArea: 600, Thickness: 10,
      MaxCompoundVolume: 500, MaxCompoundMass: 500, KParameter: 1.0, EstPower: 100, EstTime: 60, EstDepth: 5
    }
  ];
  const mockMaterials = [{ ID: 1, Name: 'Стеклоткань' }];
  const mockCompounds = [{ ID: 1, Name: 'Эпоксидка' }];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Умный мок: возвращает массивы для GET и {} для модификаций
    (api.apiRequest as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST' || options?.method === 'PUT' || options?.method === 'DELETE') {
        return Promise.resolve({});
      }
      if (url.includes('/api/tech/recipes')) return Promise.resolve(mockRecipes);
      if (url.includes('/api/tech/materials')) return Promise.resolve(mockMaterials);
      if (url.includes('/api/tech/compounds')) return Promise.resolve(mockCompounds);
      return Promise.resolve([]);
    });
    
    // Мокаем window.confirm для тестов удаления
    window.confirm = jest.fn(() => true);
  });

  it('должен загружать и отображать рецепты, материалы и компаунды при монтировании', async () => {
    render(
      <MemoryRouter>
        <TechRecipes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Стеклоткань').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Эпоксидка').length).toBeGreaterThan(0);
      expect(screen.getByText('P=100, t=60, d=5')).toBeInTheDocument();
    });
  });

  it('должен фильтровать рецепты при вводе в поиск', async () => {
    render(
      <MemoryRouter>
        <TechRecipes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('P=100, t=60, d=5')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Поиск по ID, материалу или компаунду'), { 
      target: { value: 'Несуществующий материал' } 
    });

    await waitFor(() => {
      expect(screen.queryByText('P=100, t=60, d=5')).not.toBeInTheDocument();
    });
  });

  it('должен открывать модальное окно создания и отправлять POST запрос при сохранении', async () => {
    render(
      <MemoryRouter>
        <TechRecipes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Управление рецептами')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /новый рецепт/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /новый рецепт/i })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /сохранить/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith(
        '/api/tech/recipes',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('должен подтверждать удаление и отправлять DELETE запрос', async () => {
    render(
      <MemoryRouter>
        <TechRecipes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Стеклоткань').length).toBeGreaterThan(0);
    });

    // Находим все кнопки "Удалить" и кликаем по первой (которая в таблице рецептов)
    const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith(
        '/api/tech/recipes/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});