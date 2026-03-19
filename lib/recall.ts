export async function createRecallBot(meetingUrl: string) {
  if (!process.env.RECALL_API_KEY) {
    console.warn("RECALL_API_KEY is missing. Mocking bot creation.");
    return { id: `mocked_bot_${Date.now()}` }; 
  }
  const response = await fetch("https://ap-northeast-1.recall.ai/api/v1/bot", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: "FlowMeet AI",
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              mode: "prioritize_low_latency",
              language_code: "en"
            }
          }
        }
      }
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Recall error payload:", errorText);
    throw new Error(errorText);
  }
  return response.json();
}
