import { useState, useEffect, useRef, useCallback } from 'react';
import { Locale } from '../types';

export interface VoiceTourSectionScript {
  en: string;
  ar: string;
}

export const TOUR_SCRIPTS: Record<string, VoiceTourSectionScript> = {
  hero: {
    en: 'Welcome to RALOA. Build a stunning, high-converting mini-site for your links, digital products, portfolio, and calendar bookings in under three minutes.',
    ar: 'مرحباً بكم في رالوا. أنشئ موقعك المصغر الاحترافي لعرض روابطك، متجرك الرقمي، معرض أعمالك وحجوزاتك في دقائق معدودة.'
  },
  benefits: {
    en: 'Trusted by creators worldwide. Experience lightning-fast global edge CDN speed, zero setup friction, and total creative design freedom.',
    ar: 'ثقة آلاف المبدعين حول العالم. تمتع بسرعة تحميل فائقة عبر شبكات التوزيع العالمية، وحرية تصميم كاملة لهويتك.'
  },
  templates: {
    en: 'Curated design templates crafted for conversion. Whether you are an artist, educator, coach, or entrepreneur, pick a style and make it your own.',
    ar: 'قوالب وتصاميم مميزة مصممة لزيادة التفاعل والمبيعات. اختر قالباً عصرياً وخصصه بسهولة ليناسب علامتك.'
  },
  'how-it-works': {
    en: 'Launch in three simple steps. Claim your unique handle, personalize your interactive links in the studio, and add your raloa link to your bio.',
    ar: 'أطلق موقعك في ثلاث خطوات بسيطة. احجز اسمك الفريد، خصص روابطك في الاستوديو الحي، وانشر الرابط في بايو حساباتك.'
  },
  features: {
    en: 'Integrated creator tools. Custom domains, zero-commission digital sales, instant appointment booking, and real-time visitor analytics in one place.',
    ar: 'أدوات متكاملة لصناع المحتوى. نطاقات مخصصة، متجر رقمي بدون عمولة، نظام حجز مواعيد، وتحليلات زيارات فورية.'
  },
  testimonials: {
    en: 'Real creator stories. See how thousands of artists, consultants, and founders elevated their link in bio into a full conversion engine.',
    ar: 'تجارب وقصص نجاح المبدعين. تعرف على كيفية تحويل روابط البايو إلى منصات احترافية متكاملة تدر دخلاً حقيقياً.'
  },
  pricing: {
    en: 'Transparent pricing plans. Start completely free forever, or upgrade to Pro for custom domains, unlimited links, and priority support.',
    ar: 'خطط أسعار واضحة وشفافة. ابدأ مجاناً مدى الحياة، أو قم بالترقية للباقة الاحترافية للنطاقات المخصصة ودعم الأولوية.'
  },
  faq: {
    en: 'Frequently asked questions. Learn about custom domains, zero fees on digital products, calendar sync, and seamless migration from other platforms.',
    ar: 'الأسئلة الشائعة والدعم الفني. إجابات شاملة حول النطاقات المخصصة، البيع بدون عمولة، والتحويل السلس من المنصات الأخرى.'
  },
  newsletter: {
    en: 'Weekly creator newsletter. Subscribe for curated insights on mini-site growth, new high-converting templates, and product updates.',
    ar: 'النشرة البريدية الأسبوعية. اشترك للحصول على أحدث النصائح، قوالب حصرية، وتحديثات منتجات رالوا مباشرة في بريدك.'
  }
};

const TRACKED_SECTIONS = [
  'hero',
  'benefits',
  'templates',
  'how-it-works',
  'features',
  'testimonials',
  'pricing',
  'faq',
  'newsletter'
];

export interface UseVoiceTourOptions {
  locale: Locale;
}

export function useVoiceTour({ locale }: UseVoiceTourOptions) {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSection, setCurrentSection] = useState<string>('hero');
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const lastSpokenSectionRef = useRef<string | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Detect Web Speech API support and initialize voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      try {
        voicesRef.current = window.speechSynthesis.getVoices();
      } catch {
        // Fallback
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Helper to stop speaking
  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      activeUtteranceRef.current = null;
      setIsSpeaking(false);
    } catch {
      // Ignore cleanup error
    }
  }, []);

  // Speak narration for a specific section
  const speakSection = useCallback((sectionId: string, force: boolean = false) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!force && lastSpokenSectionRef.current === sectionId) return;

    const script = TOUR_SCRIPTS[sectionId]?.[locale] || TOUR_SCRIPTS.hero[locale];
    if (!script) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
      utterance.rate = locale === 'ar' ? 0.92 : 0.96; // slightly relaxed natural cadence
      utterance.pitch = 1.0;

      // Select voice if available matching language
      const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
      const targetPrefix = locale === 'ar' ? 'ar' : 'en';
      const matchedVoice = voices.find(v => v.lang.startsWith(targetPrefix));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentSection(sectionId);
        lastSpokenSectionRef.current = sectionId;
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        // Interrupted is normal when user scrolls to next section
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Speech synthesis error:', e);
        }
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      };

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Voice tour playback failed:', err);
      setIsSpeaking(false);
    }
  }, [locale]);

  // Section observer to detect scroll changes
  useEffect(() => {
    if (!isEnabled) {
      stopSpeaking();
      lastSpokenSectionRef.current = null;
      return;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    // Observe all tour sections
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const topId = visible[0].target.id;
          if (topId && TRACKED_SECTIONS.includes(topId)) {
            setCurrentSection(topId);
            speakSection(topId, false);
          }
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0.15, 0.35, 0.6]
      }
    );

    TRACKED_SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [isEnabled, speakSection, stopSpeaking]);

  // Handle toggling the tour
  const toggleTour = useCallback(() => {
    if (!isEnabled) {
      setIsEnabled(true);
      // Immediately start narrating the currently visible section or hero
      let initialSection = 'hero';
      for (const id of TRACKED_SECTIONS) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.2) {
            initialSection = id;
            break;
          }
        }
      }
      setCurrentSection(initialSection);
      speakSection(initialSection, true);
    } else {
      setIsEnabled(false);
      stopSpeaking();
      lastSpokenSectionRef.current = null;
    }
  }, [isEnabled, speakSection, stopSpeaking]);

  // Replay current section narration
  const replayCurrent = useCallback(() => {
    if (isEnabled && currentSection) {
      speakSection(currentSection, true);
    }
  }, [isEnabled, currentSection, speakSection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    isEnabled,
    isSpeaking,
    isSupported,
    currentSection,
    toggleTour,
    stopTour: stopSpeaking,
    replayCurrent
  };
}
