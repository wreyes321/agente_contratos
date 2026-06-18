"use client"

import { DocumentUpload } from "@/components/documents/DocumentUpload"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

export default function DocumentsPage() {
  const { isAuthenticated, signIn } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-4xl">Please sign in</p>
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    )
  }

  return <DocumentUpload />
}
