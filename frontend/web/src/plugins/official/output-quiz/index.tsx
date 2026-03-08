import QuizRunner from "../../../features/workspace/domains/outputs/QuizRunner";
import { decodeOutputContent } from "../../../features/workspace/shared/outputPayload";

import { FallbackWarning, OutputError } from "../shared";

export function render(content: unknown, isFallback?: boolean) {
  const quiz = decodeOutputContent("QUIZ", content);
  if (!quiz) return <OutputError message="无效的测验数据" />;

  return (
    <div className="StructuredOutputQuiz">
      {isFallback ? <FallbackWarning /> : null}
      <QuizRunner questions={quiz.questions} />
    </div>
  );
}
