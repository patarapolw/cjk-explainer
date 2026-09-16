import { fetch } from "@tauri-apps/plugin-http";

import { settingsState } from "./settings";

// Minimal type definitions
type DeepSeekChunk = {
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

// Helper - one-liner safe parse
function safeParse<T>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function* LLMstream(body: {
  model: string;
  messages: {
    role: "system" | "user";
    content: string;
  }[];
}) {
  let endpoint = "https://api.deepseek.com/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settingsState.deepseekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw response;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value;

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      for (const line of event.split("\n")) {
        const DATA_START = "data: ";

        if (!line.startsWith(DATA_START)) continue;
        const payload = line.slice(DATA_START.length);

        if (payload === "[DONE]") {
          yield { content: "", done: true };
          return;
        }

        const chunk = safeParse<DeepSeekChunk>(payload);

        if (!chunk?.choices?.[0]?.delta) continue;

        const delta = chunk.choices[0].delta;

        // Yield content if present
        if (delta.content) {
          yield {
            content: delta.content,
            reasoning: delta.reasoning_content,
            done: false,
          };
        }

        // Yield reasoning separately if present and no content
        if (delta.reasoning_content && !delta.content) {
          yield {
            content: "",
            reasoning: delta.reasoning_content,
            done: false,
          };
        }
      }
    }
  }
}
