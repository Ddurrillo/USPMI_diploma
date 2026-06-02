import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { 
  AlertCircle, Zap, Droplets, TrendingUp, Search, Plus, 
  Save, Play, Pause, Trash2, Edit, RefreshCw, Download,
  Users, Database, Activity, BookOpen, Cpu, FileText, Clock
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Tooltip
} from "recharts";

// ==================== TYPES ====================
interface User { id: string; username: string; role: "operator" | "technologist" | "manager" | "admin"; name: string; }

interface Telemetry { time: string; amplitude: number; pressure: number; frequency: number; temperature: number; }
interface Task { id: string; material: string; compound: string; status: "active" | "queued" | "completed" | "error"; progress: number; }
interface Recipe { id: string; name: string; viscosity: number; tension: number; density: number; soundSpeed: number; category: string; }
interface Material { id: string; mark: string; porosity: number; radius: number; tCrit: number; }
interface Model { id: string; name: string; accuracy: string; status: "active" | "draft" | "archived"; }
interface LogEvent { id: number; time: string; type: "success" | "warning" | "error" | "info"; message: string; }
interface DbRow { id: number; table: string; col1: string; col2: string; updated: string; }

// ==================== MOCK DATA ====================
const INITIAL_TASKS: Task[] = [
  { id: "PART-2026-042", material: "Углеволокно Т-700", compound: "EPX-402_Standard", status: "active", progress: 45 },
  { id: "PART-2026-043", material: "Стеклоткань Е-стекло", compound: "POL-110_Fast", status: "queued", progress: 0 },
  { id: "PART-2026-044", material: "Аэрогель А1", compound: "SIL-X9_High", status: "queued", progress: 0 }
];

const RECIPES: Recipe[] = [
  { id: "r1", name: "EPX-402 (Модифицированный)", viscosity: 240, tension: 32.5, density: 1150, soundSpeed: 1480, category: "Эпоксидные (12)" },
  { id: "r2", name: "POL-110 (Быстрая)", viscosity: 180, tension: 28.1, density: 1080, soundSpeed: 1350, category: "Полиэфирные (8)" },
  { id: "r3", name: "SIL-X9 (Высокотемп)", viscosity: 410, tension: 41.0, density: 1320, soundSpeed: 1590, category: "Силиконовые (5)" }
];

const MATERIALS: Material[] = [
  { id: "m1", mark: "Карбон-Т300", porosity: 0.12, radius: 45, tCrit: 180 },
  { id: "m2", mark: "Стекло-М1", porosity: 0.25, radius: 82, tCrit: 150 },
  { id: "m3", mark: "Аэрогель-А1", porosity: 0.85, radius: 15, tCrit: 90 }
];

const MODELS: Model[] = [
  { id: "md1", name: "Washburn_v3", accuracy: "R²=0.94", status: "active" },
  { id: "md2", name: "NN_Impregnation_v1", accuracy: "MSE=0.012", status: "draft" },
  { id: "md3", name: "Linear_Crit_DW", accuracy: "DW=1.95", status: "archived" }
];

const LOG_EVENTS: LogEvent[] = [
  { id: 1, time: "10:42", type: "success", message: "Завершение цикла PART-039" },
  { id: 2, time: "10:15", type: "warning", message: "Превышение T_крит на УЗ №2" },
  { id: 3, time: "09:30", type: "info", message: "Редактирование рецепта EPX-402 технологом" },
  { id: 4, time: "08:55", type: "success", message: "Успешная калибровка датчика давления" }
];

const DB_ROWS: DbRow[] = [
  { id: 1, table: "recipes", col1: "EPX_Batch_01", col2: "0.45", updated: "2026-05-31 14:20:00" },
  { id: 2, table: "materials", col1: "POL_Compound_X", col2: "1.12", updated: "2026-05-31 15:05:00" },
  { id: 3, table: "telemetry", col1: "PART-042_STREAM", col2: "28.5kHz", updated: "2026-06-01 10:00:00" }
];

