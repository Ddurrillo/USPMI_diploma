import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Edit2, FlaskConical, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

interface Material { ID: number; Name: string }
interface Compound { ID: number; Name: string }
interface Recipe {
  ID: number;
  MaterialID: number;
  CompoundID: number;
  Material?: Material;
  Compound?: Compound;
  Length: number;
  Width: number;
  Height: number;
  Volume: number;
  SurfaceArea: number;
  Thickness: number;
  MaxCompoundVolume: number;
  MaxCompoundMass: number;
  KParameter: number;
  EstPower: number;
  EstTime: number;
  EstDepth: number;
}

const emptyRecipe: Omit<Recipe, "ID" | "Material" | "Compound"> = {
  MaterialID: 0,
  CompoundID: 0,
  Length: 0,
  Width: 0,
  Height: 0,
  Volume: 0,
  SurfaceArea: 0,
  Thickness: 0,
  MaxCompoundVolume: 0,
  MaxCompoundMass: 0,
  KParameter: 0,
  EstPower: 0,
  EstTime: 0,
  EstDepth: 0,
};

export default function TechRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyRecipe);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [recipeData, materialData, compoundData] = await Promise.all([
        apiRequest<Recipe[]>("/api/tech/recipes?page=1&limit=100"),
        apiRequest<Material[]>("/api/tech/materials?page=1&limit=100"),
        apiRequest<Compound[]>("/api/tech/compounds?page=1&limit=100"),
      ]);
      setRecipes(recipeData);
      setMaterials(materialData);
      setCompounds(compoundData);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить рецепты");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return recipes.filter((recipe) =>
      String(recipe.ID).includes(lower) ||
      recipe.Material?.Name?.toLowerCase().includes(lower) ||
      recipe.Compound?.Name?.toLowerCase().includes(lower),
    );
  }, [recipes, query]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyRecipe, MaterialID: materials[0]?.ID ?? 0, CompoundID: compounds[0]?.ID ?? 0 });
    setIsModalOpen(true);
  };

  const openEdit = (recipe: Recipe) => {
    setEditingId(recipe.ID);
    setForm({ ...emptyRecipe, ...recipe });
    setIsModalOpen(true);
  };

  const saveRecipe = async () => {
    try {
      if (editingId) {
        await apiRequest(`/api/tech/recipes/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiRequest("/api/tech/recipes", { method: "POST", body: JSON.stringify(form) });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить рецепт");
    }
  };

  const deleteRecipe = async (id: number) => {
    if (!window.confirm(`Удалить рецепт #${id}?`)) return;
    try {
      await apiRequest(`/api/tech/recipes/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить рецепт");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">Управление рецептами</h1>
              <p className="text-lg text-[#475569] mt-2">Рецепты, материалы и компаунды загружаются из Go API.</p>
            </div>
            <button onClick={loadData} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ID, материалу или компаунду" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">
              <Plus className="w-5 h-5" /> Новый рецепт
            </button>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F1F5F9] text-[#475569]">
                <tr>
                  <th className="p-4 font-bold">ID</th>
                  <th className="p-4 font-bold">Материал</th>
                  <th className="p-4 font-bold">Компаунд</th>
                  <th className="p-4 font-bold">Оценки</th>
                  <th className="p-4 font-bold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD5E1]">
                {filtered.map((recipe) => (
                  <tr key={recipe.ID}>
                    <td className="p-4 font-mono">#{recipe.ID}</td>
                    <td className="p-4 font-bold">{recipe.Material?.Name ?? recipe.MaterialID}</td>
                    <td className="p-4">{recipe.Compound?.Name ?? recipe.CompoundID}</td>
                    <td className="p-4">P={recipe.EstPower}, t={recipe.EstTime}, d={recipe.EstDepth}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEdit(recipe)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2">
                        <Edit2 className="w-4 h-4" /> Изменить
                      </button>
                      <button onClick={() => deleteRecipe(recipe.ID)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold">
                        <Trash2 className="w-4 h-4" /> Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReferenceTable title="Материалы" icon={<FlaskConical className="w-5 h-5" />} rows={materials} />
            <ReferenceTable title="Компаунды" icon={<FlaskConical className="w-5 h-5" />} rows={compounds} />
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4">
              <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl w-full max-w-4xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-[#CBD5E1]">
                  <h2 className="text-2xl font-extrabold">{editingId ? "Редактирование рецепта" : "Новый рецепт"}</h2>
                  <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-5 grid grid-cols-3 gap-4 max-h-[70vh] overflow-auto">
                  <label className="block">
                    <span className="block text-sm font-bold mb-1">MaterialID</span>
                    <select value={form.MaterialID} onChange={(e) => setForm({ ...form, MaterialID: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]">
                      {materials.map((item) => <option key={item.ID} value={item.ID}>{item.Name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-bold mb-1">CompoundID</span>
                    <select value={form.CompoundID} onChange={(e) => setForm({ ...form, CompoundID: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]">
                      {compounds.map((item) => <option key={item.ID} value={item.ID}>{item.Name}</option>)}
                    </select>
                  </label>
                  {Object.keys(emptyRecipe).filter((key) => !["MaterialID", "CompoundID"].includes(key)).map((key) => (
                    <label key={key} className="block">
                      <span className="block text-sm font-bold mb-1">{key}</span>
                      <input value={String(form[key as keyof typeof form])} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-3 p-5 bg-[#F1F5F9] border-t border-[#CBD5E1]">
                  <button onClick={() => setIsModalOpen(false)} className="px-5 py-3 rounded-xl border border-[#CBD5E1] font-bold">Отмена</button>
                  <button onClick={saveRecipe} className="px-5 py-3 rounded-xl bg-[#16A34A] text-white font-bold">Сохранить</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ReferenceTable({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: Array<{ ID: number; Name: string }> }) {
  return (
    <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
      <h2 className="flex items-center gap-2 text-2xl font-extrabold p-5 border-b border-[#CBD5E1]">{icon}{title}</h2>
      <table className="w-full text-left">
        <tbody className="divide-y divide-[#CBD5E1]">
          {rows.map((row) => (
            <tr key={row.ID}>
              <td className="p-4 font-mono">#{row.ID}</td>
              <td className="p-4 font-bold">{row.Name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
