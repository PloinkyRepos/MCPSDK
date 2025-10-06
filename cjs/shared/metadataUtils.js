"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
function getDisplayName(metadata) {
  if (metadata.title !== void 0 && metadata.title !== "") {
    return metadata.title;
  }
  if ("annotations" in metadata) {
    const metadataWithAnnotations = metadata;
    if (metadataWithAnnotations.annotations?.title) {
      return metadataWithAnnotations.annotations.title;
    }
  }
  return metadata.name;
}
exports.getDisplayName = getDisplayName;
//# sourceMappingURL=metadataUtils.js.map