// ==================== COMPONENTS ====================

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({ time: "", amplitude: 18, pressure: 2.1, frequency: 28.5, temperature: 48.2 });
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeTab, setActiveTab] = useState<string>("operator");
  const [isRunning, setIsRunning] = useState(true);
  const [wsStatus, setWsStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
    setWsStatus("connected");
  }, []);

  // WebSocket / Telemetry Simulation (~1Hz)
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setTelemetry(prev => ({
        time: now,
        amplitude: Math.max(10, Math.min(35, prev.amplitude + (Math.random() - 0.5) * 2)),
        pressure: Math.max(1.5, Math.min(3.0, prev.pressure + (Math.random() - 0.5) * 0.1)),
        frequency: Math.max(25, Math.min(32, prev.frequency + (Math.random() - 0.5) * 0.2)),
        temperature: Math.max(35, Math.min(65, prev.temperature + (Math.random() - 0.4) * 1.2))
      }));
      setTasks(prev => prev.map(t => t.status === "active" ? { ...t, progress: Math.min(100, t.progress + 0.8) } : t));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStop = () => {
    setIsRunning(false);
    setTasks(prev => prev.map(t => t.status === "active" ? { ...t, status: "error" as const } : t));
    // TODO: Отправить команду STOP на Go-сервер через WebSocket/REST
  };

  const handleStart = () => {
    setIsRunning(true);
    // TODO: Отправить команду START, заблокировать очередь до завершения цикла
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="min-h-screen bg-[#F5F7FA] p-4 space-y-4">
        {user.role === "operator" && <OperatorView telemetry={telemetry} tasks={tasks} isRunning={isRunning} onStart={handleStart} onStop={handleStop} wsStatus={wsStatus} />}
        {user.role === "technologist" && <TechnologistView />}
        {user.role === "manager" && <ManagerView />}
        {user.role === "admin" && <AdminView />}
      </div>
    </Layout>
  );
}

