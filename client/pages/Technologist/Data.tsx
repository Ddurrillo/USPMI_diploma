import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Edit2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

interface Material {
  ID: number;
  Name: string;
  CriticalTemperature: number;
  CapillaryRadius: number;
  CapillaryLength: number;
  Porosity: number;
  Density: number;
}

interface Compound {
  ID: number;
  Name: string;
  CriticalTemperature: number;
}

interface CompoundProperty {
  CompoundID: number;
  Temperature: number;
  DynamicViscosity: number;
  SurfaceTension: number;
  Density: number;
  UltrasoundSpeed: number;
  AcousticImpedance: number;
}

const emptyMaterial: Omit<Material, "ID"> = {
  Name: "",
  CriticalTemperature: 0,
  CapillaryRadius: 0,
  CapillaryLength: 0,
  Porosity: 0,
  Density: 0,
};

const emptyCompound: Omit<Compound, "ID"> = { Name: "", CriticalTemperature: 0 };
const emptyProperty: Omit<CompoundProperty, "CompoundID"> = {
  Temperature: 0,
  DynamicViscosity: 0,
  SurfaceTension: 0,
  Density: 0,
  UltrasoundSpeed: 0,
  AcousticImpedance: 0,
};

export default function TechData() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [properties, setProperties] = useState<CompoundProperty[]>([]);
  const [selectedCompoundId, setSelectedCompoundId] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Omit<Material, "ID">>(emptyMaterial);
  const [compoundForm, setCompoundForm] = useState<Omit<Compound, "ID">>(emptyCompound);
  const [propertyForm, setPropertyForm] = useState<Omit<CompoundProperty, "CompoundID">>(emptyProperty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCompoundId, setEditingCompoundId] = useState<number | null>(null);
  const [editingTemperature, setEditingTemperature] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMaterials = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [materialData, compoundData] = await Promise.all([
        apiRequest<Material[]>("/api/tech/materials?page=1&limit=100"),
        apiRequest<Compound[]>("/api/tech/compounds?page=1&limit=100"),
      ]);
      setMaterials(materialData);
      setCompounds(compoundData);
      setSelectedCompoundId((current) => current || compoundData[0]?.ID || 0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить материалы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMaterials();
  }, []);

  useEffect(() => {
    if (!selectedCompoundId) {
      setProperties([]);
      return;
    }
    void loadProperties(selectedCompoundId);
  }, [selectedCompoundId]);

  const filtered = useMemo(() => materials.filter((item) => item.Name?.toLowerCase().includes(query.toLowerCase())), [materials, query]);
  const filteredCompounds = useMemo(() => compounds.filter((item) => item.Name?.toLowerCase().includes(query.toLowerCase())), [compounds, query]);

  const loadProperties = async (compoundId: number) => {
    try {
      setProperties(await apiRequest<CompoundProperty[]>(`/api/tech/compounds/${compoundId}/properties`));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить свойства компаунда");
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyMaterial);
    setIsModalOpen(true);
  };

  const openEdit = (material: Material) => {
    setEditingId(material.ID);
    setForm({ ...material });
    setIsModalOpen(true);
  };

  const saveMaterial = async () => {
    try {
      if (editingId) {
        await apiRequest(`/api/tech/materials/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiRequest("/api/tech/materials", { method: "POST", body: JSON.stringify(form) });
      }
      setIsModalOpen(false);
      await loadMaterials();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить материал");
    }
  };

  const deleteMaterial = async (id: number) => {
    if (!window.confirm(`Удалить материал #${id}?`)) return;
    try {
      await apiRequest(`/api/tech/materials/${id}`, { method: "DELETE" });
      await loadMaterials();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить материал");
    }
  };

  const openCompoundCreate = () => {
    setEditingCompoundId(null);
    setCompoundForm(emptyCompound);
  };

  const openCompoundEdit = (compound: Compound) => {
    setEditingCompoundId(compound.ID);
    setCompoundForm({ Name: compound.Name, CriticalTemperature: compound.CriticalTemperature });
    setSelectedCompoundId(compound.ID);
  };

  const saveCompound = async () => {
    try {
      if (editingCompoundId) {
        await apiRequest(`/api/tech/compounds/${editingCompoundId}`, { method: "PUT", body: JSON.stringify(compoundForm) });
      } else {
        await apiRequest("/api/tech/compounds", { method: "POST", body: JSON.stringify(compoundForm) });
      }
      openCompoundCreate();
      await loadMaterials();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить компаунд");
    }
  };

  const deleteCompound = async (id: number) => {
    if (!window.confirm(`Удалить компаунд #${id}?`)) return;
    try {
      await apiRequest(`/api/tech/compounds/${id}`, { method: "DELETE" });
      setSelectedCompoundId(0);
      await loadMaterials();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить компаунд");
    }
  };

  const openPropertyCreate = () => {
    setEditingTemperature(null);
    setPropertyForm(emptyProperty);
  };

  const openPropertyEdit = (property: CompoundProperty) => {
    setEditingTemperature(property.Temperature);
    setPropertyForm({
      Temperature: property.Temperature,
      DynamicViscosity: property.DynamicViscosity,
      SurfaceTension: property.SurfaceTension,
      Density: property.Density,
      UltrasoundSpeed: property.UltrasoundSpeed,
      AcousticImpedance: property.AcousticImpedance,
    });
  };

  const saveProperty = async () => {
    if (!selectedCompoundId) return;
    try {
      if (editingTemperature !== null) {
        await apiRequest(`/api/tech/compounds/${selectedCompoundId}/properties?temperature=${encodeURIComponent(editingTemperature)}`, { method: "PUT", body: JSON.stringify(propertyForm) });
      } else {
        await apiRequest(`/api/tech/compounds/${selectedCompoundId}/properties`, { method: "POST", body: JSON.stringify(propertyForm) });
      }
      openPropertyCreate();
      await loadProperties(selectedCompoundId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось сохранить свойства");
    }
  };

  const deleteProperty = async (temperature: number) => {
    if (!selectedCompoundId || !window.confirm(`Удалить свойства для ${temperature} C?`)) return;
    try {
      await apiRequest(`/api/tech/compounds/${selectedCompoundId}/properties?temperature=${encodeURIComponent(temperature)}`, { method: "DELETE" });
      await loadProperties(selectedCompoundId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить свойства");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">Справочник материалов</h1>
              <p className="text-lg text-[#475569] mt-2">Материалы из `/api/tech/materials`.</p>
            </div>
            <button onClick={loadMaterials} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold">
              <Plus className="w-5 h-5" /> Добавить
            </button>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F1F5F9] text-[#475569]">
                <tr>
                  <th className="p-4 font-bold">Название</th>
                  <th className="p-4 font-bold">Пористость</th>
                  <th className="p-4 font-bold">Плотность</th>
                  <th className="p-4 font-bold">T крит.</th>
                  <th className="p-4 font-bold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD5E1]">
                {filtered.map((material) => (
                  <tr key={material.ID}>
                    <td className="p-4 font-bold">{material.Name}</td>
                    <td className="p-4">{material.Porosity}</td>
                    <td className="p-4">{material.Density}</td>
                    <td className="p-4">{material.CriticalTemperature}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEdit(material)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2">
                        <Edit2 className="w-4 h-4" /> Изменить
                      </button>
                      <button onClick={() => deleteMaterial(material.ID)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold">
                        <Trash2 className="w-4 h-4" /> Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#CBD5E1]">
                <h2 className="text-2xl font-extrabold">Компаунды</h2>
                <button onClick={openCompoundCreate} className="px-4 py-2 rounded-lg border border-[#CBD5E1] font-bold">Очистить форму</button>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3 border-b border-[#CBD5E1]">
                <input value={compoundForm.Name} onChange={(e) => setCompoundForm({ ...compoundForm, Name: e.target.value })} placeholder="Name" className="col-span-2 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <input type="number" value={compoundForm.CriticalTemperature} onChange={(e) => setCompoundForm({ ...compoundForm, CriticalTemperature: Number(e.target.value) })} placeholder="CriticalTemperature" className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                <button onClick={saveCompound} className="col-span-3 px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-bold">{editingCompoundId ? "Сохранить компаунд" : "Добавить компаунд"}</button>
              </div>
              <table className="w-full text-left">
                <tbody className="divide-y divide-[#CBD5E1]">
                  {filteredCompounds.map((compound) => (
                    <tr key={compound.ID} className={selectedCompoundId === compound.ID ? "bg-[#3B82F6]/10" : ""}>
                      <td className="p-4 font-bold cursor-pointer" onClick={() => setSelectedCompoundId(compound.ID)}>{compound.Name}</td>
                      <td className="p-4">{compound.CriticalTemperature}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => openCompoundEdit(compound)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2"><Edit2 className="w-4 h-4" />Изм.</button>
                        <button onClick={() => deleteCompound(compound.ID)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold"><Trash2 className="w-4 h-4" />Удал.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#CBD5E1]">
                <h2 className="text-2xl font-extrabold">Свойства компаунда #{selectedCompoundId || "-"}</h2>
                <button onClick={openPropertyCreate} className="px-4 py-2 rounded-lg border border-[#CBD5E1] font-bold">Очистить форму</button>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3 border-b border-[#CBD5E1]">
                {Object.keys(emptyProperty).map((key) => (
                  <input key={key} type="number" value={String(propertyForm[key as keyof typeof propertyForm])} onChange={(e) => setPropertyForm({ ...propertyForm, [key]: Number(e.target.value) })} placeholder={key} className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                ))}
                <button onClick={saveProperty} disabled={!selectedCompoundId} className="col-span-3 px-4 py-2 rounded-lg bg-[#16A34A] text-white font-bold disabled:opacity-50">{editingTemperature !== null ? "Сохранить свойства" : "Добавить свойства"}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F1F5F9] text-[#475569]">
                    <tr>
                      <th className="p-3">T</th>
                      <th className="p-3">Visc.</th>
                      <th className="p-3">Density</th>
                      <th className="p-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CBD5E1]">
                    {properties.map((property) => (
                      <tr key={property.Temperature}>
                        <td className="p-3 font-mono">{property.Temperature}</td>
                        <td className="p-3">{property.DynamicViscosity}</td>
                        <td className="p-3">{property.Density}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => openPropertyEdit(property)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold mr-2"><Edit2 className="w-4 h-4" />Изм.</button>
                          <button onClick={() => deleteProperty(property.Temperature)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold"><Trash2 className="w-4 h-4" />Удал.</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {isModalOpen && (
            <Editor
              title={editingId ? "Редактирование материала" : "Новый материал"}
              form={form}
              setForm={setForm}
              onClose={() => setIsModalOpen(false)}
              onSave={saveMaterial}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

function Editor({ title, form, setForm, onClose, onSave }: { title: string; form: Omit<Material, "ID">; setForm: (value: Omit<Material, "ID">) => void; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4">
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#CBD5E1]">
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {Object.keys(emptyMaterial).map((key) => (
            <label key={key} className="block">
              <span className="block text-sm font-bold mb-1">{key}</span>
              <input
                value={String(form[key as keyof typeof form])}
                onChange={(e) => setForm({ ...form, [key]: key === "Name" ? e.target.value : Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]"
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 p-5 bg-[#F1F5F9] border-t border-[#CBD5E1]">
          <button onClick={onClose} className="px-5 py-3 rounded-xl border border-[#CBD5E1] font-bold">Отмена</button>
          <button onClick={onSave} className="px-5 py-3 rounded-xl bg-[#16A34A] text-white font-bold">Сохранить</button>
        </div>
      </div>
    </div>
  );
}
