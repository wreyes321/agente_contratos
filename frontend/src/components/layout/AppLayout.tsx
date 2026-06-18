"use client"

import { PropsWithChildren, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Menu, MessageSquare, FileUp, LogOut } from "lucide-react"
import { AppSidebar } from "./AppSidebar"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Agente", icon: MessageSquare, path: "/" },
  { label: "Documentos", icon: FileUp, path: "/documents" },
]

export function AppLayout({ children }: PropsWithChildren) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {/* Brand */}
            <div className="p-4 border-b">
              <h2 className="text-sm font-semibold tracking-tight">Agente Contratos</h2>
              <p className="text-[10px] text-muted-foreground">Asistente de documentos</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setMobileOpen(false)
                    }}
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

            {/* User */}
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
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden shrink-0 flex items-center gap-3 px-4 py-3 border-b">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">Agente Contratos</h1>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
