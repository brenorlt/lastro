import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteção de rotas privadas (camada de UX). Sem o cookie indicador de sessão,
 * redireciona para o login preservando o destino. A barreira real é o JwtAuthGuard
 * do NestJS: este cookie não contém segredo e sozinho não dá acesso a nenhum dado.
 */
const SESSION_COOKIE = "lastro_session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/entrar";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/lancamentos/:path*",
    "/contas/:path*",
    "/cartoes/:path*",
    "/categorias/:path*",
    "/orcamento/:path*",
    "/metas/:path*",
    "/reserva/:path*",
    "/planejamento/:path*",
    "/investimentos/:path*",
    "/patrimonio/:path*",
    "/relatorios/:path*",
    "/notificacoes/:path*",
    "/perfil/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
  ],
};
