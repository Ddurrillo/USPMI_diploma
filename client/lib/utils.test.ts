import { cn } from './utils';

describe('utils.ts (cn function)', () => {
  it('должен объединять строки классов', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
  });

  it('должен игнорировать ложные значения (false, null, undefined)', () => {
    expect(cn('base', false, null, undefined, 'active')).toBe('base active');
  });

  it('должен обрабатывать условные классы через объект', () => {
    expect(cn('base', { conditional: true, 'not-included': false })).toBe('base conditional');
  });
});