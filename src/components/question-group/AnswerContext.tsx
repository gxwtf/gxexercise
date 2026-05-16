'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface QuestionAnswer {
  questionId: string;
  content: Record<string, unknown>;
}

interface AnswerContextType {
  answers: Record<string, QuestionAnswer>;
  setAnswer: (questionId: string, content: Record<string, unknown>) => void;
  resetAnswers: () => void;
  getAllAnswers: () => QuestionAnswer[];
}

const AnswerContext = createContext<AnswerContextType | undefined>(undefined);

export function AnswerProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});

  const setAnswer = useCallback((questionId: string, content: Record<string, unknown>) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, content }
    }));
  }, []);

  const resetAnswers = useCallback(() => {
    setAnswers({});
  }, []);

  const getAllAnswers = useCallback(() => {
    return Object.values(answers);
  }, [answers]);

  return (
    <AnswerContext.Provider value={{ answers, setAnswer, resetAnswers, getAllAnswers }}>
      {children}
    </AnswerContext.Provider>
  );
}

export function useAnswer() {
  const context = useContext(AnswerContext);
  if (!context) {
    throw new Error('useAnswer must be used within an AnswerProvider');
  }
  return context;
}