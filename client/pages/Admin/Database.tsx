import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Database, Edit2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

type Row = Record<string, unknown>;
interface FieldSchema {
  name: string;
  type: string;
  editable: boolean;
  primary: boolean;
}

export default function AdminDatabase() {
  const [tables, setTables] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<Record<string, FieldSchema[]>>({});
  const [selectedTable, setSelectedTable] = useState("users");
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [formData, setFormData] = useState<Row>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadTables = async () => {
    const data = await apiRequest<{ tables: string[]; schemas?: Record<string, FieldSchema[]> }>("/api/admin/tables");
    setTables(data.tables);
    setSchemas(data.schemas ?? {});
    if (data.tables.length && !data.tables.includes(selectedTable)) {
      setSelectedTable(data.tables[0]);
    }
  };

  const loadRows = async (table = selectedTable) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<unknown>(
        `/api/admin/data/${table}?page=1&limit=100`
      );

      setRows(Array.isArray(response) ? response : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  useEffect(() => {
    void loadRows(selectedTable);
  }, [selectedTable]);

  const columns = useMemo(() => {
    const schema = schemas[selectedTable];
    if (schema?.length) return schema.map((field) => field.name);
    const keys = new Set<string>();
    rows.slice(0, 10).forEach((row) => {
      if (row && typeof row === "object") {
        Object.keys(row).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [rows, schemas, selectedTable]);

  const editableColumns = useMemo(() => {
    const schema = schemas[selectedTable];
    if (schema?.length) return schema.filter((field) => field.editable).map((field) => field.name);
    return columns.filter((key) => !["id", "ID"].includes(key));
  }, [columns, schemas, selectedTable]);

  const filteredRows = useMemo(() => {
    const lower = query.toLowerCase();
    return rows.filter(
      (row) =>
        row &&
        typeof row === "object" &&
        Object.values(row).some((value) =>
          String(value ?? "").toLowerCase().includes(lower)
        )
    );
  }, [rows, query]);

  const openCreate = () => {
    const initial: Row = {};
    editableColumns.forEach((key) => {
      initial[key] = "";
    });
    setEditingId(null);
    setFormData(initial);
    setIsModalOpen(true);
  };

  const openEdit = (row: Row) => {
    const idValue = row.id ?? row.ID;
    setEditingId(idValue != null ? Number(idValue) : null);
    const editable: Row = {};
    editableColumns.forEach((key) => {
      editable[key] = row[key] ?? "";
    });
    setFormData(editable);
    setIsModalOpen(true);
  };

  const saveRow = async () => {
    const payload = { ...formData };
    delete payload.id;
    delete payload.ID;
    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      const field = schemas[selectedTable]?.find((item) => item.name === key);
      if (field?.type === "number" && value !== "" && typeof value === "string") payload[key] = Number(value);
    });

    try {
      if (editingId) {
        await apiRequest(`/api/admin/data/${selectedTable}/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiRequest(`/api/admin/data/${selectedTable}`, { method: "POST", body: JSON.stringify(payload) });
      }
      setIsModalOpen(false);
      await loadRows();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить запись");
    }
  };

  const deleteRow = async (row: Row) => {
    const id = Number(row.id ?? row.ID);
    if (!id || !window.confirm(`Удалить запись #${id} из ${selectedTable}?`)) return;
    try {
      await apiRequest(`/api/admin/data/${selectedTable}/${id}`, { method: "DELETE" });
      await loadRows();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить запись");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">Администрирование БД</h1>
              <p className="text-lg text-[#475569] mt-2">CRUD через Go API `/api/admin/data/:table`.</p>
            </div>
            <button onClick={() => loadRows()} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] px-4 py-2">
              <Database className="w-5 h-5 text-[#3B82F6]" />
              <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="bg-transparent text-[#0F172A] text-lg font-bold focus:outline-none">
                {tables.map((table) => <option key={table} value={table}>{table}</option>)}
              </select>
            </div>
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по строкам" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">
              <Plus className="w-5 h-5" /> Добавить
            </button>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F1F5F9] text-[#475569]">
                  <tr>
                    {columns.map((column) => <th key={column} className="p-4 font-bold">{column}</th>)}
                    <th className="p-4 font-bold text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]">
                  {filteredRows.map((row, index) => (
                    <tr key={String(row.id ?? row.ID ?? index)}>
                      {columns.map((column) => <td key={column} className="p-4 max-w-xs truncate">{String(row[column] ?? "")}</td>)}
                      <td className="p-4 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(row)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2">
                          <Edit2 className="w-4 h-4" /> Изменить
                        </button>
                        <button onClick={() => deleteRow(row)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold">
                          <Trash2 className="w-4 h-4" /> Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4">
              <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-[#CBD5E1]">
                  <h2 className="text-2xl font-extrabold">{editingId ? `Запись #${editingId}` : "Новая запись"}</h2>
                  <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4 max-h-[70vh] overflow-auto">
                  {Object.keys(formData).map((key) => (
                    <label key={key} className="block">
                      <span className="block text-sm font-bold mb-1">{key}</span>
                      <input value={String(formData[key] ?? "")} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-3 p-5 bg-[#F1F5F9] border-t border-[#CBD5E1]">
                  <button onClick={() => setIsModalOpen(false)} className="px-5 py-3 rounded-xl border border-[#CBD5E1] font-bold">Отмена</button>
                  <button onClick={saveRow} className="px-5 py-3 rounded-xl bg-[#16A34A] text-white font-bold">Сохранить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
