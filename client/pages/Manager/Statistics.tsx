import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calendar, Package, RefreshCw, TrendingUp } from "lucide-react";

type Period = "week" | "month" | "quarter";

interface Stats {
  period: Period;
  total_orders: number;
  by_recipe: Array<{ RecipeID: number; Count: number }>;
  material_usage_kg: Array<{ MaterialID: number; MaterialName: string; TotalMass: number }>;
  compound_usage_kg: Array<{ CompoundID: number; CompoundName: string; TotalMass: number }>;
}

const emptyStats: Stats = {
  period: "month",
  total_orders: 0,
  by_recipe: [],
  material_usage_kg: [],
  compound_usage_kg: [],
};

export default function ManagerStatistics() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<Stats>(emptyStats);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<Partial<Stats>>(
        `/api/manager/stats?period=${period}`
      );

      setData({
        period: response.period ?? period,
        total_orders: response.total_orders ?? 0,
        by_recipe: response.by_recipe ?? [],
        material_usage_kg: response.material_usage_kg ?? [],
        compound_usage_kg: response.compound_usage_kg ?? [],
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, [period]);

  const recipeChart = useMemo(() => data.by_recipe.map((item) => ({ name: `#${item.RecipeID}`, value: item.Count })), [data.by_recipe]);

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">Производственная сводка</h1>
              <p className="text-lg text-[#475569] mt-2">Агрегация из `/api/manager/stats`.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-1">
                {(["week", "month", "quarter"] as const).map((value) => (
                  <button key={value} onClick={() => setPeriod(value)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${period === value ? "bg-[#3B82F6] text-white" : "text-[#475569]"}`}>
                    <Calendar className="w-4 h-4" />
                    {value === "week" ? "Неделя" : value === "month" ? "Месяц" : "Квартал"}
                  </button>
                ))}
              </div>
              <button onClick={loadStats} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
              </button>
            </div>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#F8FAFC] rounded-xl p-6 border border-[#CBD5E1]">
              <TrendingUp className="w-7 h-7 text-[#16A34A] mb-3" />
              <p className="text-[#475569] font-semibold">Всего заказов</p>
              <p className="text-4xl font-extrabold">{data.total_orders}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-xl p-6 border border-[#CBD5E1]">
              <Package className="w-7 h-7 text-[#3B82F6] mb-3" />
              <p className="text-[#475569] font-semibold">Материалов в отчете</p>
              <p className="text-4xl font-extrabold">{data.material_usage_kg.length}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-xl p-6 border border-[#CBD5E1]">
              <Package className="w-7 h-7 text-[#D97706] mb-3" />
              <p className="text-[#475569] font-semibold">Компаундов в отчете</p>
              <p className="text-4xl font-extrabold">{data.compound_usage_kg.length}</p>
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-6 border border-[#CBD5E1]">
            <h2 className="text-2xl font-extrabold mb-5">Заказы по рецептам</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recipeChart}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#CBD5E1" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UsageTable title="Расход материалов, кг" rows={data.material_usage_kg} nameKey="MaterialName" valueKey="TotalMass" />
            <UsageTable title="Расход компаундов, кг" rows={data.compound_usage_kg} nameKey="CompoundName" valueKey="TotalMass" />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function UsageTable({ title, rows, nameKey, valueKey }: { title: string; rows: Record<string, unknown>[]; nameKey: string; valueKey: string }) {
  return (
    <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
      <h2 className="text-2xl font-extrabold p-5 border-b border-[#CBD5E1]">{title}</h2>
      <table className="w-full text-left">
        <tbody className="divide-y divide-[#CBD5E1]">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="p-4 font-semibold">{String(row[nameKey] ?? "Без названия")}</td>
              <td className="p-4 text-right font-mono">{Number(row[valueKey] ?? 0).toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
