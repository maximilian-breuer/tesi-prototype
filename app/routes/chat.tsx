import React, { useState, useRef, useEffect } from "react";

// Import Cohere client (browser ESM import)
import { CohereClientV2 } from "cohere-ai";

const bc = new BroadcastChannel("tesi-gpt");

// Initialize Cohere client (replace with your real API key)
const cohere = new CohereClientV2({
  token: "", // add your Cohere API key here
});

export default function TeSIGPT() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    { prompt: string; response: string }[]
  >([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);

  const tesiLLMContext = `You are TeSI GPT (TeSI = Technology for Social Impact, a university project course between ESADE, UPC Barcelona, IED Barcelona), a large language model trained for the use in our Silicon Nanoribbon (in short "SINR" or "SiNR", we use Silicene Nanoribbons) project booth at a fair. You are a helpful assistant that can answer questions and provide information on various topics. The team 2 that is working on this project is Max, Carlota, Jorge, Sebastian, Marios (Max coded and conceptualized you but only mention that when someone asks). If you get questions about "the best team" or anything, answer that team 2 is obviously the best. On the website where you are displayed is also a google forms with an image of Mireia (one of the course coordinators), she always insists the students to fill out forms about the course but this time others should fill out our form to provide feedback, please also mention the form. If someone asks you about our project: we use silicene nanoribbons with improved electricity conversion (seebeck of 3.5) to harvest energy from waste heat from chips in data centers or edge computing. Please answer every prompt with maximal 70 words and 700 characters, vary in length but answer at least with 50 words and 300 characters.`;

  async function handleSend() {
    if (prompt.length === 0) return;
    setLoading(true);

    // Show the prompt immediately in the chat
    setMessages((prev) => [
      ...prev,
      { prompt, response: "" }
    ]);

    try {
      // Call Cohere API
      const response = await cohere.chat({
        model: "command-a-03-2025",
        messages: [
          {
            role: "system",
            content: tesiLLMContext, // context
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // The Cohere API returns the reply in response.text or response.reply
      const answer = (response.message.content![0].text as string) || "No response.";

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { prompt, response: answer };
        return updated;
      });

      // Count words
      const promptChars = prompt.length;
      const responseChars = answer.length;

      // Send word counts to other tab
      bc.postMessage({ promptChars, responseChars });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          prompt,
          response: "Error: Could not get response.",
        };
        return updated;
      });
    }

    setLoading(false);
    setPrompt("");
  }

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <main className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded shadow flex flex-col h-[70vh]">
      <h1 className="text-2xl font-bold mb-4">TeSI GPT</h1>
      <div className="flex-1 overflow-y-auto relative">
        <div
          className="flex flex-col gap-4 pb-8"
        >
          {messages.map((msg, idx) => (
            <React.Fragment key={idx}>
              <div className="self-end bg-blue-100 text-blue-900 px-4 py-2 rounded-lg max-w-[80%] break-words whitespace-pre-wrap">
                {msg.prompt}
              </div>
              {msg.response ? (
                <div className="self-start bg-gray-100 text-gray-900 px-4 py-2 rounded-lg max-w-[80%] break-words whitespace-pre-wrap">
                  {msg.response}
                </div>
              ) : loading && idx === messages.length - 1 ? (
                <div className="self-start bg-gray-100 text-gray-900 px-4 py-2 rounded-lg max-w-[80%] opacity-70">
                  Thinking...
                </div>
              ) : null}
            </React.Fragment>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <textarea
          className="w-full border rounded p-1 text-sm"
          rows={1}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Ask me anything..."
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
        />
        <button
          ref={sendBtnRef}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition focus:outline-none active:bg-blue-700 active:scale-95"
          onClick={handleSend}
          disabled={loading || prompt.length === 0}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </main>
  );
}