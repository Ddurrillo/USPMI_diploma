import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronRight,
  Database,
  Droplet,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { AuthUser, clearSession, getCurrentUser } from "@/lib/api";

interface LayoutProps {
  children: ReactNode;
}

const menuItems = {
  operator: [
    { path: "/operator/work", label: "Назначенные работы", icon: <LayoutDashboard className="w-6 h-6" /> },
    { path: "/operator/equipment", label: "Диспетчерская панель", icon: <FlaskConical className="w-6 h-6" /> },
  ],
  technologist: [
    { path: "/tech/work", label: "Управление рецептами", icon: <Droplet className="w-6 h-6" /> },
    { path: "/tech/data", label: "Технические данные", icon: <BarChart3 className="w-6 h-6" /> },
    { path: "/tech/models", label: "Моделирование процессов", icon: <Settings className="w-6 h-6" /> },
  ],
  director: [
    { path: "/manager/work", label: "Производственная статистика", icon: <BarChart3 className="w-6 h-6" /> },
    { path: "/manager/clients", label: "Заказчики и контракты", icon: <User className="w-6 h-6" /> },
  ],
  admin: [
    { path: "/admin/users", label: "Пользователи", icon: <User className="w-6 h-6" /> },
    { path: "/admin/database", label: "Администрирование БД", icon: <Database className="w-6 h-6" /> },
  ],
};

const roleLabels: Record<string, string> = {
  operator: "Оператор",
  technologist: "Технолог",
  director: "Руководитель",
  admin: "Администратор",
  user: "Пользователь",
  guest: "Гость",
};

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const currentRole = user?.role ?? "operator";
  const items = menuItems[currentRole as keyof typeof menuItems] ?? [];

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      <aside className="w-80 bg-[#F8FAFC] border-r-2 border-[#CBD5E1] flex flex-col shadow-sm">
        <div className="p-6 border-b-2 border-[#CBD5E1] bg-gradient-to-r from-[#3B82F6] to-[#2563EB]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#F8FAFC] rounded-xl flex items-center justify-center shadow-md">
              <span className="text-[#3B82F6] font-extrabold text-lg">SP</span>
            </div>
            <div>
              <h1 className="font-extrabold text-[#F1F5F9] text-2xl tracking-tight">SonicPro</h1>
              <p className="text-blue-100 text-sm font-medium">УЗ пропитка</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-5 space-y-3 overflow-y-auto">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-semibold transition-all duration-200 group ${
                  isActive
                    ? "bg-[#3B82F6] text-[#F1F5F9] shadow-md transform scale-[1.02]"
                    : "text-[#475569] hover:bg-[#3B82F6]/10 hover:text-[#3B82F6] hover:pl-6"
                }`}
              >
                <span className={`${isActive ? "text-[#F1F5F9]" : "text-[#94A3B8] group-hover:text-[#3B82F6]"} transition-colors`}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="w-5 h-5 opacity-80" />}
              </button>
            );
          })}
        </nav>

        <div className="p-5 border-t-2 border-[#CBD5E1] bg-[#F1F5F9]">
          <div className="flex items-center gap-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] shadow-sm mb-4">
            <div className="w-14 h-14 bg-[#3B82F6]/10 rounded-full flex items-center justify-center border-2 border-[#3B82F6]/30">
              <User className="w-7 h-7 text-[#3B82F6]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-[#0F172A] truncate">{user?.username}</p>
              <p className="text-base text-[#475569] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                {roleLabels[currentRole] ?? currentRole}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 text-lg font-semibold text-[#475569] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded-xl transition-all border-2 border-[#CBD5E1] hover:border-[#DC2626]/30"
          >
            <LogOut className="w-6 h-6" />
            <span>Выйти из системы</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[#F1F5F9]">{children}</main>
    </div>
  );
}
