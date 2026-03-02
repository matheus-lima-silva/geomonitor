var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// utils/statusUtils.js
var statusUtils_exports = {};
__export(statusUtils_exports, {
  erosionStatusClass: () => erosionStatusClass,
  normalizeErosionStatus: () => normalizeErosionStatus,
  normalizeUserStatus: () => normalizeUserStatus
});
module.exports = __toCommonJS(statusUtils_exports);
function normalizeUserStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["pendente", "pending", "aguardando"].includes(normalized)) return "Pendente";
  if (["inativo", "inactive", "desativado", "off"].includes(normalized)) return "Inativo";
  return "Ativo";
}
function normalizeErosionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["monitorado", "monitoramento", "monitoring"].includes(normalized)) return "Monitoramento";
  if (["estabilizado", "stabilized"].includes(normalized)) return "Estabilizado";
  if (["resolvido", "resolved", "resolvida"].includes(normalized)) return "Estabilizado";
  return "Ativo";
}
function erosionStatusClass(status) {
  const normalized = normalizeErosionStatus(status);
  if (normalized === "Estabilizado") return "status-chip status-ok";
  if (normalized === "Monitoramento") return "status-chip status-warn";
  return "status-chip status-danger";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  erosionStatusClass,
  normalizeErosionStatus,
  normalizeUserStatus
});
