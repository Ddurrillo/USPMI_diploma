import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Play, RefreshCw, Search } from "lucide-react";

interface Order {
  ID: number;
  OrderNumber: number;
  Status: string;
  DateOrdered: string;
  Recipe?: {
    ID: number;
    EstTime: number;
    Material?: { Name: string };
    Compound?: { Name: string };
  };
}

export default function OperatorWork() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    setMessage("");
    try {
      setOrders(await apiRequest<Order[]>("/api/operator/works/assigned"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить назначенные работы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return orders.filter((order) =>
      String(order.ID).includes(lower) ||
      order.Recipe?.Material?.Name?.toLowerCase().includes(lower) ||
      order.Recipe?.Compound?.Name?.toLowerCase().includes(lower),
    );
  }, [orders, query]);

  const startOrder = (order: Order) => {
    sessionStorage.setItem("selectedOrderId", String(order.ID));
    navigate("/operator/equipment");
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-5xl font-extrabold text-[#0F172A]">Назначенные работы</h1>
              <p className="text-xl text-[#475569] mt-2">Заказы со статусом `new` из `/api/operator/works/assigned`.</p>
            </div>
            <button onClick={loadOrders} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по заказу, материалу или компаунду" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F1F5F9] text-[#475569]">
                <tr>
                  <th className="p-5 font-bold">Заказ</th>
                  <th className="p-5 font-bold">Материал / компаунд</th>
                  <th className="p-5 font-bold">Плановое время</th>
                  <th className="p-5 font-bold text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD5E1]">
                {filtered.map((order) => (
                  <tr key={order.ID}>
                    <td className="p-5 font-mono text-xl font-bold">#{order.ID} / {order.OrderNumber}</td>
                    <td className="p-5">
                      <div className="font-bold">{order.Recipe?.Material?.Name ?? "Материал не указан"}</div>
                      <div className="text-[#475569]">{order.Recipe?.Compound?.Name ?? "Компаунд не указан"}</div>
                    </td>
                    <td className="p-5">{order.Recipe?.EstTime ?? 0} с</td>
                    <td className="p-5 text-right">
                      <button onClick={() => startOrder(order)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">
                        <Play className="w-5 h-5" /> К панели
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
