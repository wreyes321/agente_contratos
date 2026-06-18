"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Download,
  Search,
  FolderOpen,
  MoreVertical,
  Clock,
  HardDrive,
  CalendarDays,
  Plus,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  uploadDocument,
  listDocuments,
  getDocumentPreviewUrl,
  UploadResult,
  DocumentItem,
} from "@/services/s3UploadService"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface FileWithStatus {
  file: File
  id: string
  status: "pending" | "uploading" | "success" | "error"
  progress: number
  error?: string
  result?: UploadResult
}

export function DocumentUpload() {
  const [files, setFiles] = useState<FileWithStatus[]>([])
  const [existingDocs, setExistingDocs] = useState<DocumentItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFileName, setPreviewFileName] = useState("")
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { token } = useAuth()

  // Track screen size for responsive behavior
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (token) {
      loadExistingDocuments()
    }
  }, [token])

  const loadExistingDocuments = async () => {
    if (!token) return
    setIsLoadingDocs(true)
    try {
      const docs = await listDocuments(token)
      setExistingDocs(docs)
    } catch (error) {
      console.error("Error loading documents:", error)
    } finally {
      setIsLoadingDocs(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithStatus[] = acceptedFiles.map((file) => ({
      file,
      id: crypto.randomUUID(),
      status: "pending" as const,
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...newFiles])
    setShowUploadZone(true)
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 50 * 1024 * 1024,
    noClick: true,
  })

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFiles = async () => {
    if (!token) return
    setIsUploading(true)
    const pendingFiles = files.filter((f) => f.status === "pending")

    for (const fileWithStatus of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileWithStatus.id ? { ...f, status: "uploading" as const } : f
        )
      )

      try {
        const result = await uploadDocument(fileWithStatus.file, token, (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileWithStatus.id ? { ...f, progress } : f))
          )
        })

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithStatus.id
              ? { ...f, status: "success" as const, progress: 100, result }
              : f
          )
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido"
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithStatus.id
              ? { ...f, status: "error" as const, error: errorMessage }
              : f
          )
        )
      }
    }

    setIsUploading(false)
    loadExistingDocuments()
  }

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "success"))
    if (files.filter((f) => f.status !== "success").length === 0) {
      setShowUploadZone(false)
    }
  }

  const openPreview = async (doc: DocumentItem) => {
    if (!token) return
    setIsLoadingPreview(true)
    setPreviewFileName(doc.fileName)
    try {
      const url = await getDocumentPreviewUrl(doc.key, token)
      setPreviewUrl(url)
    } catch (error) {
      console.error("Error getting preview URL:", error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const downloadDocument = async (doc: DocumentItem) => {
    if (!token) return
    try {
      const url = await getDocumentPreviewUrl(doc.key, token)
      const link = document.createElement("a")
      link.href = url
      link.download = doc.fileName
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading document:", error)
    }
  }

  const pendingCount = files.filter((f) => f.status === "pending").length
  const successCount = files.filter((f) => f.status === "success").length

  const filteredDocs = existingDocs.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Recent files: last 4 uploaded
  const recentDocs = [...existingDocs]
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
    .slice(0, 4)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatDateFull = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div {...getRootProps()} className="flex h-full overflow-hidden">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full p-4 bg-primary/10">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-medium text-primary">Suelta los archivos aquí</p>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Mis Documentos</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar archivos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/50"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadExistingDocuments}
              disabled={isLoadingDocs}
              className="h-9 shrink-0"
            >
              <RefreshCw className={cn("h-4 w-4", isLoadingDocs && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={open} className="h-9 shrink-0">
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Subir archivo</span>
            </Button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
          {/* Upload Zone (shown when files are queued or toggled) */}
          {(showUploadZone || files.length > 0) && (
            <Card className="p-4 border-primary/20 bg-primary/[0.02]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  Cola de subida ({files.length})
                </h3>
                <div className="flex gap-2">
                  {successCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearCompleted} className="h-7 text-xs">
                      Limpiar
                    </Button>
                  )}
                  {pendingCount > 0 && (
                    <Button size="sm" onClick={uploadFiles} disabled={isUploading} className="h-7 text-xs">
                      {isUploading ? (
                        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Subiendo...</>
                      ) : (
                        <><Upload className="h-3 w-3 mr-1.5" />Subir {pendingCount}</>
                      )}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setShowUploadZone(false); setFiles([]) }} className="h-7 w-7 p-0">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-background border">
                    <div className="shrink-0">
                      {f.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : f.status === "error" ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : f.status === "uploading" ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.file.name}</p>
                      {f.status === "uploading" && <Progress value={f.progress} className="mt-1 h-1" />}
                      {f.status === "error" && <p className="text-xs text-destructive">{f.error}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(f.file.size)}</span>
                    {(f.status === "pending" || f.status === "error") && (
                      <button onClick={() => removeFile(f.id)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Files */}
          {recentDocs.length > 0 && !searchQuery && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Archivos recientes
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {recentDocs.map((doc) => (
                  <Card
                    key={doc.key}
                    className={cn(
                      "p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group",
                      selectedDoc?.key === doc.key && "border-primary shadow-md"
                    )}
                    onClick={() => setSelectedDoc(doc)}
                    onDoubleClick={() => openPreview(doc)}
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="relative">
                        <div className="w-12 h-14 rounded bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-red-500" />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); openPreview(doc) }}
                          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-full p-1 shadow-sm hover:bg-muted"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs font-medium truncate w-full" title={doc.fileName}>
                        {doc.fileName}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Files Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Todos los archivos
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  {filteredDocs.length} total
                </span>
              </h2>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Filter className="h-3 w-3" />
                Filtrar
              </Button>
            </div>

            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Cargando documentos...</p>
                </div>
              </div>
            ) : filteredDocs.length === 0 ? (
              <Card className="p-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {searchQuery ? "No se encontraron documentos" : "No hay documentos"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {searchQuery ? "Intenta con otro término" : "Sube tu primer documento para empezar"}
                </p>
                {!searchQuery && (
                  <Button size="sm" onClick={open}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Subir archivo
                  </Button>
                )}
              </Card>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-card">
                {/* Table Header - hidden on mobile */}
                <div className="hidden sm:grid grid-cols-[1fr_100px_140px_60px] gap-4 px-4 py-2.5 bg-muted/40 border-b">
                  <span className="text-xs font-medium text-muted-foreground">Nombre del archivo</span>
                  <span className="text-xs font-medium text-muted-foreground">Tamaño</span>
                  <span className="text-xs font-medium text-muted-foreground">Última modificación</span>
                  <span className="text-xs font-medium text-muted-foreground text-center">···</span>
                </div>

                {/* Table Rows */}
                <div className="divide-y">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.key}
                      onClick={() => setSelectedDoc(doc)}
                      onDoubleClick={() => openPreview(doc)}
                      className={cn(
                        "flex sm:grid sm:grid-cols-[1fr_100px_140px_60px] gap-3 sm:gap-4 px-4 py-3 items-center cursor-pointer transition-colors group",
                        selectedDoc?.key === doc.key
                          ? "bg-primary/5"
                          : "hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0 w-8 h-8 rounded-md bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {formatFileSize(doc.size)} • {formatDate(doc.lastModified)}
                          </p>
                        </div>
                      </div>
                      <p className="hidden sm:block text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
                      <p className="hidden sm:block text-xs text-muted-foreground">{formatDate(doc.lastModified)}</p>
                      <div className="flex items-center gap-0.5 sm:justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); openPreview(doc) }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Previsualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadDocument(doc) }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Descargar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right panel - File Details (desktop only) */}
      {selectedDoc && (
        <div className="hidden lg:flex w-72 border-l bg-muted/20 shrink-0 flex-col overflow-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-medium">Detalles del archivo</h3>
            <button
              onClick={() => setSelectedDoc(null)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 flex flex-col items-center text-center border-b">
            <div className="w-16 h-20 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-3">
              <FileText className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-sm font-medium break-all px-2">{selectedDoc.fileName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Modificado {formatDate(selectedDoc.lastModified)}
            </p>
          </div>

          <div className="p-4 space-y-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Información
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Tamaño</p>
                  <p className="text-sm font-medium">{formatFileSize(selectedDoc.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="text-sm font-medium">{formatDateFull(selectedDoc.lastModified)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Ubicación</p>
                  <p className="text-sm font-medium truncate">contratos/</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 mt-auto border-t space-y-2">
            <Button size="sm" className="w-full" onClick={() => openPreview(selectedDoc)}>
              <Eye className="h-4 w-4 mr-2" />
              Previsualizar
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => downloadDocument(selectedDoc)}>
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog
        open={!!previewUrl || isLoadingPreview}
        onOpenChange={() => { setPreviewUrl(null); setPreviewFileName("") }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-red-500" />
              <span className="truncate">{previewFileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Cargando documento...</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Preview: ${previewFileName}`}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile file details dialog */}
      <Dialog
        open={!!selectedDoc && isMobile}
        onOpenChange={(open) => { if (!open) setSelectedDoc(null) }}
      >
        {selectedDoc && (
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-500" />
                <span className="truncate">{selectedDoc.fileName}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tamaño</p>
                  <p className="text-sm font-medium">{formatFileSize(selectedDoc.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="text-sm font-medium">{formatDateFull(selectedDoc.lastModified)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Ubicación</p>
                  <p className="text-sm font-medium">contratos/</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1" onClick={() => { openPreview(selectedDoc); setSelectedDoc(null) }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Previsualizar
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { downloadDocument(selectedDoc); setSelectedDoc(null) }}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
