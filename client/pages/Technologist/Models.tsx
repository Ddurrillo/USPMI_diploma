import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { apiRequest } from "@/lib/api";
import { Brain, Play, RefreshCw, Search, Trash2 } from "lucide-react";

interface AnalyticsModel {
  ID: number;
  CreatedAt: string;
  Name: string;
  Library: string;
  ModelType: string;
  Hyperparams: string;
  Metrics: string;
  Status: string;
  Description: string;
}

export default function TechModels() {
  const [models, setModels] = useState<AnalyticsModel[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [train, setTrain] = useState({
    name: "model_ep_v1",
    model_type: "linear_regression",
    library: "gonum",
    hyperparams: "",
    data_source: "experiments",
    source_ids: "1,2,3",
    features: "material.density,material.porosity,recipe.volume",
    targets: "EstPower",
  });
  const [predict, setPredict] = useState({ model_id: "", features: "material.density=600\nmaterial.porosity=0.45\nrecipe.volume=0.0001" });
  const [predictionResult, setPredictionResult] = useState<Record<string, unknown> | null>(null);

  const loadModels = async () => {
    setLoading(true);
    setMessage("");
    try {
      setModels(await apiRequest<AnalyticsModel[]>("/api/tech/ml/models?page=1&limit=100"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить модели");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModels();
  }, []);

  const filtered = useMemo(() => models.filter((model) => model.Name?.toLowerCase().includes(query.toLowerCase())), [models, query]);

  const trainModel = async () => {
    try {
      const response = await apiRequest<{ model_id: number }>("/api/tech/ml/train", {
        method: "POST",
        body: JSON.stringify({
          name: train.name,
          model_type: train.model_type,
          library: train.library,
          hyperparams: train.hyperparams,
          data_source: train.data_source,
          source_ids: train.source_ids.split(",").map((value) => Number(value.trim())).filter(Boolean),
          features: train.features.split(",").map((value) => value.trim()).filter(Boolean),
          targets: train.targets.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      setMessage(`Модель обучена, ID=${response.model_id}`);
      await loadModels();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось обучить модель");
    }
  };

  const runPrediction = async () => {
    const features: Record<string, number> = {};
    predict.features.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) features[key.trim()] = Number(value.trim());
    });
    try {
      setPredictionResult(await apiRequest<Record<string, unknown>>("/api/tech/ml/predict", {
        method: "POST",
        body: JSON.stringify({ model_id: Number(predict.model_id), features }),
      }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось выполнить прогноз");
    }
  };

  const deleteModel = async (id: number) => {
    if (!window.confirm(`Удалить модель #${id}? Файл модели также будет удален сервером.`)) return;
    try {
      await apiRequest(`/api/tech/ml/models/${id}`, { method: "DELETE" });
      await loadModels();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось удалить модель");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F1F5F9] py-8">
        <div className="mx-auto w-full max-w-7xl px-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#0F172A]">ML-модели</h1>
              <p className="text-lg text-[#475569] mt-2">Реестр, обучение и прогноз через `/api/tech/ml/*`.</p>
            </div>
            <button onClick={loadModels} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] font-bold">
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </button>
          </div>

          {message && <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#475569]">{message}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] space-y-4">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Brain className="w-6 h-6" />Обучение</h2>
              {Object.keys(train).map((key) => (
                <label key={key} className="block">
                  <span className="block text-sm font-bold mb-1">{key}</span>
                  <input value={String(train[key as keyof typeof train])} onChange={(e) => setTrain({ ...train, [key]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]" />
                </label>
              ))}
              <button onClick={trainModel} className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-[#16A34A] text-white font-bold">
                <Play className="w-5 h-5" /> Запустить обучение
              </button>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1] space-y-4">
              <h2 className="text-2xl font-extrabold">Прогноз</h2>
              <select value={predict.model_id} onChange={(e) => setPredict({ ...predict, model_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9]">
                <option value="">Выберите модель</option>
                {models.map((model) => <option key={model.ID} value={model.ID}>{model.Name} #{model.ID}</option>)}
              </select>
              <textarea value={predict.features} onChange={(e) => setPredict({ ...predict, features: e.target.value })} rows={7} className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#F1F5F9] font-mono" />
              <button onClick={runPrediction} disabled={!predict.model_id} className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-[#3B82F6] text-white font-bold disabled:opacity-50">
                Рассчитать
              </button>
              {predictionResult && <pre className="rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] p-4 overflow-auto">{JSON.stringify(predictionResult, null, 2)}</pre>}
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#CBD5E1]">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию модели" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <table className="w-full text-left">
              <thead className="bg-[#F1F5F9] text-[#475569]">
                <tr>
                  <th className="p-4 font-bold">Название</th>
                  <th className="p-4 font-bold">Движок</th>
                  <th className="p-4 font-bold">Статус</th>
                  <th className="p-4 font-bold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD5E1]">
                {filtered.map((model) => (
                  <tr key={model.ID}>
                    <td className="p-4 font-bold">{model.Name}<div className="text-sm text-[#64748B]">{model.CreatedAt}</div></td>
                    <td className="p-4">{model.Library} / {model.ModelType}</td>
                    <td className="p-4">{model.Status}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => deleteModel(model.ID)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#DC2626] font-semibold">
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
    </Layout>
  );
}
