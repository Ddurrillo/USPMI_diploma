import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

describe('NotFound.tsx', () => {
  it('должен корректно отображать страницу 404', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Страница не найдена')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /на главную/i })).toBeInTheDocument();
  });
});