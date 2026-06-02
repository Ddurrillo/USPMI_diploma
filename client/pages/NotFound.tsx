import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="text-6xl font-bold text-primary">404</div>
        <h1 className="text-3xl font-bold text-foreground">Страница не найдена</h1>
        <p className="text-muted-foreground max-w-md">
          К сожалению, страница, которую вы ищете, не существует или была удалена.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 transition"
          >
            На главную
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-border text-foreground rounded-lg font-medium hover:bg-secondary transition"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
