"use client"

import { useLocation, useNavigate } from "react-router-dom"
import { MessageSquare, FileUp, LogOut } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "Agente",
    icon: MessageSquare,
    path: "/",
  },
  {
    label: "Documentos",
    icon: FileUp,
    path: "/documents",
  },
]

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user } = useAuth()

  return (
    <aside className="flex flex-col h-full w-64 border-r bg-muted/30">
      {/* Logo / Brand */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold tracking-tight">
          Agente Contratos
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Asistente de documentos
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {user?.profile?.email || "Usuario"}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
