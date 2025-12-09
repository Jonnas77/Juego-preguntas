import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateQuizQuestions = async (topic: string, count: number = 5): Promise<Question[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Genera ${count} preguntas de trivia sobre "${topic}" en español. Para cada pregunta, proporciona 4 respuestas, una correcta y tres incorrectas. Asigna un color a cada respuesta (red, blue, yellow, green) asegurando que los colores sean únicos por pregunta.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionText: { type: Type.STRING },
            answers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN },
                  color: { type: Type.STRING, enum: ["red", "blue", "yellow", "green"] }
                },
                required: ["text", "isCorrect", "color"]
              }
            }
          },
          required: ["questionText", "answers"]
        }
      }
    }
  });

  const rawData = JSON.parse(response.text || "[]");

  // Map to our internal Question type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawData.map((q: any) => ({
    id: generateId(),
    text: q.questionText,
    timeLimit: 5, // Requirement: 5 seconds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    answers: q.answers.map((a: any) => ({
      id: generateId(),
      text: a.text,
      isCorrect: a.isCorrect,
      color: a.color
    }))
  }));
};