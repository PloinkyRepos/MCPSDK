"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const errors = require("../errors.js");
function allowedMethods(allowedMethods2) {
  return (req, res, next) => {
    if (allowedMethods2.includes(req.method)) {
      next();
      return;
    }
    const error = new errors.MethodNotAllowedError(`The method ${req.method} is not allowed for this endpoint`);
    res.status(405).set("Allow", allowedMethods2.join(", ")).json(error.toResponseObject());
  };
}
exports.allowedMethods = allowedMethods;
//# sourceMappingURL=allowedMethods.js.map
