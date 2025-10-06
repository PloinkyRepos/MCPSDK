import express from "express";
import cors from "cors";
import { allowedMethods } from "../middleware/allowedMethods.js";
function metadataHandler(metadata) {
  const router = express.Router();
  router.use(cors());
  router.use(allowedMethods(["GET"]));
  router.get("/", (req, res) => {
    res.status(200).json(metadata);
  });
  return router;
}
export {
  metadataHandler
};
//# sourceMappingURL=metadata.js.map
