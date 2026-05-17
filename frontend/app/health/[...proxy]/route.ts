import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000"

async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const url = `${BACKEND}/health/${segments.join("/")}${req.nextUrl.search}`

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    if (!["host", "connection", "transfer-encoding"].includes(k)) headers[k] = v
  })

  const res = await fetch(url, { method: req.method, headers })
  const resHeaders = new Headers()
  res.headers.forEach((v, k) => {
    if (k !== "transfer-encoding") resHeaders.set(k, v)
  })

  return new NextResponse(res.body, { status: res.status, headers: resHeaders })
}

type Ctx = { params: Promise<{ proxy: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).proxy)
}
