import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { login, UserRole } from "@/lib/api";

const ROLE_REDIRECTS: Record<UserRole, string> = {
  operator: "/operator/work",
  technologist: "/tech/work",
  director: "/manager/work",
  admin: "/admin/users",
  user: "/login",
  guest: "/login",
};

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Заполните логин и пароль");
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(username, password);
      navigate(ROLE_REDIRECTS[user.role] ?? "/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный логин или пароль");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="bg-[#F8FAFC] rounded-xl shadow-xl p-12 border border-[#CBD5E1]">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#3B82F6] rounded-xl mb-5 shadow-md">
              <div className="w-10 h-10 bg-[#F8FAFC] rounded-lg flex items-center justify-center">
                <div className="text-[#3B82F6] font-bold text-xl">SP</div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-[#0F172A]">SonicPro</h1>
            <p className="text-base text-[#475569] mt-2">Система управления ультразвуковой пропиткой</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-base font-medium text-[#0F172A] mb-2">Логин</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3 border rounded-lg outline-none transition text-base border-[#CBD5E1] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 bg-[#F1F5F9] text-[#0F172A]"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-base font-medium text-[#0F172A] mb-2">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-3 border rounded-lg outline-none transition pr-12 text-base border-[#CBD5E1] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 bg-[#F1F5F9] text-[#0F172A]"
                  placeholder="admin123"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#475569]">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <div className="p-3 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-lg text-base text-[#DC2626] font-medium">{error}</div>}
            <button type="submit" disabled={isLoading} className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white py-3 rounded-lg text-base font-semibold transition disabled:opacity-50 shadow-md">
              {isLoading ? "Вход..." : "Войти в систему"}
            </button>
          </form>

          <p className="text-sm text-[#64748B] text-center border-t border-[#CBD5E1] pt-6 mt-8">
            По умолчанию Go-сервер создает администратора admin / admin123.
          </p>
        </div>
      </div>
    </div>
  );
}
