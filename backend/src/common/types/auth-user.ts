/** Usuário autenticado anexado a `request.user` pelo JwtAuthGuard. */
export interface AuthUser {
  id: string;
  sessionId: string;
}

/** Payload do access token (JWT). */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
}
