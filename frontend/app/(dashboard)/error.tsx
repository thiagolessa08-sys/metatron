"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md w-full border-destructive/40">
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Erro ao carregar a página</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message || "Ocorreu um erro inesperado. Tente novamente."}
            </p>
          </div>
          <Button onClick={reset} variant="outline" size="sm">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
