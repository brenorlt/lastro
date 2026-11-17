import { wellKnown } from "../well-known";

/** RFC 8414: metadados do servidor de autorização (gerados pelo backend). */
export const GET = () => wellKnown("/api/oauth/metadata");
