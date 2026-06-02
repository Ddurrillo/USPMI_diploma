import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { ArrowLeft, Zap } from "lucide-react";

interface PlaceholderProps {
  title: string;
  description?: string;
}

export default function Placeholder({ title, description }: PlaceholderProps) {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-primary hover:text-blue-400 transition text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-4">
          <Zap className="w-12 h-12 text-primary mx-auto opacity-50" />
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Эта страница находится в разработке. Продолжайте для добавления содержимого.
          </p>
        </div>
      </div>
    </Layout>
  );
}
