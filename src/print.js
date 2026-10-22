export function renderPrintHtml(request, format) {
  if (!request || typeof request.build !== "function") return "";
  return request.build(format, request.profile);
}
