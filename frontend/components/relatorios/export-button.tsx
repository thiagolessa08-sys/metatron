"use client"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"

interface ExportButtonProps {
  endpoint: string
  body: Record<string, unknown>
  filename: string
}

export function ExportButton({ endpoint, body, filename }: ExportButtonProps) {
  async function download(fmt: "csv" | "xlsx") {
    try {
      const { data } = await api.post(`${endpoint}?format=${fmt}`, body, {
        responseType: "blob",
      })
      const url = URL.createObjectURL(new Blob([data]))
      const a = document.createElement("a")
      a.href = url
      a.download = `${filename}.${fmt}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Erro ao exportar. Tente novamente.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => download("csv")}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => download("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
