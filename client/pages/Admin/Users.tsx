import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { CheckCircle, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

type Role = "admin" | "director" | "technologist" | "operator" | "user" | "guest";

interface ServerUser {
  ID: number;
  Username: string;
  Role: Role;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ Username: "", Password: "", Role: "operator" as Role });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setMessage("");
    try {
      setUsers(await apiRequest<ServerUser[]>("/api/admin/data/users?page=1&limit=100"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return users.filter((user) => user.Username?.toLowerCase().includes(lower) || user.Role?.toLowerCase().includes(lower));
  }, [users, query]);

  const registerUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await apiRequest("/api/admin/users/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ Username: "", Password: "", Role: "operator" });
      setMessage("Пользователь создан");
      await loadUsers();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось создать пользователя");
    }
  };

  const deleteUser = async (id: number) => {
    if (!window.confirm(`Удалить пользователя #${id}?`)) return;
    try {
      await apiRequest(`/api/admin/data/users/${id}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить пользователя");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">Пользователи системы</h1>
              <p className="text-lg text-[#475569] mt-2">Создание идет через защищенный эндпоинт с bcrypt-хешированием пароля.</p>
            </div>
            <button onClick={loadUsers} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          <form onSubmit={registerUser} className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] grid grid-cols-1 md:grid-cols-4 gap-4">
            <input value={form.Username} onChange={(e) => setForm({ ...form, Username: e.target.value })} required minLength={3} placeholder="Логин" className="px-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            <input value={form.Password} onChange={(e) => setForm({ ...form, Password: e.target.value })} required minLength={6} type="password" placeholder="Пароль" className="px-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            <select value={form.Role} onChange={(e) => setForm({ ...form, Role: e.target.value as Role })} className="px-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]">
              <option value="operator">Оператор</option>
              <option value="technologist">Технолог</option>
              <option value="director">Руководитель</option>
              <option value="admin">Администратор</option>
              <option value="user">Пользователь</option>
              <option value="guest">Гость</option>
            </select>
            <button className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">
              <Plus className="w-5 h-5" /> Добавить
            </button>
          </form>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1]">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по логину или роли" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F1F5F9] text-[#475569]">
                  <tr>
                    <th className="p-4 font-bold">ID</th>
                    <th className="p-4 font-bold">Логин</th>
                    <th className="p-4 font-bold">Роль</th>
                    <th className="p-4 font-bold text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]">
                  {filtered.map((user) => (
                    <tr key={user.ID}>
                      <td className="p-4 font-mono">{user.ID}</td>
                      <td className="p-4 font-bold">{user.Username}</td>
                      <td className="p-4"><span className="inline-flex items-center gap-2 rounded-lg bg-[#16A34A]/10 px-3 py-1 text-[#16A34A] font-bold"><CheckCircle className="w-4 h-4" />{user.Role}</span></td>
                      <td className="p-4 text-right">
                        <button onClick={() => deleteUser(user.ID)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold">
                          <Trash2 className="w-4 h-4" /> Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
