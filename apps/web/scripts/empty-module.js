// B1 stub (see rsbuild.config.ts): target of NormalModuleReplacementPlugin for
// pptxgenjs's browser-never-executed `import('node:fs'|'node:https')` branches.
// ESM（apps/web package.json "type": "module"）；提供 default 导出与旧 CJS
// `module.exports = {}` 等价的替身语义。
export default {};
