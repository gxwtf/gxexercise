'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

export interface QuestionAnswer {
  questionId: string;
  content: Record<string, unknown>;
}

interface AnswerContextType {
  answers: Record<string, QuestionAnswer>;
  setAnswer: (questionId: string, content: Record<string, unknown>) => void;
  resetAnswers: () => void;
  getAllAnswers: () => QuestionAnswer[];
  saveToStorage: () => void;
  loadFromStorage: () => void;
}

const AnswerContext = createContext<AnswerContextType | undefined>(undefined);

const STORAGE_PREFIX = 'exam_answers_'

export function AnswerProvider({ children, storageKey }: { children: ReactNode; storageKey?: string }) {
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const storageKeyRef = useRef<string | undefined>(storageKey)
  storageKeyRef.current = storageKey

  const loadFromStorage = useCallback(() => {
    if (!storageKeyRef.current) return
    const key = STORAGE_PREFIX + storageKeyRef.current
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        setAnswers(JSON.parse(saved))
      }
    } catch {}
  }, [])

  const saveToStorage = useCallback(() => {
    if (!storageKeyRef.current) return
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKeyRef.current, JSON.stringify(answers))
    } catch {}
  }, [answers])

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  const setAnswer = useCallback((questionId: string, content: Record<string, unknown>) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, content }
    }));
  }, []);

  const resetAnswers = useCallback(() => {
    setAnswers({});
    if (storageKeyRef.current) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + storageKeyRef.current)
      } catch {}
    }
  }, []);

  const getAllAnswers = useCallback(() => {
    return Object.values(answers);
  }, [answers]);

  return (
    <AnswerContext.Provider value={{ answers, setAnswer, resetAnswers, getAllAnswers, saveToStorage, loadFromStorage }}>
      {children}
    </AnswerContext.Provider>
  );
}

/** 单个作答值是否「空」（字符串/数组/对象递归判空） */
function isEmptyAnswerValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.every(isEmptyAnswerValue)
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).every(isEmptyAnswerValue)
  return false
}

/**
 * 用户是否**真的动过题**（有任何非空作答）。
 *
 * 用途：「返回」按钮要不要弹「确定放弃本次作答？」。
 * 一进页面就点返回（没作答/只点开没填）不该拦人；填过东西才需要提醒。
 */
export function hasAnyAnswer(answers: Record<string, QuestionAnswer>): boolean {
  return Object.values(answers).some((a) => !isEmptyAnswerValue(a?.content))
}

export function useAnswer() {
  const context = useContext(AnswerContext);
  if (!context) {
    throw new Error('useAnswer must be used within an AnswerProvider');
  }
  return context;
}