import { request } from "./client";
import { PreparationLevel } from "./preparation";

export type AiInterestSuggestion = {
  id: number;
  name: string;
  category?: string | null;
  score: number;
};

export type QuestionnaireResult = {
  interests: AiInterestSuggestion[];
  preparation_level: PreparationLevel | null;
  applied: boolean;
  session_id?: string;
};

export type QuestionnairePayload = {
  interest_answers?: string[];
  preparation_answer?: string | null;
  top_k?: number;
  store?: boolean;
  session_id?: string;
};

export async function analyzeQuestionnaire(payload: QuestionnairePayload): Promise<QuestionnaireResult> {
  return request<QuestionnaireResult>("/api/ai/questionnaire", {
    method: "POST",
    body: payload,
  });
}
