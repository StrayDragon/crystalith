// r495 已知查询对：24 条，标注期望命中文档（二值相关性判定）。
export interface EvalQuery {
  id: string;
  text: string;
  expected: string[];
}
export const QUERIES: EvalQuery[] = [
  { id: 'q01', text: '古代谁把圆周率算到了七位小数', expected: ['d01'] },
  { id: 'q02', text: '授时历是哪位天文学家编制的', expected: ['d02'] },
  { id: 'q03', text: '梦溪笔谈的作者记录了哪些科学发现', expected: ['d03'] },
  { id: 'q04', text: 'sqlite 有向量检索扩展吗', expected: ['d04', 'd05'] },
  { id: 'q05', text: 'vec0 虚拟表查询是暴力扫描吗', expected: ['d05'] },
  { id: 'q06', text: '数据库 schema 变更怎么生成迁移', expected: ['d06'] },
  { id: 'q07', text: 'bun 能把服务编译成单个可执行文件吗', expected: ['d07'] },
  { id: 'q08', text: 'bun 和 nodejs 有什么不兼容的地方', expected: ['d08'] },
  { id: 'q09', text: 'react 函数组件怎么管理状态', expected: ['d09'] },
  { id: 'q10', text: 'react 并发渲染和过渡更新', expected: ['d10'] },
  { id: 'q11', text: '词向量是什么原理', expected: ['d11'] },
  { id: 'q12', text: 'embedding 能截断降维存储吗', expected: ['d12'] },
  { id: 'q13', text: 'rag 文档切块有哪些策略', expected: ['d13'] },
  { id: 'q14', text: 'bm25 关键词打分怎么工作', expected: ['d14'] },
  { id: 'q15', text: '向量和关键词混合检索融合', expected: ['d15'] },
  { id: 'q16', text: '植物如何把光能转化为化学能', expected: ['d16'] },
  { id: 'q17', text: '细胞里产生 ATP 的细胞器', expected: ['d17'] },
  { id: 'q18', text: 'dna 双螺旋结构是谁提出的', expected: ['d18'] },
  { id: 'q19', text: '地震形成的原因是什么', expected: ['d19'] },
  { id: 'q20', text: '太平洋海温异常偏暖的现象', expected: ['d20'] },
  { id: 'q21', text: '古代东西方贸易商路', expected: ['d21'] },
  { id: 'q22', text: '明代远洋航行宝船队', expected: ['d22'] },
  { id: 'q23', text: '蒸汽机如何引发工业化', expected: ['d23'] },
  { id: 'q24', text: '停机问题与图灵机', expected: ['d24'] },
];
