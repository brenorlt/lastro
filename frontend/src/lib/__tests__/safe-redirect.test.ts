import { safeRedirect } from "../safe-redirect";

describe("safeRedirect", () => {
  it.each([
    ["/metas?x=1#a", "/metas?x=1#a"],
    ["//evil.com", "/painel"],
    ["/\\evil.com", "/painel"],
    ["https://evil.com/painel", "/painel"],
    ["javascript:alert(1)", "/painel"],
    [null, "/painel"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
