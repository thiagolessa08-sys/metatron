import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

export interface FilterItem {
  id: string
  label: string
}

export interface FilterOptions {
  campanhas: FilterItem[]
  operadores: FilterItem[]
  qualificacoes: FilterItem[]
}

export function useFilterOptions() {
  return useQuery<FilterOptions>({
    queryKey: ["filter-options"],
    queryFn: async () => {
      const { data } = await api.get("/api/filters/options")
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}
