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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  uploadDocument,
  listDocuments,
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
  const { token } = useAuth()

  // Load existing documents on mount
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
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFiles = async () => {
    if (!token) {
      alert("Debes iniciar sesión para subir archivos")
      return
    }

    setIsUploading(true)

    const pendingFiles = files.filter((f) => f.status === "pending")

    for (const fileWithStatus of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileWithStatus.id
            ? { ...f, status: "uploading" as const }
            : f
        )
      )

      try {
        const result = await uploadDocument(
          fileWithStatus.file,
          token,
          (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileWithStatus.id ? { ...f, progress } : f
              )
            )
          }
        )

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithStatus.id
              ? { ...f, status: "success" as const, progress: 100, result }
              : f
          )
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Error desconocido"
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
    // Refresh the document list
    loadExistingDocuments()
  }

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "success"))
  }

  const pendingCount = files.filter((f) => f.status === "pending").length
  const successCount = files.filter((f) => f.status === "success").length

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Cargar Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Sube archivos PDF para procesarlos con el agente. Los documentos se
          almacenan en Amazon S3.
        </p>
      </div>

      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "rounded-full p-4 transition-colors",
              isDragActive ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <p className="text-lg font-medium">
              {isDragActive
                ? "Suelta los archivos aquí"
                : "Arrastra y suelta archivos PDF"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              o haz clic para seleccionar archivos (máx. 50MB)
            </p>
          </div>
        </div>
      </Card>

      {/* Upload Queue */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Cola de subida ({files.length})
            </h2>
            <div className="flex gap-2">
              {successCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCompleted}>
                  Limpiar completados
                </Button>
              )}
              {pendingCount > 0 && (
                <Button size="sm" onClick={uploadFiles} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Subir {pendingCount} archivo
                      {pendingCount > 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {files.map((fileWithStatus) => (
              <Card
                key={fileWithStatus.id}
                className="p-4 flex items-center gap-3"
              >
                <div className="shrink-0">
                  {fileWithStatus.status === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : fileWithStatus.status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : fileWithStatus.status === "uploading" ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {fileWithStatus.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileWithStatus.file.size)}
                    {fileWithStatus.status === "error" &&
                      fileWithStatus.error && (
                        <span className="text-destructive ml-2">
                          — {fileWithStatus.error}
                        </span>
                      )}
                    {fileWithStatus.status === "success" && (
                      <span className="text-green-600 ml-2">
                        — Subido exitosamente
                      </span>
                    )}
                  </p>

                  {fileWithStatus.status === "uploading" && (
                    <Progress
                      value={fileWithStatus.progress}
                      className="mt-2 h-1.5"
                    />
                  )}
                </div>

                {(fileWithStatus.status === "pending" ||
                  fileWithStatus.status === "error") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(fileWithStatus.id)}
                    className="shrink-0"
                    aria-label={`Eliminar ${fileWithStatus.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Existing Documents */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">
            Documentos en S3 ({existingDocs.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadExistingDocuments}
            disabled={isLoadingDocs}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1", isLoadingDocs && "animate-spin")}
            />
            Actualizar
          </Button>
        </div>

        {isLoadingDocs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : existingDocs.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              No hay documentos en el bucket.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {existingDocs.map((doc) => (
              <Card key={doc.key} className="p-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size)} •{" "}
                    {new Date(doc.lastModified).toLocaleDateString("es-CR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
