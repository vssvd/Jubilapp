import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { Platform } from "react-native";

import { transcribeVoice } from "../api/voice";
import { analyzeQuestionnaire, QuestionnaireResult } from "../api/ai";

export type InterviewQuestion = {
  id: "activities" | "learning" | "planning";
  title: string;
  helper?: string;
  speech?: string;
};

export type InterviewTurn = {
  questionId: InterviewQuestion["id"];
  text: string;
  audioUrl?: string | null;
  audioPath?: string | null;
};

export type InterviewStatus = "idle" | "recording" | "processing" | "analyzing" | "finished";

const QUESTIONS: InterviewQuestion[] = [
  {
    id: "activities",
    title: "¿Qué actividades disfrutas?",
    helper: "Piensa en momentos de ocio, deporte o creatividad que te hagan feliz.",
    speech: "¿Qué actividades disfrutas en tu día a día?",
  },
  {
    id: "learning",
    title: "¿Qué te gustaría aprender o reforzar?",
    helper: "Puede ser un taller, un idioma o actividades digitales que quieras explorar.",
    speech: "¿Qué te gustaría aprender o reforzar próximamente?",
  },
  {
    id: "planning",
    title: "¿Cómo te sientes respecto a tu planificación?",
    helper: "Cuéntanos si tienes claras tus metas o si necesitas orientación.",
    speech: "¿Cómo te sientes respecto a tu planificación para la jubilación?",
  },
];

const IOS_SAMPLE_RATE = 44100;
const ANDROID_SAMPLE_RATE = 16000;

type RecordingRef = Audio.Recording | null;

type ResponseMap = Partial<Record<InterviewQuestion["id"], InterviewTurn>>;

