import { MethodNotAllowedError } from "../errors.js";
function allowedMethods(allowedMethods2) {
  return (req, res, next) => {
    if (allowedMethods2.includes(req.method)) {
      next();
      return;
    }
    const error = new MethodNotAllowedError(`The method ${req.method} is not allowed for this endpoint`);
    res.status(405).set("Allow", allowedMethods2.join(", ")).json(error.toResponseObject());
  };
}
export {
  allowedMethods
};
//# sourceMappingURL=allowedMethods.js.map
