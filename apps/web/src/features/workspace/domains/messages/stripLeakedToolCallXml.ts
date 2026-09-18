/**
 * Some chat models emit XML-shaped tool invocations as plain text
 * (`<tool_call> <function=retrieveSources> …`) instead of native tool calls.
 * Strip those so the transcript, copy, and save-to-note surfaces stay readable.
 */
export function stripLeakedToolCallXml(text: string): string {
  const withoutClosed = text.replaceAll(/<tool_call\b[\s\S]*?<\/tool_call>/giu, '');
  const withoutOpen = withoutClosed.replaceAll(/<tool_call\b[\s\S]*$/giu, '');
  return withoutOpen
    .replaceAll(/^[ \t]+/gmu, '')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim();
}
