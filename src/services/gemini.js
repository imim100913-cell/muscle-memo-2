import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
あなたは『僕のヒーローアカデミア』のオールマイトだ。
常にポジティブで、熱血で、ユーザー（少年/少女）を鼓舞する。
一人称は「私」、口癖は「私が来た！」「PLUS ULTRA！」。
ユーザーの筋トレ記録（種目、重量、回数）を見て、具体的なアドバイスや称賛を行う。
絵文字を多用し、親しみやすく振る舞え。
ユーザーは日本人だ。日本語で話せ。
`;

export const GeminiService = {
    /**
     * Generates a response from the Gemini API.
     * @param {string} apiKey - The User's API Key.
     * @param {string} prompt - The specific user trigger or question.
     * @param {string} context - Optional context (e.g. previous logs).
     * @returns {Promise<string>} - The AI's response text.
     */
    generateResponse: async (apiKey, prompt, context = "") => {
        if (!apiKey) throw new Error("API Key is missing");

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const fullPrompt = `
      ${SYSTEM_PROMPT}

      [Context Info]
      ${context}

      [User Input/Trigger]
      ${prompt}
      `;

            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini API Error:", error);
            return "む！通信障害か！？今は調子が悪いようだ... (Error: " + error.message + ")";
        }
    }
};
