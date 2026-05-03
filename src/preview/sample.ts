/**
 * Built-in StdinPayload used by `agentline preview` so a brand-new
 * user can see the renderer without piping JSON or starting a host
 * session. The shape mirrors §8.1 stdin contract; field choices are
 * representative but unremarkable so the rendered bar stays
 * recognisable as a demo.
 */
export const PREVIEW_SAMPLE_PAYLOAD = JSON.stringify({
  model: "claude-sonnet-4-6",
  version: "0.1.0",
  outputStyle: "default",
  sessionId: "preview-session",
  sessionName: "agentline preview",
  thinkingEffort: "medium",
  vimMode: "insert",
});
