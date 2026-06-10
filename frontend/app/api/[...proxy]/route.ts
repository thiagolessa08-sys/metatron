import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "https://metatron-production.up.railway.app"

async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const url = `${BACKEND}/api/${segments.join("/")}${req.nextUrl.search}`
  const hasBody = !["GET", "HEAD"].includes(req.method)

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    if (!["host", "connection", "transfer-encoding", "content-length"].includes(k)) headers[k] = v
  })

  try {
    // Repassa o corpo como binário (ArrayBuffer) — usar req.text() corromperia
    // uploads binários (multipart): bytes >= 0x80 virariam o caractere de
    // substituição UTF-8 (ef bf bd). JSON continua funcionando normalmente.
    const body = hasBody ? await req.arrayBuffer() : undefined
    const res = await fetch(url, { method: req.method, headers, body })

    const resHeaders = new Headers()
    res.headers.forEach((v, k) => {
      if (!["transfer-encoding", "content-encoding"].includes(k)) resHeaders.set(k, v)
    })

    const respBody = await res.arrayBuffer()
    return new NextResponse(respBody, { status: res.status, headers: resHeaders })
  } catch (err) {
    return NextResponse.json(
      { error: "proxy_failed", detail: String(err), backend: BACKEND, target: url },
      { status: 502 }
    )
  }
}

type Ctx = { params: Promise<{ proxy: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
export async function POST(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
export async function PUT(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
export async function PATCH(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
export async function DELETE(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
export async function OPTIONS(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
