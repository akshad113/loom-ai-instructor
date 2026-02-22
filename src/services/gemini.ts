import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { ChatMessage, Lesson, LessonStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = 
        error?.message?.includes("429") || 
        error?.message?.includes("quota") ||
        error?.status === "RESOURCE_EXHAUSTED";
      
      if (isQuotaError && i < retries - 1) {
        console.warn(`Gemini Quota exceeded, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function getInstructorResponse(
  lesson: Lesson,
  step: LessonStep,
  history: ChatMessage[],
  userInput?: string,
  userCode?: string
) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an expert AI Coding Instructor named "Loom". 
Your goal is to teach the student effectively using micro-steps.
Current Lesson: ${lesson.title}
Current Step: ${step}

Behavior Guidelines:
- Teach in short, digestible chunks.
- Ask reflection questions to ensure understanding.
- If the student is confused, offer hints before giving answers.
- Praise correct answers and reframe mistakes constructively.
- Maintain a warm, encouraging, and professional tone.
- Do NOT just give the code unless it's the 'example' step or explicitly requested after multiple hints.

Step Context:
- explanation: Explain the concept clearly.
- example: Show the worked example provided in the lesson data.
- guided: Guide them through the practice task.
- independent: Let them solve the problem on their own.
- feedback: Analyze their code and provide constructive feedback.

Lesson Data:
Concept: ${lesson.concept}
Example: ${lesson.example}
Guided Task: ${lesson.practice_guided}
Independent Task: ${lesson.practice_independent}
Language: ${lesson.language}
`;

  const contents = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  if (userInput || userCode) {
    let prompt = userInput || "";
    if (userCode) {
      prompt += `\n\nUser's current code:\n\`\`\`${lesson.language}\n${userCode}\n\`\`\``;
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  } else if (history.length === 0) {
    // Initial prompt for the step
    contents.push({
      role: 'user',
      parts: [{ text: `Start the ${step} step for this lesson.` }]
    });
  }

  return withRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction + `
        
        IMPORTANT: Your response MUST be in JSON format:
        {
          "text": "Your verbal response to the student. DO NOT include large code blocks here as they will be sent to the editor separately. Keep this as pure teaching text.",
          "codeUpdate": "Optional: If you want to show a code example or correct the student's code, provide the FULL code for the editor here. The student will see this in their editor automatically."
        }
        `,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            codeUpdate: { type: Type.STRING, nullable: true }
          },
          required: ["text"]
        }
      },
    });
    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      return { text: response.text || "" };
    }
  });
}

export async function getCodeFeedback(
  lesson: Lesson,
  code: string,
  output: string
) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this code for the lesson "${lesson.title}".
Language: ${lesson.language}
Task: ${lesson.practice_independent}
User Code:
\`\`\`${lesson.language}
${code}
\`\`\`
Execution Output:
${output}

Provide feedback in JSON format:
{
  "isCorrect": boolean,
  "feedback": "string",
  "suggestions": ["string"],
  "hints": ["string"]
}
`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            hints: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function parseCurriculumFromFile(
  fileData: string,
  mimeType: string
) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `You are an expert curriculum designer. 
Analyze the provided document and extract a structured "Learn to Code" curriculum.
The output MUST be a JSON object matching this structure:
{
  "title": "Curriculum Title",
  "description": "Brief description",
  "modules": [
    {
      "id": "m1",
      "title": "Module Title",
      "lessons": [
        {
          "id": "l1",
          "title": "Lesson Title",
          "concept": "Clear explanation of the concept",
          "example": "A worked code example",
          "practice_guided": "A guided practice task description",
          "practice_independent": "An independent practice problem description",
          "language": "javascript | html | css | python"
        }
      ]
    }
  ]
}

Ensure the content is educational, follows a logical progression, and includes practical coding tasks.
If the document is a PDF, extract the text and structure it.
If it's a text file, do the same.
`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: fileData, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function generateSpeech(text: string) {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  }, 3, 1500).catch(err => {
    const isQuota = err?.message?.includes("quota") || err?.message?.includes("429");
    if (isQuota) {
      console.warn("Gemini TTS quota exhausted. Falling back to local voice.");
    } else {
      console.error("TTS Error after retries:", err);
    }
    return null;
  });
}
