# Tasks — spec-drop-vite-lab-fixture-name

> Seam：`llman sdd validate --specs --strict` + `llman sdd validate --all --strict`
>
> - `llman sdd review`。纯 spec 措辞变更，无代码面。

- [x] T1 r400 措辞收敛：去除 `VITE_LAB_FIXTURE` 变量名，改为「fixture 切换面已废除，
      MUST NOT 重新引入任何 fixture 切换面（含环境变量或查询参数）」；MUST NOT 语义等价或更强
- [x] T2 r453 措辞收敛：「在 VITE_LAB_FIXTURE 未设时」→「在默认（生产）构建配置下」
- [x] 验证：`llman sdd validate --specs --strict` 全绿（@req 链与 Gherkin 结构不变）→ 35/35
