import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { getCurrentUser, UserRole } from "./lib/api";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Operator
import OperatorWork from "./pages/Operator/Work";
import OperatorEquipment from "./pages/Operator/Equipment";

// Technologist
import TechRecipes from "./pages/Technologist/Recipes";
import TechData from "./pages/Technologist/Data";
import TechModels from "./pages/Technologist/Models";

// Manager
import ManagerStatistics from "./pages/Manager/Statistics";
import ManagerClients from "./pages/Manager/Clients";

// Admin
import AdminUsers from "./pages/Admin/Users";
import AdminDatabase from "./pages/Admin/Database";

const queryClient = new QueryClient();

const ROLE_REDIRECTS: Record<string, string> = {
  operator: "/operator/work",
  technologist: "/tech/work",
  director: "/manager/work",
  admin: "/admin/users",
};

function RequireAuth({ children, roles }: { children: ReactNode; roles: UserRole[] }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && !roles.includes(user.role)) return <Navigate to={ROLE_REDIRECTS[user.role] ?? "/login"} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to={getCurrentUser() ? (ROLE_REDIRECTS[getCurrentUser()!.role] ?? "/login") : "/login"} replace />} />
            <Route path="/login" element={<Login />} />

            {/* Оператор */}
            <Route path="/operator/work" element={<RequireAuth roles={["operator"]}><OperatorWork /></RequireAuth>} />
            <Route path="/operator/equipment" element={<RequireAuth roles={["operator"]}><OperatorEquipment /></RequireAuth>} />

            {/* Технолог */}
            <Route path="/tech/work" element={<RequireAuth roles={["technologist"]}><TechRecipes /></RequireAuth>} />
            <Route path="/tech/data" element={<RequireAuth roles={["technologist"]}><TechData /></RequireAuth>} />
            <Route path="/tech/models" element={<RequireAuth roles={["technologist"]}><TechModels /></RequireAuth>} />

            {/* Руководитель */}
            <Route path="/manager/work" element={<RequireAuth roles={["director"]}><ManagerStatistics /></RequireAuth>} />
            <Route path="/manager/clients" element={<RequireAuth roles={["director"]}><ManagerClients /></RequireAuth>} />

            {/* Администратор */}
            <Route path="/admin/users" element={<RequireAuth roles={["admin"]}><AdminUsers /></RequireAuth>} />
            <Route path="/admin/database" element={<RequireAuth roles={["admin"]}><AdminDatabase /></RequireAuth>} />

            <Route path="/not-found" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/not-found" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
