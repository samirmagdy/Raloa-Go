import { Locale } from '../types';

export interface ReadingTimeResult {
  minutes: number;
  wordCount: number;
  formatted: string;
}

/**
 * Calculates estimated read time from raw text or an array of strings.
 * Defaults to 200 words per minute (standard average adult reading speed).
 */
export function calculateReadingTime(
  content: string | string[],
  locale: Locale = 'en',
  wordsPerMinute: number = 200
): ReadingTimeResult {
  const combinedText = Array.isArray(content) ? content.join(' ') : content;
  
  // Split on whitespace matching Unicode characters for English, Arabic, etc.
  const words = combinedText.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const rawMinutes = wordCount / wordsPerMinute;
  const minutes = Math.max(1, Math.ceil(rawMinutes));

  let formatted = '';
  if (locale === 'ar') {
    if (minutes === 1) {
      formatted = 'قراءة في دقيقة واحدة';
    } else if (minutes === 2) {
      formatted = 'قراءة في دقيقتين';
    } else if (minutes >= 3 && minutes <= 10) {
      formatted = `قراءة في ${minutes} دقائق`;
    } else {
      formatted = `قراءة في ${minutes} دقيقة`;
    }
  } else {
    formatted = `${minutes} min read`;
  }

  return {
    minutes,
    wordCount,
    formatted
  };
}
