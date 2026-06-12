import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperatorEquipment from './Equipment';
import * as api from '@/lib/api';
import WS from 'jest-websocket-mock';

jest.mock('@/lib/api', () => ({
  apiRequest: jest.fn(),
  buildWsUrl: jest.fn(() => 'ws://localhost/api/operator/ws'),
}));
jest.mock('@/components/Layout', () => ({ children }: any) => <div>{children}</div>);

describe('OperatorEquipment.tsx', () => {
  let server: WS;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new WS('ws://localhost/api/operator/ws', { jsonProtocol: true });
    (api.apiRequest as jest.Mock).mockResolvedValue([
      { ID: 1, Name: 'УЗ-Ванна 1', MaxPower: 1000, GatewayIp: '192.168.1.10', GatewayPort: 502 }
    ]);
  });

  afterEach(() => {
    server.close();
    WS.clean();
  });

  it('должен загружать список установок при монтировании', async () => {
    render(
      <MemoryRouter>
        <OperatorEquipment />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('УЗ-Ванна 1 #1')).toBeInTheDocument();
    });
  });

it('должен устанавливать WebSocket соединение при нажатии "Подключиться"', async () => {
    render(
      <MemoryRouter>
        <OperatorEquipment />
      </MemoryRouter>
    );

    // Ждем появления текста установки
    await waitFor(() => {
      expect(screen.getByText('УЗ-Ванна 1 #1')).toBeInTheDocument();
    });

    // Ждем, пока React обновит состояние installationId
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('1');
    });

    // Нажимаем кнопку подключения
    fireEvent.click(screen.getByRole('button', { name: /подключиться/i }));

    // Ждем установки соединения
    await server.connected;

    // ВАЖНО: Используем toReceiveMessage вместо прямой проверки server.messages
    // Это дождется именно момента, когда сообщение от клиента дойдет до сервера
    await expect(server).toReceiveMessage({ installation_id: 1 });

    // Симулируем ответ от сервера о подключении
    server.send({ type: 'connected', processing_id: 99 });

    await waitFor(() => {
      expect(screen.getByText(/процесс: 99/i)).toBeInTheDocument();
    });
  });

  it('должен обновлять телеметрию при получении сообщения от WS', async () => {
    render(
      <MemoryRouter>
        <OperatorEquipment />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('УЗ-Ванна 1 #1'));
    fireEvent.click(screen.getByRole('button', { name: /подключиться/i }));
    await server.connected;
    
    server.send({ type: 'connected', processing_id: 99 });
    server.send({ 
      type: 'telemetry', 
      data: { temperature: 65.5, pressure: 1.2, amplitude: 20, current_power: 500 } 
    });

    await waitFor(() => {
      expect(screen.getByText('65.5')).toBeInTheDocument(); // Температура
      expect(screen.getByText('500.0')).toBeInTheDocument(); // Мощность
    });
  });
});