import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000"

async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const url = `${BACKEND}/health/${segments.join("/")}${req.nextUrl.search}`
  try {
    const res = await fetch(url, { method: req.method })
    const body = await res.arrayBuffer()
    const resHeaders = new Headers()
    res.headers.forEach((v, k) => {
      if (!["transfer-encoding", "content-encoding"].includes(k)) resHeaders.set(k, v)
    })
    return new NextResponse(body, { status: res.status, headers: resHeaders })
  } catch (err) {
    return NextResponse.json(
      { error: "proxy_failed", detail: String(err), backend: BACKEND, target: url },
      { status: 502 }
    )
  }
}

type Ctx = { params: Promise<{ proxy: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).proxy) }
