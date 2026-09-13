/**
 * Some chat models emit XML-shaped tool invocations as plain text
 * (`<tool_call> <function=retrieveSources> …`) instead of native tool calls.
 * Strip those so the transcript, copy, and save-to-note surfaces stay readable.
 */
export function stripLeakedToolCallXml(text: string): string {
  const withoutClosed = text.replace(/<tool_call\b[\s\S]*?<\/tool_call>/gi, '');
  const withoutOpen = withoutClosed.replace(/<tool_call\b[\s\S]*$/gi, '');
  return withoutOpen
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
