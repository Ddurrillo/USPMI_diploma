import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest, buildWsUrl } from "@/lib/api";
import { Activity, Pause, Play, RefreshCw, Thermometer, Waves } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Installation {
  ID: number;
  Name: string;
  MaxPower: number;
  MaxAmplitude: number;
  MinFrequency: number;
  MaxFrequency: number;
  GatewayIp: string;
  GatewayPort: number;
}

interface Telemetry {
  temperature: number;
  pressure: number;
  amplitude: number;
  current_power: number;
}

type WsState = "idle" | "connecting" | "connected" | "error" | "closed";

export default function OperatorEquipment() {
  const wsRef = useRef<WebSocket | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationId, setInstallationId] = useState<number>(0);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [state, setState] = useState<WsState>("idle");
  const [message, setMessage] = useState("");
  const [telemetry, setTelemetry] = useState<Telemetry>({ temperature: 0, pressure: 0, amplitude: 0, current_power: 0 });
  const [history, setHistory] = useState<Array<{ t: string; temperature: number; power: number }>>([]);
  const [adjust, setAdjust] = useState({ amplitude: 0, frequency: 0 });

  const loadInstallations = async () => {
    try {
      const data = await apiRequest<Installation[]>("/api/operator/installations?page=1&limit=100");
      setInstallations(data);
      setInstallationId((current) => current || data[0]?.ID || 0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить установки");
    }
  };

  useEffect(() => {
    void loadInstallations();
    return () => wsRef.current?.close();
  }, []);

  const selected = useMemo(() => installations.find((item) => item.ID === installationId), [installations, installationId]);

  const connect = () => {
    if (!installationId) {
      setMessage("Выберите установку");
      return;
    }

    wsRef.current?.close();
    setMessage("");
    setState("connecting");

    const socket = new WebSocket(buildWsUrl("/api/operator/ws"));
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ installation_id: installationId }));
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.error) {
        setMessage(String(payload.error));
        setState("error");
        socket.close();
        return;
      }
      if (payload.type === "connected") {
        setProcessingId(payload.processing_id);
        setState("connected");
        return;
      }
      if (payload.type === "telemetry") {
        const data = payload.data as Telemetry;
        setTelemetry(data);
        const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setHistory((prev) => [...prev.slice(-59), { t: now, temperature: data.temperature, power: data.current_power }]);
      }
    };

    socket.onerror = () => {
      setState("error");
      setMessage("Ошибка WebSocket-соединения");
    };

    socket.onclose = () => {
      setState((current) => (current === "error" ? "error" : "closed"));
    };
  };

  const sendCommand = (command: object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || state !== "connected") {
      setMessage("Сначала подключитесь к установке");
      return;
    }
    wsRef.current.send(JSON.stringify(command));
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <header className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#0F172A]">Панель установки</h1>
              <p className="text-[#475569]">WebSocket: {state}. Процесс: {processingId ?? "нет"}</p>
            </div>
            <button onClick={loadInstallations} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#CBD5E1] text-[#475569] font-bold">
              <RefreshCw className="w-5 h-5" /> Обновить установки
            </button>
          </header>

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-5 flex flex-wrap items-end gap-4">
            <label className="block min-w-72">
              <span className="block text-sm font-bold mb-1">Установка</span>
              <select value={installationId} onChange={(e) => setInstallationId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]">
                <option value={0}>Выберите установку</option>
                {installations.map((item) => <option key={item.ID} value={item.ID}>{item.Name} #{item.ID}</option>)}
              </select>
            </label>
            {selected && <div className="text-[#475569]">Gateway: {selected.GatewayIp}:{selected.GatewayPort}</div>}
            <button onClick={connect} className="px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">Подключиться</button>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#DC2626] font-semibold">{message}</div>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Param title="Температура" value={telemetry.temperature} unit="C" icon={<Thermometer className="w-6 h-6" />} />
            <Param title="Давление" value={telemetry.pressure} unit="бар" icon={<Activity className="w-6 h-6" />} />
            <Param title="Амплитуда" value={telemetry.amplitude} unit="" icon={<Waves className="w-6 h-6" />} />
            <Param title="Мощность" value={telemetry.current_power} unit="Вт" icon={<Activity className="w-6 h-6" />} />
          </div>

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-5">
            <h2 className="text-2xl font-extrabold mb-4">Телеметрия</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#CBD5E1" vertical={false} />
                  <XAxis dataKey="t" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="temperature" stroke="#DC2626" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="power" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-5 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <label>
              <span className="block text-sm font-bold mb-1">Амплитуда</span>
              <input type="number" value={adjust.amplitude} onChange={(e) => setAdjust({ ...adjust, amplitude: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
            </label>
            <label>
              <span className="block text-sm font-bold mb-1">Частота</span>
              <input type="number" value={adjust.frequency} onChange={(e) => setAdjust({ ...adjust, frequency: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
            </label>
            <button onClick={() => sendCommand({ type: "start" })} className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#16A34A] text-white font-bold">
              <Play className="w-5 h-5" /> Старт
            </button>
            <button onClick={() => sendCommand({ type: "adjust", data: adjust })} className="px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">Настроить</button>
            <button onClick={() => sendCommand({ type: "stop" })} className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#DC2626] text-white font-bold">
              <Pause className="w-5 h-5" /> Стоп
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Param({ title, value, unit, icon }: { title: string; value: number; unit: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-5">
      <div className="flex items-center gap-2 text-[#475569] font-bold mb-2">{icon}{title}</div>
      <div className="text-4xl font-extrabold">{Number(value || 0).toFixed(1)} <span className="text-xl text-[#475569]">{unit}</span></div>
    </div>
  );
}
