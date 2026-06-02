import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Edit2, Mail, Phone, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

interface Client {
  ID: number;
  FirstName: string;
  LastName: string;
  PatronymicName: string;
  Email: string;
  Phone: string;
}

interface Order {
  ID: number;
  ClientID: number;
  RecipeID: number;
  DateOrdered: string;
  OrderNumber: number;
  Status: string;
  Client?: Client;
}

const emptyClient: Omit<Client, "ID"> = {
  FirstName: "",
  LastName: "",
  PatronymicName: "",
  Email: "",
  Phone: "",
};

const emptyOrder: Omit<Order, "ID" | "Client"> = {
  ClientID: 0,
  RecipeID: 0,
  DateOrdered: new Date().toISOString().slice(0, 10),
  OrderNumber: 0,
  Status: "new",
};

export default function ManagerClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"clients" | "orders">("clients");
  const [form, setForm] = useState<Omit<Client, "ID">>(emptyClient);
  const [orderForm, setOrderForm] = useState<Omit<Order, "ID" | "Client">>(emptyOrder);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    setMessage("");
    try {
      setClients(await apiRequest<Client[]>("/api/manager/clients?page=1&limit=100"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить клиентов");
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setMessage("");
    try {
      setOrders(await apiRequest<Order[]>("/api/manager/orders?page=1&limit=100"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadClients(), loadOrders()]);
  }, []);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return clients.filter((client) =>
      [client.FirstName, client.LastName, client.PatronymicName, client.Email, client.Phone].some((value) => value?.toLowerCase().includes(lower)),
    );
  }, [clients, query]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyClient);
    setIsModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingId(client.ID);
    setForm({
      FirstName: client.FirstName,
      LastName: client.LastName,
      PatronymicName: client.PatronymicName,
      Email: client.Email,
      Phone: client.Phone,
    });
    setIsModalOpen(true);
  };

  const saveClient = async () => {
    try {
      if (editingId) {
        await apiRequest(`/api/manager/clients/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiRequest("/api/manager/clients", { method: "POST", body: JSON.stringify(form) });
      }
      setIsModalOpen(false);
      await loadClients();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить клиента");
    }
  };

  const deleteClient = async (client: Client) => {
    if (!window.confirm(`Удалить клиента ${client.LastName} ${client.FirstName}?`)) return;
    try {
      await apiRequest(`/api/manager/clients/${client.ID}`, { method: "DELETE" });
      await loadClients();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить клиента");
    }
  };

  const openOrderCreate = () => {
    setEditingOrderId(null);
    setOrderForm({ ...emptyOrder, ClientID: clients[0]?.ID ?? 0 });
  };

  const openOrderEdit = (order: Order) => {
    setEditingOrderId(order.ID);
    setOrderForm({
      ClientID: order.ClientID,
      RecipeID: order.RecipeID,
      DateOrdered: order.DateOrdered?.slice(0, 10),
      OrderNumber: order.OrderNumber,
      Status: order.Status || "new",
    });
  };

  const saveOrder = async () => {
    try {
      if (editingOrderId) {
        await apiRequest(`/api/manager/orders/${editingOrderId}`, { method: "PUT", body: JSON.stringify(orderForm) });
      } else {
        await apiRequest("/api/manager/orders", { method: "POST", body: JSON.stringify(orderForm) });
      }
      openOrderCreate();
      await loadOrders();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить заказ");
    }
  };

  const deleteOrder = async (order: Order) => {
    if (!window.confirm(`Удалить заказ #${order.ID}?`)) return;
    try {
      await apiRequest(`/api/manager/orders/${order.ID}`, { method: "DELETE" });
      await loadOrders();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить заказ");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">Клиенты</h1>
              <p className="text-lg text-[#475569] mt-2">Данные берутся из `/api/manager/clients`.</p>
            </div>
            <button onClick={() => activeTab === "clients" ? loadClients() : loadOrders()} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          <div className="inline-flex rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-1">
            <button onClick={() => setActiveTab("clients")} className={`px-5 py-2 rounded-lg font-bold ${activeTab === "clients" ? "bg-[#3B82F6] text-white" : "text-[#475569]"}`}>Клиенты</button>
            <button onClick={() => setActiveTab("orders")} className={`px-5 py-2 rounded-lg font-bold ${activeTab === "orders" ? "bg-[#3B82F6] text-white" : "text-[#475569]"}`}>Заказы</button>
          </div>

          {activeTab === "clients" && (
          <>
          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ФИО, email или телефону" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">
              <Plus className="w-5 h-5" /> Добавить
            </button>
          </div>
          </>
          )}

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          {activeTab === "clients" && (
          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F1F5F9] text-[#475569]">
                <tr>
                  <th className="p-5 font-bold">ФИО</th>
                  <th className="p-5 font-bold">Контакты</th>
                  <th className="p-5 font-bold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD5E1]">
                {filtered.map((client) => (
                  <tr key={client.ID}>
                    <td className="p-5 text-lg font-bold">{client.LastName} {client.FirstName} {client.PatronymicName}</td>
                    <td className="p-5 text-[#475569]">
                      <div className="flex items-center gap-2"><Mail className="w-4 h-4" />{client.Email}</div>
                      <div className="flex items-center gap-2 mt-1"><Phone className="w-4 h-4" />{client.Phone}</div>
                    </td>
                    <td className="p-5 text-right">
                      <button onClick={() => openEdit(client)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2">
                        <Edit2 className="w-4 h-4" /> Изменить
                      </button>
                      <button onClick={() => deleteClient(client)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold">
                        <Trash2 className="w-4 h-4" /> Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {activeTab === "orders" && (
            <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
              <div className="p-5 grid grid-cols-1 md:grid-cols-6 gap-3 border-b border-[#CBD5E1]">
                <input type="number" value={orderForm.ClientID} onChange={(e) => setOrderForm({ ...orderForm, ClientID: Number(e.target.value) })} placeholder="ClientID" className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <input type="number" value={orderForm.RecipeID} onChange={(e) => setOrderForm({ ...orderForm, RecipeID: Number(e.target.value) })} placeholder="RecipeID" className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <input type="date" value={orderForm.DateOrdered} onChange={(e) => setOrderForm({ ...orderForm, DateOrdered: e.target.value })} className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <input type="number" value={orderForm.OrderNumber} onChange={(e) => setOrderForm({ ...orderForm, OrderNumber: Number(e.target.value) })} placeholder="OrderNumber" className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <input value={orderForm.Status} onChange={(e) => setOrderForm({ ...orderForm, Status: e.target.value })} placeholder="Status" className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <button onClick={saveOrder} className="px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-bold">{editingOrderId ? "Сохранить" : "Добавить"}</button>
              </div>
              <table className="w-full text-left">
                <thead className="bg-[#F1F5F9] text-[#475569]">
                  <tr>
                    <th className="p-4 font-bold">Заказ</th>
                    <th className="p-4 font-bold">Клиент</th>
                    <th className="p-4 font-bold">RecipeID</th>
                    <th className="p-4 font-bold">Статус</th>
                    <th className="p-4 font-bold text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]">
                  {orders.map((order) => (
                    <tr key={order.ID}>
                      <td className="p-4 font-mono">#{order.ID} / {order.OrderNumber}<div className="text-sm text-[#64748B]">{order.DateOrdered?.slice(0, 10)}</div></td>
                      <td className="p-4">{order.Client ? `${order.Client.LastName} ${order.Client.FirstName}` : order.ClientID}</td>
                      <td className="p-4">{order.RecipeID}</td>
                      <td className="p-4">{order.Status}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => openOrderEdit(order)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2"><Edit2 className="w-4 h-4" />Изм.</button>
                        <button onClick={() => deleteOrder(order)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold"><Trash2 className="w-4 h-4" />Удал.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4">
              <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-[#CBD5E1]">
                  <h2 className="text-2xl font-extrabold">{editingId ? "Редактирование клиента" : "Новый клиент"}</h2>
                  <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                  {Object.keys(emptyClient).map((key) => (
                    <label key={key} className="block">
                      <span className="block text-sm font-bold mb-1">{key}</span>
                      <input value={String(form[key as keyof typeof form])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-3 p-5 bg-[#F1F5F9] border-t border-[#CBD5E1]">
                  <button onClick={() => setIsModalOpen(false)} className="px-5 py-3 rounded-xl border border-[#CBD5E1] font-bold">Отмена</button>
                  <button onClick={saveClient} className="px-5 py-3 rounded-xl bg-[#16A34A] text-white font-bold">Сохранить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
