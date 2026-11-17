import { wellKnown } from "../../well-known";

/** RFC 9728: metadados do recurso protegido /api/mcp (também sem sufixo de caminho). */
export const GET = () => wellKnown("/api/oauth/protected-resource");
