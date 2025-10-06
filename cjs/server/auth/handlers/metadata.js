"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const express = require("express");
const cors = require("cors");
const allowedMethods = require("../middleware/allowedMethods.js");
function metadataHandler(metadata) {
  const router = express.Router();
  router.use(cors());
  router.use(allowedMethods.allowedMethods(["GET"]));
  router.get("/", (req, res) => {
    res.status(200).json(metadata);
  });
  return router;
}
exports.metadataHandler = metadataHandler;
//# sourceMappingURL=metadata.js.map
