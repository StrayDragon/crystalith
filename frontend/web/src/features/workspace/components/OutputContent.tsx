import type { OutputItem } from '../types';

interface OutputContentProps {
  output: OutputItem;
}

function renderMindmapNode(
  node: { label?: string; children?: any[] },
  depth = 0,
  index = 0,
) {
  if (!node) return null;
  return (
    <li
      key={`${depth}-${index}-${node.label ?? 'node'}`}
      className={`StructuredMindmapNode depth-${depth}`}
    >
      <div className="StructuredMindmapLabel">{node.label || '未命名节点'}</div>
      {Array.isArray(node.children) && node.children.length > 0 ? (
        <ul className="StructuredMindmapChildren">
          {node.children.map((child, childIndex) =>
            renderMindmapNode(child, depth + 1, childIndex),
          )}
        </ul>
      ) : null}
    </li>
  );
}

export default function OutputContent({ output }: OutputContentProps) {
  const content = output.content ?? {};
  if (output.type === 'FAQ' && Array.isArray((content as any).items)) {
    return (
      <div className="StructuredOutputFaq">
        {(content as any).items.map((item: any, index: number) => (
          <div key={index} className="StructuredOutputFaqItem">
            <div className="StructuredOutputFaqQuestion">{item.question || '问题'}</div>
            <div className="StructuredOutputFaqAnswer">{item.answer || '暂无回答'}</div>
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'GUIDE' && Array.isArray((content as any).modules)) {
    return (
      <div className="StructuredOutputGuide">
        {(content as any).modules.map((module: any, index: number) => (
          <div key={index} className="StructuredOutputGuideModule">
            <div className="StructuredOutputGuideTitle">{module.title || '模块'}</div>
            <div className="StructuredOutputGuideObjective">
              {module.objective?.text || '暂无目标'}
            </div>
            {Array.isArray(module.key_points) ? (
              <ul className="StructuredOutputList">
                {module.key_points.map((item: any, itemIndex: number) => (
                  <li key={itemIndex}>{item.text || '要点'}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'TIMELINE' && Array.isArray((content as any).events)) {
    return (
      <ul className="StructuredOutputTimeline">
        {(content as any).events.map((event: any, index: number) => (
          <li key={index} className="StructuredOutputTimelineItem">
            <div className="StructuredOutputTimelineDate">{event.date || '时间'}</div>
            <div className="StructuredOutputTimelineEvent">{event.event || '事件'}</div>
            <div className="StructuredOutputTimelineDesc">{event.description || '暂无描述'}</div>
          </li>
        ))}
      </ul>
    );
  }

  if (output.type === 'MINDMAP' && (content as any).root) {
    return (
      <ul className="StructuredMindmapTree">
        {renderMindmapNode((content as any).root, 0, 0)}
      </ul>
    );
  }

  if (output.type === 'QUIZ' && Array.isArray((content as any).questions)) {
    return (
      <div className="StructuredOutputQuiz">
        {(content as any).questions.map((question: any, index: number) => (
          <div key={index} className="StructuredOutputQuizItem">
            <div className="StructuredOutputQuizQuestion">{question.question || '问题'}</div>
            {Array.isArray(question.options) && question.options.length > 0 ? (
              <ul className="StructuredOutputList">
                {question.options.map((option: string) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            ) : null}
            <div className="StructuredOutputQuizAnswer">{question.answer || '暂无答案'}</div>
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'BRIEFING' && Array.isArray((content as any).sections)) {
    return (
      <div className="StructuredOutputBriefing">
        {(content as any).sections.map((section: any, index: number) => (
          <div key={index} className="StructuredOutputBriefingSection">
            <div className="StructuredOutputBriefingHeading">{section.heading || '要点'}</div>
            {Array.isArray(section.points) ? (
              <ul className="StructuredOutputList">
                {section.points.map((point: any, pointIndex: number) => (
                  <li key={pointIndex}>{point.text || '内容'}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (output.type === 'PARAGRAPH' && typeof (content as any).text === 'string') {
    return <p className="StructuredOutputParagraph">{(content as any).text}</p>;
  }

  if (output.type === 'BULLETS' && Array.isArray((content as any).items)) {
    return (
      <ul className="StructuredOutputList">
        {(content as any).items.map((item: any, index: number) => (
          <li key={index}>{item.text || '要点'}</li>
        ))}
      </ul>
    );
  }

  if (output.type === 'STRUCTURED') {
    return (
      <div className="StructuredOutputStructured">
        <div className="StructuredOutputStructuredTitle">
          {(content as any).title || '未命名结构化输出'}
        </div>
        {Array.isArray((content as any).bullets) ? (
          <ul className="StructuredOutputList">
            {(content as any).bullets.map((item: any, index: number) => (
              <li key={index}>{item.text || '要点'}</li>
            ))}
          </ul>
        ) : null}
        {Array.isArray((content as any).terms) && (content as any).terms.length > 0 ? (
          <div className="StructuredOutputTags">
            {(content as any).terms.map((term: string) => (
              <span key={term} className="StructuredOutputTag">
                {term}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <pre className="StructuredOutputRaw">{JSON.stringify(output.content ?? {}, null, 2)}</pre>
  );
}
