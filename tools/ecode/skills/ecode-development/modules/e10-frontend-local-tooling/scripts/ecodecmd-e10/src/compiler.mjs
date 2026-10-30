import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Babel = require("./vendor/babel.cjs");

export function compileE10(code, filename) {
  try {
    return Babel.transform(String(code), {
      presets: ["es2015", "react", ["stage-2", { decoratorsLegacy: true, loose: true }]],
      filename,
      plugins: ["proposal-object-rest-spread", "proposal-optional-chaining"],
      sourceMap: false,
      sourceType: "module",
    }).code;
  } catch (error) {
    throw new Error(`编译失败 ${filename}: ${error.message}`);
  }
}

export function wrapE10Module(content, relativePath) {
  const indented = content
    .replace(/"use strict";\n\n/, "")
    .replace(/\n/g, "\n        ")
    .replace(/%40weapp/g, "@weapp");
  return `(function () {
      "use strict";
      window.weappEcodesdk.jsonp.export("\${appId}", "${relativePath}", function () {
        var exports = {};
        var require = window.weappEcodesdk.jsonp.require.bind(null, "\${appId}", "${relativePath}");

        ${indented}

        return exports;
      })
    })();`;
}
