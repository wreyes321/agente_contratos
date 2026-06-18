"use client"

import { useLocation, useNavigate } from "react-router-dom"
import { MessageSquare, FileUp, LogOut, ChevronsLeft, ChevronsRight } from "lucide-react"
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

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user } = useAuth()

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r bg-muted/30 transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Brand */}
      <div className="p-3 border-b flex items-center justify-between min-h-[56px]">
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-semibold tracking-tight whitespace-nowrap">
              Agente Contratos
            </h2>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              Asistente de documentos
            </p>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
            collapsed && "mx-auto"
          )}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-2 border-t">
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-2",
          collapsed ? "justify-center" : ""
        )}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {user?.profile?.email || "Usuario"}
              </p>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
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
