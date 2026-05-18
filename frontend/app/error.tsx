"use client"

import { useEffect } from "react"

export default function GlobalError({
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
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4 font-sans">
          <p className="text-7xl font-bold text-red-200">500</p>
          <h1 className="text-2xl font-bold">Erro inesperado</h1>
          <p className="text-sm text-gray-500 max-w-sm">
            Algo deu errado. Tente novamente ou entre em contato com o suporte.
          </p>
          <button
            onClick={reset}
            className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
