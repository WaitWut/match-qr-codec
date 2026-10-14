/** Builds a JSON Pointer (RFC 6901) from path segments. */
export function pointer(...segments: (string | number)[]): string {
  return segments
    .map((segment) => "/" + String(segment).replace(/~/g, "~0").replace(/\//g, "~1"))
    .join("");
}