export function useInterview() {
  const recordingSampleRate = Platform.OS === "android" ? ANDROID_SAMPLE_RATE : IOS_SAMPLE_RATE;
  const resolveRecordingOptions = useCallback((): Audio.RecordingOptions => {
    const webOptions = { mimeType: "audio/wav", bitsPerSecond: 128000 };

    return {
      isMeteringEnabled: true,
      android: {
        extension: ".3gp",
        outputFormat: Audio.AndroidOutputFormat.THREE_GPP,
        audioEncoder: Audio.AndroidAudioEncoder.AMR_WB,
        sampleRate: ANDROID_SAMPLE_RATE,
        numberOfChannels: 1,
      },
      ios: {
        extension: ".wav",
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.MAX,
        bitRateStrategy: Audio.IOSBitRateStrategy.CONSTANT,
        sampleRate: IOS_SAMPLE_RATE,
        numberOfChannels: 1,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: webOptions,
    };
  }, []);

  const [sessionId] = useState(() => (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`));
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [responses, setResponses] = useState<ResponseMap>({});
  const [analysis, setAnalysis] = useState<QuestionnaireResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<RecordingRef>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const currentQuestion = QUESTIONS[index];
  const currentResponse = currentQuestion ? responses[currentQuestion.id] : undefined;

  useEffect(() => {
    (async () => {
      const { granted } = await Audio.requestPermissionsAsync();
      setPermissionGranted(granted);
    })();
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const speakQuestion = useCallback(() => {
    if (!currentQuestion) return;
    Speech.stop();
    Speech.speak(currentQuestion.speech ?? currentQuestion.title, {
      language: "es-CL",
      pitch: Platform.OS === "ios" ? 1.05 : 1.0,
      rate: 0.95,
    });
  }, [currentQuestion]);

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "processing") return;
    if (permissionGranted === false) {
      setError("Necesitamos permiso para usar el micrófono.");
      return;
    }
    setError(null);
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(resolveRecordingOptions());
      await recording.startAsync();
      recordingRef.current = recording;
      setStatus("recording");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo iniciar la grabación.");
      setStatus("idle");
    }
  }, [permissionGranted, status]);

  const resetCurrentResponse = useCallback(() => {
    if (!currentQuestion) return;
    setResponses((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.id];
      return copy;
    });
    if (analysis) {
      setAnalysis(null);
      setStatus("idle");
    }
    setError(null);
  }, [analysis, currentQuestion]);

  const transcribeCurrent = useCallback(
    async (audioUri: string, mimeType?: string) => {
      if (!currentQuestion) return;
      setStatus("processing");
      try {
        const result = await transcribeVoice({
          sessionId,
          questionId: currentQuestion.id,
          questionText: currentQuestion.title,
          uri: audioUri,
          mimeType,
          sampleRateHz: recordingSampleRate,
        });
        setResponses((prev) => ({
          ...prev,
          [currentQuestion.id]: {
            questionId: currentQuestion.id,
            text: result.text,
            audioUrl: result.audio_url,
            audioPath: result.audio_path,
          },
        }));
        setError(result.upload_error ?? null);
        return result;
      } catch (err: any) {
        setError(err?.message ?? "No se pudo transcribir tu respuesta.");
        throw err;
      } finally {
        setStatus("idle");
      }
    },
    [currentQuestion, sessionId, recordingSampleRate],
  );

  const analyze = useCallback(async () => {
    if (analysis || status === "analyzing") return;
    const interestAnswers = [responses.activities?.text, responses.learning?.text].filter((t): t is string => Boolean(t && t.trim()));
    const preparationAnswer = responses.planning?.text ?? null;
    if (!interestAnswers.length && !preparationAnswer) return;
    setStatus("analyzing");
    try {
      const result = await analyzeQuestionnaire({
        interest_answers: interestAnswers,
        preparation_answer: preparationAnswer,
        store: true,
        session_id: sessionId,
      });
      setAnalysis(result);
      setStatus("finished");
      setError(null);
      return result;
    } catch (err: any) {
      setStatus("idle");
      setError(err?.message ?? "No se pudo analizar la entrevista.");
      throw err;
    }
  }, [analysis, responses, sessionId, status]);

  const stopRecording = useCallback(async () => {
    if (status !== "recording" || !recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) {
        throw new Error("No se pudo guardar el audio.");
      }
      const extension = uri.split(".").pop()?.toLowerCase();
      const mimeType =
        extension === "m4a"
          ? "audio/m4a"
          : extension === "caf"
            ? "audio/x-caf"
            : extension === "3gp"
              ? "audio/3gpp"
              : "audio/wav";
      await transcribeCurrent(uri, mimeType);
      setTimeout(() => Speech.stop(), 100);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo finalizar la grabación.");
      recordingRef.current = null;
      setStatus("idle");
    }
  }, [transcribeCurrent, status]);

  const goNext = useCallback(async () => {
    if (status === "processing" || status === "recording") return;
    if (!currentQuestion) return;
    const answered = responses[currentQuestion.id]?.text;
    if (!answered) {
      setError("Responde esta pregunta antes de continuar.");
      return;
    }
    if (index >= QUESTIONS.length - 1) {
      await analyze();
    } else {
      setIndex((prev) => Math.min(prev + 1, QUESTIONS.length - 1));
      setStatus("idle");
      setError(null);
    }
  }, [analyze, currentQuestion, index, responses, status]);

  const hasCompleted = !!analysis;
  const canAdvance = Boolean(currentResponse?.text);
  const isLastQuestion = index >= QUESTIONS.length - 1;

  const progress = useMemo(
    () => ({
      current: index + 1,
      total: QUESTIONS.length,
    }),
    [index],
  );

  return {
    questions: QUESTIONS,
    currentQuestion,
    currentResponse,
    progress,
    sessionId,
    status,
    isRecording: status === "recording",
    isProcessing: status === "processing",
    isLastQuestion,
    canAdvance,
    analysis,
    hasCompleted,
    error,
    responses,
    speakQuestion,
    startRecording,
    stopRecording,
    resetCurrentResponse,
    analyze,
    goNext,
  };
}
