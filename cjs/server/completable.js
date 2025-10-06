"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
var McpZodTypeKind = /* @__PURE__ */ ((McpZodTypeKind2) => {
  McpZodTypeKind2["Completable"] = "McpCompletable";
  return McpZodTypeKind2;
})(McpZodTypeKind || {});
class Completable extends zod.ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
  static {
    this.create = (type, params) => {
      return new Completable({
        type,
        typeName: "McpCompletable",
        complete: params.complete,
        ...processCreateParams(params)
      });
    };
  }
}
function completable(schema, complete) {
  return Completable.create(schema, { ...schema._def, complete });
}
function processCreateParams(params) {
  if (!params) return {};
  const { errorMap, invalid_type_error, required_error, description } = params;
  if (errorMap && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap) return { errorMap, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type") return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
exports.Completable = Completable;
exports.McpZodTypeKind = McpZodTypeKind;
exports.completable = completable;
//# sourceMappingURL=completable.js.map
