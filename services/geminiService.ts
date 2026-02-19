
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please ensure it is set in the environment.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const summarizeNote = async (noteContent: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Please summarize the following university course note into a concise, high-impact bulleted list: \n\n ${noteContent}`,
    config: {
      temperature: 0.7,
      topP: 0.95,
    }
  });
  return response.text;
};

export const generateStudyQuestions = async (noteContent: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on these notes, generate 5 challenging study questions with brief answers to help a student prepare for an exam: \n\n ${noteContent}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING }
          },
          required: ["question", "answer"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};
