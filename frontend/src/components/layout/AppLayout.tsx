"use client"

import { PropsWithChildren } from "react"
import { AppSidebar } from "./AppSidebar"

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
