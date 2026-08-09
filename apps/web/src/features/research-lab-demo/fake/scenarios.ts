import type { LabNode, LabPhaseSnapshot, LabScenario } from '../../research-lab/model/types';

function emptySnap(
  visibleNodeIds: string[],
  metrics: LabPhaseSnapshot['metrics'],
  activityLog: string[] = [],
  nodeOverrides?: Partial<Record<string, Partial<LabNode>>>,
): LabPhaseSnapshot {
  return { visibleNodeIds, metrics, activityLog, nodeOverrides };
}

/**
 * v1 shape: question (root) → research nodes → single conclusion sink.
 * Intermediate nodes hold findings; only `conclusion` is the final answer node.
 */

const xlsxLib: LabScenario = {
  id: 'xlsx-lib',
  label: 'Python xlsx 库选型（多版本约束）',
  shortLabel: 'xlsx 选型',
  topic:
    '需要在 Python 3.6 环境下读写较大的 xlsx，最好节省内存，并支持流式写入。请对比主流库并给出可落地建议。',
  constraintsNote: '硬约束：Python 3.6 · 软期望：低内存、流式写入、维护活跃',
  citations: {
    c1: {
      id: 'c1',
      title: 'openpyxl — Read/Write Excel 2010 xlsx',
      url: 'https://openpyxl.readthedocs.io/',
      snippet: 'openpyxl is a Python library to read/write Excel 2010 xlsx/xlsm files.',
      kind: 'docs',
      origin: 'research',
    },
    c2: {
      id: 'c2',
      title: 'xlsxwriter — Writing XLSX files',
      url: 'https://xlsxwriter.readthedocs.io/',
      snippet: 'XlsxWriter can be used in constant memory mode for large files.',
      kind: 'docs',
      origin: 'research',
    },
    c3: {
      id: 'c3',
      title: 'StackOverflow: openpyxl memory usage',
      url: 'https://stackoverflow.com/questions/32375471',
      snippet: 'read_only / write_only help; 3.6 users report OOM on large files.',
      kind: 'community',
      origin: 'research',
    },
    c4: {
      id: 'c4',
      title: 'pandas.read_excel engine notes (2019)',
      url: 'https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html',
      snippet: 'Older docs still mention xlrd for xlsx — likely stale.',
      kind: 'docs',
      stale: true,
      origin: 'research',
    },
    c5: {
      id: 'c5',
      title: 'pyexcelerate GitHub',
      url: 'https://github.com/kz26/PyExcelerate',
      snippet: 'Fast writer; maintenance unclear for Python 3.6.',
      kind: 'github',
      origin: 'research',
    },
    c6: {
      id: 'c6',
      title: 'Python 3.6 EOL',
      url: 'https://devguide.python.org/versions/',
      snippet: 'Python 3.6 EOL Dec 2021; many libs dropped support.',
      kind: 'web',
      origin: 'research',
    },
    /** Fake: mirrors workspace Sources column uploads for this notebook. */
    nb1: {
      id: 'nb1',
      title: '内部基准：xlsx_mem_bench_py36.md',
      url: '#notebook-source/101',
      snippet: '项目来源栏已入库的内部基准笔记：对比 openpyxl / xlsxwriter 峰值内存。',
      kind: 'upload',
      origin: 'notebook',
      notebookSourceId: 101,
    },
    nb2: {
      id: 'nb2',
      title: '需求附件：报表导出规格.pdf',
      url: '#notebook-source/102',
      snippet: '来源栏 PDF：流式写入与列类型约束说明。',
      kind: 'pdf',
      origin: 'notebook',
      notebookSourceId: 102,
    },
  },
  nodes: [
    {
      id: 'root',
      role: 'question',
      title: '原始问题',
      query: 'Python 3.6 xlsx library low memory streaming',
      summary: '硬约束：Python 3.6 · 软期望：低内存、流式写入、维护活跃',
      conclusion:
        '需要在 Python 3.6 环境下读写较大的 xlsx，最好节省内存，并支持流式写入。请对比主流库并给出可落地建议。',
      conclusionStatus: 'pending',
      askOnInterrupt: true,
      citationIds: [],
    },
    {
      id: 'n-libs',
      role: 'research',
      title: '候选库盘点',
      query: 'openpyxl vs xlsxwriter vs pandas vs pyexcelerate',
      summary: '主流候选：openpyxl、xlsxwriter、pandas(+engine)、pyexcelerate。',
      conclusion: '写入常用 xlsxwriter / openpyxl write_only；pyexcelerate 维护风险高。',
      conclusionStatus: 'clear',
      citationIds: ['c1', 'c2', 'c5'],
    },
    {
      id: 'n-perf',
      role: 'research',
      title: '性能与内存',
      query: 'openpyxl memory write_only xlsxwriter constant_memory',
      summary: '大文件场景下内存曲线差异显著。',
      conclusion: '有初步对比，缺统一 3.6 基准实测。',
      conclusionStatus: 'partial',
      citationIds: ['c2', 'c3'],
    },
    {
      id: 'n-compat',
      role: 'research',
      title: 'Python 3.6 兼容',
      query: 'openpyxl xlsxwriter python 3.6 support',
      summary: '确认各库对 3.6 的声明支持与安装现实。',
      conclusion: '新版本逐步放弃 3.6；需钉死历史版本（证据待完善）。',
      conclusionStatus: 'partial',
      citationIds: ['c4', 'c6'],
    },
    {
      id: 'n-stream',
      role: 'research',
      title: '流式写入能力',
      query: 'xlsxwriter constant_memory openpyxl write_only',
      summary: '是否支持真正的流式/常量内存写入。',
      conclusion: 'xlsxwriter constant_memory 与 openpyxl write_only 均满足。',
      conclusionStatus: 'clear',
      citationIds: ['c1', 'c2'],
    },
    {
      id: 'conclusion',
      role: 'conclusion',
      title: '研究结论',
      summary: '汇聚各子课题后的唯一决策建议。',
      conclusion:
        '写入优先 xlsxwriter（constant_memory）；读写兼顾则钉死兼容 3.6 的 openpyxl 并用 write_only/read_only；不将 pyexcelerate 作为默认生产依赖。',
      conclusionStatus: 'clear',
      citationIds: ['c1', 'c2', 'c6'],
    },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'n-libs', kind: 'decompose', labelNote: '拆解' },
    { id: 'e2', source: 'root', target: 'n-perf', kind: 'decompose', labelNote: '拆解' },
    { id: 'e3', source: 'root', target: 'n-compat', kind: 'decompose', labelNote: '拆解' },
    { id: 'e4', source: 'n-libs', target: 'n-stream', kind: 'refine', labelNote: '细化' },
    { id: 'e5', source: 'n-perf', target: 'n-stream', kind: 'support', labelNote: '支撑' },
    { id: 'e6', source: 'n-libs', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
    { id: 'e7', source: 'n-compat', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
    { id: 'e8', source: 'n-stream', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
  ],
  reportMarkdown: `## 研究综述：Python 3.6 下的 xlsx 库选型

在 Python 3.6 硬约束下，读写较大 xlsx 并兼顾内存与流式写入，需要把公开检索证据与笔记本内已入库资料交叉核对。

### 唯一结论

1. **纯写入 / 大文件**：优先 **xlsxwriter**[^c2]（\`constant_memory\`），并对照内部基准[^nb1]。
2. **读写都要**：钉死兼容 3.6 的 **openpyxl**[^c1]，启用 \`write_only\` / \`read_only\`。
3. **不推荐** pyexcelerate[^c5] 作默认生产依赖。
4. 导出列类型与流式约束见需求附件[^nb2]。

### 候选库盘点

- openpyxl[^c1]：功能全，大文件需只读/只写模式。
- xlsxwriter[^c2]：写入与内存模式成熟。
- pandas engine 笔记[^c4]：旧文档仍提 xlrd，需人工复核（可能过时）。
- 社区内存讨论[^c3]：3.6 上 OOM 报告较多。

### 性能与兼容

- 流式写入证据偏明确[^c2]；3.6 EOL[^c6] 导致版本钉死成本上升。
- 内部基准笔记[^nb1] 与公开文档一致的部分可优先采信。
`,
  phaseSnapshots: {
    idle: emptySnap(
      ['root'],
      { tokensUsed: 0, sourcesRetrieved: 0, pendingNodes: 0, elapsedSec: 0 },
      ['等待输入'],
      { root: { conclusionStatus: 'pending' } },
    ),
    decompose: emptySnap(
      ['root', 'n-libs', 'n-perf', 'n-compat'],
      { tokensUsed: 12_400, sourcesRetrieved: 0, pendingNodes: 3, elapsedSec: 18 },
      ['拆解为库盘点 / 性能 / 兼容'],
      {
        'n-libs': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
        'n-perf': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
        'n-compat': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
      },
    ),
    explore: emptySnap(
      ['root', 'n-libs', 'n-perf', 'n-compat', 'n-stream'],
      { tokensUsed: 48_200, sourcesRetrieved: 14, pendingNodes: 4, elapsedSec: 76 },
      ['多源检索中'],
      {
        'n-libs': { conclusionStatus: 'pending', phase: 'retrieving', citationIds: ['c1', 'c2'] },
        'n-perf': { conclusionStatus: 'pending', phase: 'retrieving', citationIds: ['c3'] },
        'n-compat': { conclusionStatus: 'pending', phase: 'retrieving', citationIds: ['c4', 'c6'] },
        'n-stream': { conclusionStatus: 'pending', phase: 'retrieving', citationIds: ['c2'] },
      },
    ),
    evaluate: emptySnap(
      ['root', 'n-libs', 'n-perf', 'n-compat', 'n-stream'],
      { tokensUsed: 71_000, sourcesRetrieved: 18, pendingNodes: 2, elapsedSec: 140 },
      ['子课题证据自评'],
      {
        'n-libs': { conclusionStatus: 'clear' },
        'n-perf': { conclusionStatus: 'partial' },
        'n-compat': { conclusionStatus: 'partial' },
        'n-stream': { conclusionStatus: 'clear' },
      },
    ),
    integrate: emptySnap(
      ['root', 'n-libs', 'n-perf', 'n-compat', 'n-stream', 'conclusion'],
      { tokensUsed: 92_500, sourcesRetrieved: 18, pendingNodes: 0, elapsedSec: 195 },
      ['汇入唯一结论节点'],
      { conclusion: { conclusionStatus: 'partial', phase: 'synthesizing' } },
    ),
    awaiting_confirm: emptySnap(
      ['root', 'n-libs', 'n-perf', 'n-compat', 'n-stream', 'conclusion'],
      { tokensUsed: 96_000, sourcesRetrieved: 18, pendingNodes: 0, elapsedSec: 210 },
      ['是否继续深挖兼容性？'],
      { conclusion: { conclusionStatus: 'partial' } },
    ),
    completed: emptySnap(
      ['root', 'n-libs', 'n-perf', 'n-compat', 'n-stream', 'conclusion'],
      { tokensUsed: 104_800, sourcesRetrieved: 22, pendingNodes: 0, elapsedSec: 248 },
      ['唯一结论已生成'],
    ),
    failed: emptySnap(
      ['root', 'n-libs'],
      { tokensUsed: 8_200, sourcesRetrieved: 2, pendingNodes: 0, elapsedSec: 32 },
      ['模拟失败：搜索配额耗尽'],
      {
        root: { conclusionStatus: 'missing', summary: '执行失败' },
        'n-libs': { conclusionStatus: 'pruned', citationIds: [] },
      },
    ),
  },
};

const cloudDb: LabScenario = {
  id: 'cloud-db',
  label: '多云数据库选型（证据冲突）',
  shortLabel: '多云 DB',
  topic:
    '我们要在 AWS + 阿里云双活架构下选托管数据库，要求 RPO≈0、跨云延迟可接受、成本可控。Postgres 兼容优先。',
  constraintsNote: '硬约束：双云 · RPO≈0 · Postgres 兼容',
  citations: {
    d1: {
      id: 'd1',
      title: 'AWS Aurora Global Database',
      url: 'https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html',
      snippet: 'Cross-Region lag; not active-active multi-cloud.',
      kind: 'docs',
    },
    d2: {
      id: 'd2',
      title: 'Aliyun PolarDB',
      url: 'https://help.aliyun.com/',
      snippet: '跨云双写需自建同步层。',
      kind: 'docs',
    },
    d3: {
      id: 'd3',
      title: 'CockroachDB multi-cloud',
      url: 'https://www.cockroachlabs.com/blog/',
      snippet: 'Cross-cloud possible; write latency sensitive.',
      kind: 'web',
    },
    d4: {
      id: 'd4',
      title: 'Postgres logical replication conflicts',
      url: 'https://github.com/postgres/postgres/issues',
      snippet: '双向逻辑复制冲突需应用层裁决。',
      kind: 'github',
    },
    d5: {
      id: 'd5',
      title: 'Vendor whitepaper (2022)',
      url: 'https://example.com/whitepaper-rpo0.pdf',
      snippet: '声称跨云 RPO=0；细节不透明。',
      kind: 'pdf',
      stale: true,
    },
  },
  nodes: [
    {
      id: 'root',
      role: 'question',
      title: '原始问题',
      summary: '硬约束：双云 · RPO≈0 · Postgres 兼容',
      conclusion:
        '我们要在 AWS + 阿里云双活架构下选托管数据库，要求 RPO≈0、跨云延迟可接受、成本可控。Postgres 兼容优先。',
      conclusionStatus: 'pending',
      askOnInterrupt: true,
      citationIds: [],
    },
    {
      id: 'n-managed',
      role: 'research',
      title: '托管 Postgres 能力',
      conclusion: 'Aurora / PolarDB 云内成熟，跨云双活非一等公民。',
      conclusionStatus: 'clear',
      citationIds: ['d1', 'd2'],
    },
    {
      id: 'n-rpo',
      role: 'research',
      title: 'RPO≈0 可行性',
      conclusion: '白皮书与工程实践冲突；给定约束下无法确认。',
      conclusionStatus: 'missing',
      citationIds: ['d4', 'd5'],
    },
    {
      id: 'n-dist',
      role: 'research',
      title: '分布式 SQL 路径',
      conclusion: '可跨云，但延迟与运维成本上升。',
      conclusionStatus: 'partial',
      citationIds: ['d3'],
    },
    {
      id: 'conclusion',
      role: 'conclusion',
      title: '研究结论',
      conclusion:
        '不存在无妥协的托管银弹。可选：单云主写+对端只读，或分布式 SQL；纯托管 Postgres 无法同时满足双云双活与 RPO≈0。',
      conclusionStatus: 'partial',
      citationIds: ['d1', 'd3', 'd4'],
    },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'n-managed', kind: 'decompose', labelNote: '拆解' },
    { id: 'e2', source: 'root', target: 'n-rpo', kind: 'decompose', labelNote: '拆解' },
    { id: 'e3', source: 'root', target: 'n-dist', kind: 'compare', labelNote: '对比' },
    { id: 'e4', source: 'n-managed', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
    { id: 'e5', source: 'n-rpo', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
    { id: 'e6', source: 'n-dist', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
  ],
  reportMarkdown: `## 研究综述：双云数据库

### 唯一结论
**RPO≈0 + 双云双活 + 纯托管 Postgres** 组合在公开证据下无法确认可行[^d5]。

### 证据要点
- Aurora Global[^d1]：跨区而非跨云双活。
- PolarDB[^d2]：跨云双写需自建同步。
- Cockroach[^d3] / 逻辑复制冲突[^d4]：可行但延迟与冲突成本高。
`,
  phaseSnapshots: {
    idle: emptySnap(
      ['root'],
      { tokensUsed: 0, sourcesRetrieved: 0, pendingNodes: 0, elapsedSec: 0 },
      ['待命'],
    ),
    decompose: emptySnap(
      ['root', 'n-managed', 'n-rpo', 'n-dist'],
      { tokensUsed: 9_800, sourcesRetrieved: 0, pendingNodes: 3, elapsedSec: 14 },
      ['拆解子课题'],
      {
        'n-managed': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
        'n-rpo': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
        'n-dist': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
      },
    ),
    explore: emptySnap(
      ['root', 'n-managed', 'n-rpo', 'n-dist'],
      { tokensUsed: 55_000, sourcesRetrieved: 21, pendingNodes: 3, elapsedSec: 110 },
      ['交叉检索'],
      {
        'n-managed': { conclusionStatus: 'pending', phase: 'retrieving' },
        'n-rpo': { conclusionStatus: 'pending', phase: 'retrieving' },
        'n-dist': { conclusionStatus: 'pending', phase: 'retrieving' },
      },
    ),
    evaluate: emptySnap(
      ['root', 'n-managed', 'n-rpo', 'n-dist'],
      { tokensUsed: 80_000, sourcesRetrieved: 24, pendingNodes: 1, elapsedSec: 170 },
      ['证据冲突判定'],
      {
        'n-managed': { conclusionStatus: 'clear' },
        'n-rpo': { conclusionStatus: 'missing' },
        'n-dist': { conclusionStatus: 'partial' },
      },
    ),
    integrate: emptySnap(
      ['root', 'n-managed', 'n-rpo', 'n-dist', 'conclusion'],
      { tokensUsed: 98_000, sourcesRetrieved: 24, pendingNodes: 0, elapsedSec: 220 },
      ['汇入唯一结论'],
      { conclusion: { conclusionStatus: 'partial', phase: 'synthesizing' } },
    ),
    awaiting_confirm: emptySnap(
      ['root', 'n-managed', 'n-rpo', 'n-dist', 'conclusion'],
      { tokensUsed: 99_000, sourcesRetrieved: 24, pendingNodes: 0, elapsedSec: 230 },
      ['是否追加故障注入支路？'],
    ),
    completed: emptySnap(
      ['root', 'n-managed', 'n-rpo', 'n-dist', 'conclusion'],
      { tokensUsed: 112_000, sourcesRetrieved: 27, pendingNodes: 0, elapsedSec: 265 },
      ['完成'],
    ),
    failed: emptySnap(
      ['root'],
      { tokensUsed: 1_200, sourcesRetrieved: 0, pendingNodes: 0, elapsedSec: 5 },
      ['模型超时'],
      { root: { conclusionStatus: 'missing' } },
    ),
  },
};

const compliance: LabScenario = {
  id: 'compliance',
  label: '跨境数据合规路径（证据稀缺）',
  shortLabel: '合规路径',
  topic: '产品要把欧盟用户行为日志同步到亚太训练集群，是否可行？需要列出合规路径与阻塞点。',
  constraintsNote: '硬约束：GDPR · 日志含间接标识',
  citations: {
    g1: {
      id: 'g1',
      title: 'GDPR Art. 44–49',
      url: 'https://gdpr-info.eu/chapter-5/',
      snippet: 'Transfer requires adequacy, SCCs, or derogations.',
      kind: 'docs',
    },
    g2: {
      id: 'g2',
      title: 'EDPB recommendations',
      url: 'https://edpb.europa.eu/',
      snippet: 'Supplementary measures may be required.',
      kind: 'paper',
    },
    g3: {
      id: 'g3',
      title: '内部 wiki：日志字段字典',
      url: '#internal-wiki',
      snippet: '含 IP、device_id；是否个人数据需法务确认。',
      kind: 'docs',
      stale: true,
    },
  },
  nodes: [
    {
      id: 'root',
      role: 'question',
      title: '原始问题',
      summary: '硬约束：GDPR · 日志含间接标识',
      conclusion:
        '产品要把欧盟用户行为日志同步到亚太训练集群，是否可行？需要列出合规路径与阻塞点。',
      conclusionStatus: 'pending',
      askOnInterrupt: true,
      citationIds: [],
    },
    {
      id: 'n-legal',
      role: 'research',
      title: '传输法律基础',
      conclusion: '可能路径：SCC + 补充措施。',
      conclusionStatus: 'partial',
      citationIds: ['g1', 'g2'],
    },
    {
      id: 'n-data',
      role: 'research',
      title: '是否个人数据',
      conclusion: '公开材料不足；无法判定。',
      conclusionStatus: 'missing',
      citationIds: ['g3'],
    },
    {
      id: 'n-minimize',
      role: 'research',
      title: '最小化方案',
      conclusion: '可列技术选项，有效性待完善。',
      conclusionStatus: 'partial',
      citationIds: ['g2'],
    },
    {
      id: 'conclusion',
      role: 'conclusion',
      title: '研究结论',
      conclusion:
        '无法给出可上线方案。阻塞点在「是否个人数据」与「补充措施是否足够」；需法务裁定后再议。',
      conclusionStatus: 'missing',
      citationIds: ['g1', 'g2'],
    },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'n-legal', kind: 'decompose', labelNote: '拆解' },
    { id: 'e2', source: 'root', target: 'n-data', kind: 'decompose', labelNote: '拆解' },
    { id: 'e3', source: 'n-data', target: 'n-minimize', kind: 'refine', labelNote: '细化' },
    { id: 'e4', source: 'n-legal', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
    { id: 'e5', source: 'n-minimize', target: 'conclusion', kind: 'merge', labelNote: '汇入' },
  ],
  reportMarkdown: `## 研究综述：跨境行为日志用于训练

### 唯一结论
**无法给出可上线方案。** 需法务裁定字段定性并更新数据字典后再评估[^g3]。

### 合规路径
- GDPR 传输框架[^g1]；EDPB 补充措施[^g2]。
`,
  phaseSnapshots: {
    idle: emptySnap(
      ['root'],
      { tokensUsed: 0, sourcesRetrieved: 0, pendingNodes: 0, elapsedSec: 0 },
      ['待命'],
    ),
    decompose: emptySnap(
      ['root', 'n-legal', 'n-data'],
      { tokensUsed: 7_500, sourcesRetrieved: 0, pendingNodes: 2, elapsedSec: 12 },
      ['拆解'],
      {
        'n-legal': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
        'n-data': { conclusionStatus: 'pending', citationIds: [], conclusion: undefined },
      },
    ),
    explore: emptySnap(
      ['root', 'n-legal', 'n-data', 'n-minimize'],
      { tokensUsed: 33_000, sourcesRetrieved: 9, pendingNodes: 3, elapsedSec: 88 },
      ['公开源稀缺'],
      {
        'n-legal': { conclusionStatus: 'pending', phase: 'retrieving' },
        'n-data': { conclusionStatus: 'pending', phase: 'retrieving' },
        'n-minimize': { conclusionStatus: 'pending', phase: 'retrieving', citationIds: [] },
      },
    ),
    evaluate: emptySnap(
      ['root', 'n-legal', 'n-data', 'n-minimize'],
      { tokensUsed: 51_000, sourcesRetrieved: 11, pendingNodes: 1, elapsedSec: 150 },
      ['证据不足标记'],
      {
        'n-legal': { conclusionStatus: 'partial' },
        'n-data': { conclusionStatus: 'missing' },
        'n-minimize': { conclusionStatus: 'partial' },
      },
    ),
    integrate: emptySnap(
      ['root', 'n-legal', 'n-data', 'n-minimize', 'conclusion'],
      { tokensUsed: 62_000, sourcesRetrieved: 11, pendingNodes: 0, elapsedSec: 180 },
      ['汇入唯一结论'],
      { conclusion: { conclusionStatus: 'missing', phase: 'synthesizing' } },
    ),
    awaiting_confirm: emptySnap(
      ['root', 'n-legal', 'n-data', 'n-minimize', 'conclusion'],
      { tokensUsed: 63_000, sourcesRetrieved: 11, pendingNodes: 0, elapsedSec: 188 },
      ['是否上传字段表？'],
    ),
    completed: emptySnap(
      ['root', 'n-legal', 'n-data', 'n-minimize', 'conclusion'],
      { tokensUsed: 68_400, sourcesRetrieved: 12, pendingNodes: 0, elapsedSec: 201 },
      ['以无法结论完成'],
    ),
    failed: emptySnap(
      ['root', 'n-legal'],
      { tokensUsed: 4_000, sourcesRetrieved: 1, pendingNodes: 0, elapsedSec: 20 },
      ['政策站点限流'],
      {
        root: { conclusionStatus: 'missing' },
        'n-legal': { conclusionStatus: 'pruned', citationIds: [] },
      },
    ),
  },
};

export const LAB_SCENARIOS: LabScenario[] = [xlsxLib, cloudDb, compliance];

export function getLabScenario(id: string): LabScenario {
  return LAB_SCENARIOS.find((s) => s.id === id) ?? LAB_SCENARIOS[0];
}