// ==================== OPERATOR VIEW ====================
function OperatorView({ telemetry, tasks, isRunning, onStart, onStop, wsStatus }: any) {
  const activeTask = tasks.find((t: Task) => t.status === "active");
  const queueTasks = tasks.filter((t: Task) => t.status === "queued");
  const chartData = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    time: `${i}с`,
    amplitude: 15 + Math.sin(i * 0.5) * 4 + Math.random(),
    pressure: 2.0 + Math.cos(i * 0.7) * 0.3 + Math.random() * 0.1
  })), []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-3 rounded shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-800">УЗ Установка №1</h1>
          <p className="text-sm text-gray-500">Текущий процесс: {activeTask ? activeTask.id : "Нет активного задания"}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium ${wsStatus === "connected" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus === "connected" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
            WebSocket {wsStatus === "connected" ? "активен" : "отключен"}
          </div>
          <button className="text-gray-500 hover:text-gray-700 text-sm">Выход</button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-4 gap-4">
        {/* Mnemoscheme & Params */}
        <div className="col-span-3 bg-white rounded shadow p-4 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Частота", val: `${telemetry.frequency.toFixed(1)} кГц`, color: "text-green-600" },
              { label: "Амплитуда", val: `${telemetry.amplitude.toFixed(1)} мкм`, color: "text-green-600" },
              { label: "Давление", val: `${telemetry.pressure.toFixed(2)} бар`, color: "text-gray-700" },
              { label: "Температура", val: `${telemetry.temperature.toFixed(1)} °C`, color: telemetry.temperature > 50 ? "text-yellow-600" : telemetry.temperature > 60 ? "text-[#F44336]" : "text-green-600" }
            ].map(p => (
              <div key={p.label} className="p-3 border rounded bg-gray-50">
                <p className="text-xs text-gray-500 uppercase">{p.label}</p>
                <p className={`text-2xl font-bold ${p.color}`}>{p.val}</p>
              </div>
            ))}
          </div>
          <div className="h-32 bg-gray-100 rounded border flex items-center justify-center text-gray-400">📐 Мнемосхема ванны (SVG/Canvas)</div>
          
          <div className="flex gap-4">
            <button onClick={onStart} disabled={isRunning} className="flex-1 py-3 bg-[#2196F3] text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 transition">▶ ЗАПУСК</button>
            <button onClick={onStop} disabled={!isRunning} className="flex-1 py-3 bg-[#F44336] text-white rounded font-bold hover:bg-red-700 disabled:opacity-50 transition text-lg tracking-wider">🛑 СТОП</button>
          </div>
        </div>

        {/* Queue */}
        <div className="col-span-1 bg-white rounded shadow p-4 flex flex-col">
          <h3 className="font-bold text-gray-700 mb-2">Очередь заданий</h3>
          {activeTask && (
            <div className="mb-3 pb-3 border-b">
              <p className="text-xs text-gray-500">АКТИВНОЕ</p>
              <p className="font-medium text-sm">{activeTask.id}</p>
              <p className="text-xs text-gray-600">{activeTask.material}</p>
              <div className="w-full bg-gray-200 rounded h-1.5 mt-2"><div className="bg-[#2196F3] h-1.5 rounded" style={{ width: `${activeTask.progress}%` }}></div></div>
            </div>
          )}
          <div className="space-y-2 overflow-y-auto max-h-[200px]">
            {queueTasks.map(q => (
              <div key={q.id} className="p-2 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center">
                <div><p className="text-sm font-medium">{q.id}</p><p className="text-xs text-gray-500">{q.material}</p></div>
                <span className="text-gray-400">⏱</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black rounded p-3 border border-gray-700">
          <h4 className="text-xs font-bold text-[#00B0FF] uppercase mb-2">Амплитуда колебаний</h4>
          <ResponsiveContainer width="100%" height={120}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="time" stroke="#666" /><YAxis stroke="#666" /><Line type="monotone" dataKey="amplitude" stroke="#00B0FF" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </div>
        <div className="bg-black rounded p-3 border border-gray-700">
          <h4 className="text-xs font-bold text-[#00B0FF] uppercase mb-2">Акустическое давление</h4>
          <ResponsiveContainer width="100%" height={120}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="time" stroke="#666" /><YAxis stroke="#666" /><Line type="monotone" dataKey="pressure" stroke="#00B0FF" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ==================== TECHNOLOGIST VIEW ====================
function TechnologistView() {
  const [tab, setTab] = useState<"recipes" | "materials" | "models">("recipes");
  const [selectedRecipe, setSelectedRecipe] = useState(RECIPES[0]);
  const [calcTime, setCalcTime] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b pb-2">
        {(["recipes", "materials", "models"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-t text-sm font-medium transition ${tab === t ? "bg-white border-b-2 border-[#2196F3] text-[#2196F3]" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "recipes" ? "📖 Рецепты" : t === "materials" ? "🧱 Материалы" : "🧠 Модели"}
          </button>
        ))}
      </div>

      {tab === "recipes" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 bg-white rounded shadow p-4">
            <div className="relative mb-3"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input className="w-full pl-9 pr-3 py-2 border rounded text-sm" placeholder="Поиск..." /></div>
            <ul className="space-y-1 text-sm">
              {["Эпоксидные (12)", "Полиэфирные (8)", "Тестовые (3)"].map((c, i) => (
                <li key={c} className={`p-2 rounded cursor-pointer ${i === 0 ? "bg-[#2196F3]/10 font-medium" : "hover:bg-gray-50"}`}>{c}</li>
              ))}
            </ul>
            <button className="w-full mt-3 border border-green-600 text-green-600 py-2 rounded hover:bg-green-50 text-sm flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Новый рецепт</button>
          </div>
          <div className="col-span-6 bg-white rounded shadow p-5">
            <h2 className="text-lg font-bold mb-3">{selectedRecipe.name}</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[{ l: "Вязкость (мПа·с)", v: selectedRecipe.viscosity }, { l: "Поверхн. натяжение", v: selectedRecipe.tension }, { l: "Плотность", v: selectedRecipe.density }, { l: "Скорость звука", v: selectedRecipe.soundSpeed }].map(f => (
                <div key={f.l} className="p-3 bg-[#3D3D3D] text-white rounded">
                  <label className="text-xs text-gray-300">{f.l}</label>
                  <input type="number" defaultValue={f.v} className="w-full mt-1 bg-transparent border-b border-gray-500 focus:outline-none text-lg" />
                </div>
              ))}
            </div>
            <div className="flex gap-2"><button className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 hover:bg-green-700"><Save className="w-4 h-4" /> Сохранить</button><button className="bg-[#2196F3] text-white px-4 py-2 rounded text-sm hover:bg-blue-600">Рассчитать режим</button></div>
          </div>
          <div className="col-span-3 bg-white rounded shadow p-4 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-gray-600 mb-2">Связанные процессы</h3>
              <div className="p-2 border rounded bg-green-50 text-green-800 text-xs mb-2">✅ PART-039: 98.2% заполнение</div>
              <div className="p-2 border rounded bg-[#FF948C]/20 text-red-800 text-xs">⚠️ PART-037: Воздушные пробки</div>
            </div>
            <div className="pt-2 border-t">
              <h3 className="font-bold text-sm text-gray-600 mb-2">Расчет времени</h3>
              <input type="number" placeholder="Толщина (мм)" className="w-full p-2 border rounded text-sm mb-2" onChange={e => setCalcTime(parseFloat(e.target.value || "0") * 1.4)} />
              <div className="p-3 bg-gray-50 rounded text-center"><p className="text-xs text-gray-500">Прогноз</p><p className="text-2xl font-bold text-[#2196F3]">{calcTime.toFixed(1)} мин</p></div>
            </div>
          </div>
        </div>
      )}

      {tab === "materials" && (
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="p-3 border-b flex justify-between"><h3 className="font-bold">Справочник материалов</h3><button className="text-[#2196F3] text-sm hover:underline">📥 Импорт CSV</button></div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100"><tr><th className="p-3">Марка</th><th className="p-3">Π</th><th className="p-3">R_пор (мкм)</th><th className="p-3">T_крит</th><th className="p-3">Действия</th></tr></thead>
            <tbody className="divide-y">{MATERIALS.map(m => <tr key={m.id} className="hover:bg-gray-50"><td className="p-3 font-medium">{m.mark}</td><td className="p-3">{m.porosity}</td><td className="p-3">{m.radius}</td><td className="p-3">{m.tCrit}°C</td><td className="p-3 flex gap-2"><button className="text-[#2196F3]"><Edit className="w-4 h-4"/></button><button className="text-[#FF948C]"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {tab === "models" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-bold mb-3">Конфигурация обучения</h3>
            <select className="w-full p-2 border rounded mb-3 text-sm"><option>Линеаризованная регрессия (Уошберн)</option><option>Нейросеть (MLP)</option></select>
            <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center text-sm text-gray-500 mb-3">Перетащите CSV выборку</div>
            <button className="w-full bg-[#2196F3] text-white py-2 rounded text-sm hover:bg-blue-600 flex items-center justify-center gap-2"><Play className="w-4 h-4"/> Запустить обучение</button>
          </div>
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-bold mb-3">Реестр моделей</h3>
            <ul className="space-y-2">{MODELS.map(m => <li key={m.id} className="p-2 border rounded flex justify-between items-center hover:bg-gray-50"><div><p className="font-medium text-sm">{m.name}</p><p className="text-xs text-gray-500">{m.accuracy}</p></div><span className={`px-2 py-0.5 rounded text-xs font-bold ${m.status==="active"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-600"}`}>{m.status==="active"?"Активна":"Черновик"}</span></li>)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== MANAGER VIEW ====================
function ManagerView() {
  const [period, setPeriod] = useState("week");
  const kpis = [{ title: "Завершено", val: "142", sub: "+12%", color: "bg-green-600" }, { title: "Нештатные", val: "3", sub: "-40%", color: "bg-yellow-500" }, { title: "Ср. время цикла", val: "24м 12с", sub: "норма", color: "bg-blue-600" }, { title: "Топ материал", val: "Эпоксидная", sub: "68%", color: "bg-purple-600" }];
  const barData = [{ day: "Пн", val: 65 }, { day: "Вт", val: 80 }, { day: "Ср", val: 45 }, { day: "Чт", val: 90 }, { day: "Пт", val: 70 }, { day: "Сб", val: 100 }, { day: "Вс", val: 85 }];
  const pieData = [{ name: "Фильтры", value: 45, color: "#2196F3" }, { name: "Мембраны", value: 30, color: "#4CAF50" }, { name: "Прочее", value: 25, color: "#9C27B0" }];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Производственная сводка</h1>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="p-2 border rounded text-sm"><option value="week">Неделя</option><option value="month">Месяц</option><option value="quarter">Квартал</option></select>
          <button className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 flex items-center gap-2"><Download className="w-4 h-4"/> Отчет</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => <div key={k.title} className={`${k.color} text-white p-4 rounded shadow`}><p className="text-sm opacity-80">{k.title}</p><p className="text-2xl font-bold">{k.val}</p><p className="text-xs bg-white/20 inline-block px-2 py-0.5 rounded mt-1">{k.sub}</p></div>)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow h-64">
          <h3 className="font-bold text-sm text-gray-600 mb-2">Выпуск по дням</h3>
          <ResponsiveContainer width="100%" height="85%"><BarChart data={barData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="val" fill="#2196F3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded shadow h-64 flex flex-col items-center justify-center">
          <h3 className="font-bold text-sm text-gray-600 mb-4 w-full text-left">Распределение материалов</h3>
          <ResponsiveContainer width="80%" height="70%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">{pieData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><Activity className="w-4 h-4"/> Журнал событий</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto text-sm">
          {LOG_EVENTS.map(e => <div key={e.id} className={`p-2 rounded flex justify-between ${e.type==="success"?"bg-green-50 text-green-800":e.type==="warning"?"bg-yellow-50 text-yellow-800":e.type==="error"?"bg-red-50 text-red-800":"bg-gray-50 text-gray-700"}`}><span>[{e.time}] {e.message}</span><span className="font-mono text-xs">{e.type.toUpperCase()}</span></div>)}
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN VIEW ====================
function AdminView() {
  const [tab, setTab] = useState<"users" | "database">("users");

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b pb-2">
        <button onClick={() => setTab("users")} className={`px-4 py-2 rounded-t text-sm font-medium transition ${tab==="users"?"bg-white border-b-2 border-[#2196F3] text-[#2196F3]":"text-gray-500 hover:text-gray-700"}`}><Users className="w-4 h-4 inline mr-1"/> Пользователи</button>
        <button onClick={() => setTab("database")} className={`px-4 py-2 rounded-t text-sm font-medium transition ${tab==="database"?"bg-white border-b-2 border-[#2196F3] text-[#2196F3]":"text-gray-500 hover:text-gray-700"}`}><Database className="w-4 h-4 inline mr-1"/> База данных</button>
      </div>

      {tab === "users" && (
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="p-3 border-b flex justify-between"><h3 className="font-bold">Управление учетными записями</h3><button className="bg-[#2196F3] text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600">+ Добавить</button></div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100"><tr><th className="p-3">Логин</th><th className="p-3">ФИО</th><th className="p-3">Роль</th><th className="p-3">Статус</th><th className="p-3">Действия</th></tr></thead>
            <tbody className="divide-y">
              <tr className="hover:bg-gray-50"><td className="p-3 font-mono">ivanov_tech</td><td className="p-3">Иванов И.И.</td><td className="p-3">Технолог</td><td className="p-3"><span className="text-green-600 font-medium">Активен</span></td><td className="p-3 flex gap-2"><button className="text-gray-500 hover:text-black"><Edit className="w-4 h-4"/></button><button className="text-[#FF948C] hover:text-red-700"><Pause className="w-4 h-4"/></button></td></tr>
              <tr className="hover:bg-gray-50"><td className="p-3 font-mono">petrov_op</td><td className="p-3">Петров П.П.</td><td className="p-3">Оператор</td><td className="p-3"><span className="text-[#F44336] font-medium">Заблокирован</span></td><td className="p-3 flex gap-2"><button className="text-gray-500 hover:text-black"><Edit className="w-4 h-4"/></button><button className="text-green-600 hover:text-green-800"><Play className="w-4 h-4"/></button></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "database" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select className="p-2 border rounded text-sm min-w-[180px]"><option>users</option><option>materials</option><option>telemetry_archive</option><option>recipes</option></select>
            <button className="bg-[#2196F3] text-white px-3 py-2 rounded text-sm hover:bg-blue-600">Загрузить</button>
            <button className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700">+ INSERT</button>
            <button className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">📤 Экспорт</button>
          </div>
          <div className="bg-white rounded shadow p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100"><tr><th className="p-2">id</th><th className="p-2">table</th><th className="p-2">value_1</th><th className="p-2">value_2</th><th className="p-2">updated_at</th><th className="p-2"></th></tr></thead>
              <tbody className="divide-y">{DB_ROWS.map(r => <tr key={r.id}><td className="p-2 font-mono">{r.id}</td><td className="p-2">{r.table}</td><td className="p-2">{r.col1}</td><td className="p-2">{r.col2}</td><td className="p-2 text-gray-500">{r.updated}</td><td className="p-2"><button className="text-[#FF948C] hover:text-red-700"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody>
            </table>
          </div>
          <div className="p-3 bg-[#FF948C]/20 border border-[#FF948C] rounded text-sm text-red-800 flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-bold">Внимание: Прямое редактирование</p>
              <p>Операции удаляют/изменяют данные без автоматического отката. Все действия логируются в таблицу <code>audit_logs</code>. Перед массовыми изменениями создайте бэкап.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}