import '@testing-library/jest-dom';

// Фильтрация предупреждений React Router и Recharts
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('React Router Future Flag Warning') ||
     message.includes('The width(0) and height(0) of chart should be greater than 0'))
  ) {
    return; // Игнорируем эти предупреждения
  }
  originalWarn.apply(console, args);
};

// Остальной код...
global.fetch = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};