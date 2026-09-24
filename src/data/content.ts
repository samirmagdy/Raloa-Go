import { TemplateItem, PricingPlan, TestimonialItem, FAQItem } from '../types';

export const templatesData: TemplateItem[] = [
  {
    id: 'elena',
    name: 'Elena',
    role: 'Art Director & Architectural Photographer',
    category: 'Portfolio',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
    bio: 'Art Director & Architectural Photographer. Exploring light, concrete and minimal spaces.',
    bioAr: 'مديرة فنية ومصورة معمارية. استكشاف الضوء والخرسانة والمساحات البسيطة.',
    themeColor: '#5B5CF6',
    accentGradient: 'from-indigo-500 to-violet-600',
    sampleLinks: [
      {
        id: 'l1',
        title: 'Portfolio',
        titleAr: 'معرض الأعمال',
        subtitle: 'Selected works 2023-2024',
        subtitleAr: 'أعمال مختارة ٢٠٢٣-٢٠٢٤',
        url: '#portfolio',
        thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=120&q=80',
        type: 'gallery'
      },
      {
        id: 'l2',
        title: 'Book a Session',
        titleAr: 'حجز جلسة تصوير',
        subtitle: 'Available for architecture & editorial projects',
        subtitleAr: 'متاحة للمشاريع المعمارية والتحريرية',
        url: '#book',
        thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=120&q=80',
        type: 'booking'
      },
      {
        id: 'l3',
        title: 'Shop Prints',
        titleAr: 'شراء مطبوعات فنية',
        subtitle: 'Limited edition museum-grade prints',
        subtitleAr: 'مطبوعات فنية فاخرة محدودة الإصدار',
        url: '#shop',
        thumbnail: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=120&q=80',
        type: 'shop'
      },
      {
        id: 'l4',
        title: 'My Gear',
        titleAr: 'معدات التصوير',
        subtitle: 'Cameras, lenses & tripod recommendations',
        subtitleAr: 'الكاميرات والعدسات وأدوات الإنتاج',
        url: '#gear',
        thumbnail: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=120&q=80',
        type: 'link'
      }
    ],
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'x', url: 'https://x.com' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'linkedin', url: 'https://linkedin.com' },
      { platform: 'email', url: 'mailto:elena@example.com' }
    ]
  },
  {
    id: 'mateo',
    name: 'Mateo',
    role: 'Filmmaker & Visual Storyteller',
    category: 'Creative',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    bio: 'Independent director & DP crafting cinematic narratives for music and brands.',
    bioAr: 'مخرج مستقل ومدير تصوير أصنع قصصاً سينمائية للموسيقى والعلامات التجارية.',
    themeColor: '#2563EB',
    accentGradient: 'from-blue-600 to-indigo-600',
    sampleLinks: [
      { id: 'm1', title: 'Latest Showreel 2024', titleAr: 'العرض المرئي ٢٠٢٤', subtitle: '4K cinematography reel', subtitleAr: 'عرض سينمائي بدقة 4K', url: '#reel', type: 'gallery' },
      { id: 'm2', title: 'Commercial Enquiries', titleAr: 'طلبات الإنتاج التجاري', subtitle: 'Representation & direct bookings', subtitleAr: 'للحجوزات والتعاون الإعلاني', url: '#booking', type: 'booking' },
      { id: 'm3', title: 'Color Grading LUTs', titleAr: 'حزم تلوين الفيديو LUTs', subtitle: 'Download cinematic presets', subtitleAr: 'تحميل فلاتر تلوين سينمائية', url: '#shop', type: 'shop' }
    ],
    socials: [
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'x', url: 'https://x.com' }
    ]
  },
  {
    id: 'studio',
    name: 'STUDIO',
    role: 'Modern Interior & Object Design',
    category: 'Business',
    avatar: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
    bio: 'Sustainable interior architecture, bespoke ceramics and calm living spaces.',
    bioAr: 'تصميم داخلي مستدام، خزف يدوي ومساحات معيشة هادئة وعصرية.',
    themeColor: '#0F172A',
    accentGradient: 'from-slate-800 to-slate-900',
    sampleLinks: [
      { id: 's1', title: 'Residential Catalog', titleAr: 'كتالوج المشاريع السكنية', subtitle: 'Explore recent interior projects', subtitleAr: 'استعرض أحدث التصاميم الداخلية', url: '#catalog', type: 'gallery' },
      { id: 's2', title: 'Schedule Consultation', titleAr: 'حجز استشارة تصميم', subtitle: '60 min design audit with our lead architect', subtitleAr: 'جلسة استشارية ٦٠ دقيقة مع كبير المصممين', url: '#consult', type: 'booking' },
      { id: 's3', title: 'Ceramics Collection', titleAr: 'تشكيلة الخزف المصنوع يدوياً', subtitle: 'Handcrafted stoneware', subtitleAr: 'قطع فخارية محدودة للطلب الفوري', url: '#store', type: 'shop' }
    ],
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'linkedin', url: 'https://linkedin.com' },
      { platform: 'email', url: 'mailto:contact@studio.design' }
    ]
  },
  {
    id: 'dr-ahmed',
    name: 'Dr. Ahmed',
    role: 'Consultant Dermatologist',
    category: 'Professional',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
    bio: 'Evidence-based clinical skincare, laser aesthetics and telehealth consultations.',
    bioAr: 'طب الجلدية المبني على الدليل العلمي، العلاج بالليزر والاستشارات الطبية عن بعد.',
    themeColor: '#10B981',
    accentGradient: 'from-emerald-600 to-teal-600',
    sampleLinks: [
      { id: 'd1', title: 'Online Telehealth Clinic', titleAr: 'عيادة الاستشارات المرئية', subtitle: 'Direct video appointments', subtitleAr: 'حجز موعد كشف مباشر عبر الفيديو', url: '#telehealth', type: 'booking' },
      { id: 'd2', title: 'Approved Skincare Regimens', titleAr: 'دليل المستحضرات المعتمدة', subtitle: 'Clinically tested routines', subtitleAr: 'روتين عناية مثبت طبياً لجميع أنواع البشرة', url: '#regimen', type: 'link' },
      { id: 'd3', title: 'Clinic Location & Hours', titleAr: 'موقع العيادة ومواعيد العمل', subtitle: 'Harley St Medical Pavilion', subtitleAr: 'خريطة الوصول وأرقام السكرتارية', url: '#location', type: 'link' }
    ],
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'linkedin', url: 'https://linkedin.com' }
    ]
  },
  {
    id: 'fitlife',
    name: 'FitLife',
    role: 'Certified Strength & Nutrition Coach',
    category: 'Fitness',
    avatar: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
    bio: 'Helping busy professionals build functional strength, mobility and daily energy.',
    bioAr: 'مساعدة المهنيين على بناء اللياقة البدنية الحقيقية والقوة وعادات التغذية المستدامة.',
    themeColor: '#EC4899',
    accentGradient: 'from-pink-500 to-rose-600',
    sampleLinks: [
      { id: 'f1', title: '1-on-1 Coaching Intake', titleAr: 'التقديم للتدريب الخاص', subtitle: '3 spots open this month', subtitleAr: '٣ مقاعد شاغرة للتدريب الشخصي هذا الشهر', url: '#apply', type: 'booking' },
      { id: 'f2', title: '12-Week Hypertrophy Program', titleAr: 'برنامج التحول الرياضي ١٢ أسبوع', subtitle: 'Mobile workout tracker & meals', subtitleAr: 'خطة تمارين وجداول وجبات مخصصة', url: '#program', type: 'shop' },
      { id: 'f3', title: 'Free Macro Calculator', titleAr: 'حاسبة السعرات والماكروز المجانية', subtitle: 'Calculate your optimal protein intake', subtitleAr: 'احسب احتياجك اليومي من السعرات والبروتين', url: '#calculator', type: 'link' }
    ],
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'tiktok', url: 'https://tiktok.com' }
    ]
  },
  {
    id: 'wander',
    name: 'Wander',
    role: 'Travel Journalist & Expedition Leader',
    category: 'Travel',
    avatar: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    bio: 'Documenting hidden archipelagos, alpine crossings and slow travel culture.',
    bioAr: 'توثيق الجزر الخفية والمسارات الجبلية وثقافة السفر الهادئ حول العالم.',
    themeColor: '#0284C7',
    accentGradient: 'from-sky-500 to-blue-600',
    sampleLinks: [
      { id: 'w1', title: 'Kyoto Hidden Temples Guide', titleAr: 'دليل معابد كيوتو السرية', subtitle: 'Interactive Google Maps list & tips', subtitleAr: 'خريطة تفاعلية وقائمة مسارات غير معتادة', url: '#guide', type: 'shop' },
      { id: 'w2', title: 'Upcoming Iceland Group Trek', titleAr: 'رحلة أيسلندا الجماعية القادمة', subtitle: 'August 2024 · 8 traveler limit', subtitleAr: 'أغسطس ٢٠٢٤ · عدد محدود من المقاعد', url: '#trek', type: 'booking' },
      { id: 'w3', title: 'Travel Photography Presets', titleAr: 'فلاتر صور السفر والرحلات', subtitle: 'Lightroom desktop & mobile pack', subtitleAr: 'حزمة لايت روم للهاتف والكمبيوتر', url: '#presets', type: 'shop' }
    ],
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'x', url: 'https://x.com' }
    ]
  },
  {
    id: 'savor',
    name: 'Savor',
    role: 'Artisan Baker & Culinary Educator',
    category: 'Food',
    avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    bio: 'Wild fermentation, sourdough masterclasses and Mediterranean seasonal dining.',
    bioAr: 'التخمير الطبيعي، دورات خبز الساوردو وأطباق البحر الأبيض المتوسط الموسمية.',
    themeColor: '#D97706',
    accentGradient: 'from-amber-600 to-orange-600',
    sampleLinks: [
      { id: 'sv1', title: 'Weekend Sourdough Workshop', titleAr: 'ورشة عمل خبز الساوردو الأسبوعية', subtitle: 'Live hands-on baking class', subtitleAr: 'تدريب عملي مباشر على العجن والخبز', url: '#workshop', type: 'booking' },
      { id: 'sv2', title: 'The Fermentation Handbook', titleAr: 'كتاب أسرار التخمير والخبز', subtitle: 'Instant digital PDF download with 40 recipes', subtitleAr: 'كتاب رقمي فوري يحتوي ٤٠ وصفة مبتكرة', url: '#handbook', type: 'shop' },
      { id: 'sv3', title: 'Heirloom Flour & Sourdough Starter', titleAr: 'خميرة طبيعية ودقيق بلدي عضوي', subtitle: 'Shipping across the GCC & Europe', subtitleAr: 'شحن محلي ودولي لمنتجات الخبز المختارة', url: '#starter', type: 'shop' }
    ],
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'tiktok', url: 'https://tiktok.com' }
    ]
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Electronic Music Producer & Sound Designer',
    category: 'Personal',
    avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
    bio: 'Atmospheric synth textures, live modular sets and film audio design.',
    bioAr: 'موسيقى سينث جوية، عروض إلكترونية حية وهندسة صوتيات للأفلام والمؤثرات.',
    themeColor: '#7C3AED',
    accentGradient: 'from-purple-600 to-indigo-700',
    sampleLinks: [
      { id: 'n1', title: 'Stream New EP "Mirage"', titleAr: 'استمع للألبوم الجديد "سراب"', subtitle: 'Available on Spotify, Apple Music & Vinyl', subtitleAr: 'متوفر على سبوتيفاي وأبل ميوزك وإصدار فينيل', url: '#stream', type: 'link' },
      { id: 'n2', title: 'Tour Dates & Tickets', titleAr: 'مواعيد الحفلات والتذاكر', subtitle: 'Berlin, London, Dubai & Tokyo', subtitleAr: 'برلين، لندن، دبي وطوكيو', url: '#tour', type: 'booking' },
      { id: 'n3', title: 'Analog Synth Sample Pack', titleAr: 'حزمة عينات السيمبلر التناظرية', subtitle: '250+ royalty-free loops and one-shots', subtitleAr: 'أكثر من ٢٥٠ عينة صوتية احترافية بدون حقوق', url: '#samples', type: 'shop' }
    ],
    socials: [
      { platform: 'spotify', url: 'https://spotify.com' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'instagram', url: 'https://instagram.com' }
    ]
  }
];

export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    nameAr: 'المجانية',
    priceMonthly: 0,
    priceYearly: 0,
    period: 'forever',
    periodAr: 'مدى الحياة',
    description: 'Everything you need to get started.',
    descriptionAr: 'كل ما تحتاجه للبدء وإطلاق صفحتك الشخصية الأولى.',
    features: [
      'RALOA subdomain (raloa.app/@name)',
      'Basic templates',
      'Up to 10 links',
      'Basic analytics'
    ],
    featuresAr: [
      'نطاق فرعي مجاني (raloa.app/@اسمك)',
      'قوالب تصميم أساسية',
      'ما يصل إلى ١٠ روابط',
      'إحصائيات زيارات أساسية'
    ],
    ctaText: 'Get started free',
    ctaTextAr: 'ابدأ مجاناً الآن',
    ctaVariant: 'secondary'
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'المحترفين (برو)',
    priceMonthly: 6,
    priceYearly: 4.8, // 20% off
    period: 'month',
    periodAr: 'شهرياً',
    description: 'For serious creators and professionals.',
    descriptionAr: 'لصناع المحتوى والمستقلين الجادين في تنمية أعمالهم.',
    popular: true,
    features: [
      'Custom domain (yourname.com)',
      'All premium templates',
      'Unlimited links & media',
      'Bookings & payments checkout',
      'Advanced real-time analytics',
      'Remove RALOA branding'
    ],
    featuresAr: [
      'ربط نطاق خاص بك (yourname.com)',
      'جميع القوالب الاحترافية المتميزة',
      'روابط ومحتوى وسائط غير محدود',
      'نظام حجز مواعيد ودفع إلكتروني مباشر',
      'تحليلات دقيقة ولحظية للزوار والنقرات',
      'إزالة شعار رالوا بالكامل'
    ],
    ctaText: 'Start Pro',
    ctaTextAr: 'ابدأ باقة المحترفين',
    ctaVariant: 'dark'
  },
  {
    id: 'business',
    name: 'Business',
    nameAr: 'الشركات والفرق',
    priceMonthly: 12,
    priceYearly: 9.6, // 20% off
    period: 'month',
    periodAr: 'شهرياً',
    description: 'For teams and growing businesses.',
    descriptionAr: 'للفرق والشركات الناشئة والمؤسسات المتنامية.',
    features: [
      'Everything in Pro plan',
      'Multiple team members & roles',
      'Advanced API & CRM integrations',
      'Dedicated priority VIP support',
      'Early access to new features & beta'
    ],
    featuresAr: [
      'جميع مزايا باقة المحترفين بالكامل',
      'صلاحيات متعددة لأعضاء الفريق',
      'ربط متقدم مع أنظمة CRM والواجهات البرمجية',
      'دعم فني مخصص ذو أولوية على مدار الساعة',
      'أسبقية الوصول للميزات الجديدة والتحديثات'
    ],
    ctaText: 'Start Business',
    ctaTextAr: 'ابدأ باقة الشركات',
    ctaVariant: 'secondary'
  }
];

export const testimonialsData: TestimonialItem[] = [
  {
    id: 't1',
    quote: 'RALOA helped me showcase my work professionally and get more clients. Super easy to use!',
    quoteAr: 'ساعدني رالوا في استعراض أعمالي بأناقة عالية والحصول على عملاء حقيقيين. سهل الاستخدام وسريع جداً!',
    author: 'Elena Rostova',
    authorAr: 'إيلينا روستوفا',
    role: 'Photographer & Art Director',
    roleAr: 'مصورة معمارية ومديرة فنية',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    rating: 5
  },
  {
    id: 't2',
    quote: 'I replaced 5 different tools with RALOA. Now everything is in one link and my bookings increased by 3x.',
    quoteAr: 'استبدلت ٥ أدوات ومواقع مختلفة برابط رالوا واحد. زادت حجوزات جلسات الإنتاج لدي بمقدار ٣ أضعاف.',
    author: 'Mateo Cruz',
    authorAr: 'ماتيو كروز',
    role: 'Filmmaker & Director',
    roleAr: 'مخرج ومصنع أفلام مستقل',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    rating: 5
  },
  {
    id: 't3',
    quote: 'Beautiful templates, simple to use, and amazing Arabic typography support. Highly recommended!',
    quoteAr: 'قوالب متقنة للغاية، سهولة فائقة ودعم عربي أصيل للخطوط والاتجاهات من اليمين لليسار. أنصح به بشدة!',
    author: 'Sara Al-Mansoori',
    authorAr: 'سارة المنصوري',
    role: 'Content Creator & Designer',
    roleAr: 'صانعة محتوى ومصممة رقمية',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
    rating: 5
  }
];

export const faqData: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'Is RALOA free to use?',
    questionAr: 'هل رالوا مجاني للاستخدام؟',
    answer: 'Yes! Our Free plan provides everything you need to create and host your mini-site, add up to 10 links, showcase your work, and access essential analytics. You can use it free forever with zero credit card required.',
    answerAr: 'نعم بالتأكيد! توفر باقتنا المجانية كل ما تحتاجه لإنشاء واستضافة موقعك المصغر، وإضافة ما يصل إلى ١٠ روابط واستعراض أعمالك مع إحصائيات أساسية، وبدون طلب أي بطاقة ائتمانية على الإطلاق.'
  },
  {
    id: 'faq-2',
    question: 'Can I use my own domain?',
    questionAr: 'هل يمكنني استخدام النطاق الخاص بي (دومين)؟',
    answer: 'Yes. On our Pro and Business plans, you can easily connect your own custom domain (such as yourname.com or studio.me) with automatic SSL certificates and global CDN delivery.',
    answerAr: 'نعم. مع باقة المحترفين وباقة الشركات، يمكنك ربط نطاقك المخصص بسهولة تامة (مثل yourname.com) مع شهادة أمان SSL تلقائية وشبكة توزيع محتوى فائقة السرعة.'
  },
  {
    id: 'faq-3',
    question: 'Can I sell products or accept bookings?',
    questionAr: 'هل يمكنني بيع المنتجات أو استقبال حجوزات المواعيد؟',
    answer: 'Absolutely. RALOA comes with native booking calendar integration for scheduling client calls and direct checkout for digital downloads, physical prints, consulting services, and courses.',
    answerAr: 'بالتأكيد. يحتوي رالوا على نظام تقويم مدمج لتنظيم وحجز المواعيد مع العملاء، وبوابة دفع إلكترونية لبيع المنتجات الرقمية والمطبوعات والاستشارات الفردية.'
  },
  {
    id: 'faq-4',
    question: 'Is there an Arabic version?',
    questionAr: 'هل تتوفر نسخة كاملة باللغة العربية؟',
    answer: 'Yes! RALOA is built from the ground up with native English and Arabic (RTL) support. Both your public mini-site and the editing studio can be switched seamlessly with beautiful Arabic typography and right-to-left layout.',
    answerAr: 'نعم! صُمم رالوا من الصفر ليدعم اللغتين العربية والإنجليزية بشكل أصيل. يعمل موقعك المصغر ولوحة التحكم باتجاه RTL متكامل وخطوط عربية مختارة بعناية فائقة.'
  },
  {
    id: 'faq-5',
    question: 'Do I need any technical skills?',
    questionAr: 'هل أحتاج إلى أي خبرة برمجية أو تقنية؟',
    answer: 'None at all. Creating your page takes less than 60 seconds. Simply pick an approved design template, paste your links or content, customize colors, and hit publish.',
    answerAr: 'لا تحتاج لأي خبرة على الإطلاق. إطلاق صفحتك يستغرق أقل من ٦٠ ثانية: اختر قالباً يناسبك، أضف روابطك ومحتواك، وشارك رابطك مباشرة مع جمهورك.'
  }
];

export const platformIntegrations = [
  { name: 'YouTube', icon: 'youtube' },
  { name: 'Instagram', icon: 'instagram' },
  { name: 'TikTok', icon: 'tiktok' },
  { name: 'LinkedIn', icon: 'linkedin' },
  { name: 'Adobe', icon: 'adobe' },
  { name: 'Spotify', icon: 'spotify' },
  { name: 'Notion', icon: 'notion' },
  { name: 'Substack', icon: 'mail' },
  { name: 'Shopify', icon: 'shopping-bag' },
  { name: 'Calendly', icon: 'calendar' }
];

export const benefitsList = [
  {
    id: 'b1',
    title: 'Launch in minutes',
    titleAr: 'إطلاق في دقائق',
    body: 'Choose a template, add your content, and go live instantly.',
    bodyAr: 'اختر قالباً، أضف روابطك ومحتواك، وانطلق مباشرة.',
    color: '#EC4899',
    bgColor: '#FDF2F8',
    icon: 'zap'
  },
  {
    id: 'b2',
    title: 'Stunning templates',
    titleAr: 'قوالب فائقة الأناقة',
    body: 'Professionally designed, fully customizable.',
    bodyAr: 'مصممة بأعلى معايير الجودة الفنية وقابلة للتخصيص.',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    icon: 'palette'
  },
  {
    id: 'b3',
    title: 'More opportunities',
    titleAr: 'فرص نمو أكبر',
    body: 'Grow your audience, get clients, make sales.',
    bodyAr: 'وسّع دائرة جمهورك، استقطب عملاء جدد وحقق مبيعات.',
    color: '#10B981',
    bgColor: '#ECFDF5',
    icon: 'trending-up'
  },
  {
    id: 'b4',
    title: 'Works everywhere',
    titleAr: 'يعمل على كل الأجهزة',
    body: 'Looks polished on mobile, tablet and desktop.',
    bodyAr: 'تجربة بصرية مذهلة على الهاتف والتابلت والكمبيوتر.',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    icon: 'devices'
  }
];

export const featuresList = [
  {
    id: 'f-domain',
    title: 'Custom domain',
    titleAr: 'نطاق خاص بك',
    body: 'Use your own domain (e.g. yourname.com)',
    bodyAr: 'استخدم نطاقك الخاص مثل (yourname.com)',
    icon: 'globe',
    color: '#2563EB',
    bgColor: '#EFF6FF'
  },
  {
    id: 'f-bookings',
    title: 'Bookings & scheduling',
    titleAr: 'حجز المواعيد والتقويم',
    body: 'Get appointments directly on your page',
    bodyAr: 'استقبل حجوزات الاستشارات مباشرة على صفحتك',
    icon: 'calendar',
    color: '#EC4899',
    bgColor: '#FDF2F8'
  },
  {
    id: 'f-products',
    title: 'Sell products',
    titleAr: 'بيع المنتجات',
    body: 'Offer digital or physical products with ease',
    bodyAr: 'اعرض منتجاتك الرقمية أو الملموسة بسهولة تامة',
    icon: 'shopping-bag',
    color: '#7C3AED',
    bgColor: '#F5F3FF'
  },
  {
    id: 'f-analytics',
    title: 'Analytics',
    titleAr: 'تحليلات ذكية',
    body: 'Track views, clicks and grow faster',
    bodyAr: 'تتبع المشاهدات والنقرات ومصادر الزيارات بدقة',
    icon: 'bar-chart-3',
    color: '#2563EB',
    bgColor: '#EFF6FF'
  },
  {
    id: 'f-gallery',
    title: 'Media galleries',
    titleAr: 'معارض وسائط بصرية',
    body: 'Showcase your work with beautiful galleries',
    bodyAr: 'استعرض صورك وأعمالك وتصاميمك بشبكات بصرية رائعة',
    icon: 'image',
    color: '#0284C7',
    bgColor: '#F0F9FF'
  },
  {
    id: 'f-social',
    title: 'Social integrations',
    titleAr: 'ربط الشبكات الاجتماعية',
    body: 'Connect all your social platforms',
    bodyAr: 'اربط جميع حساباتك ومنصاتك في مكان مركزي واحد',
    icon: 'share-2',
    color: '#10B981',
    bgColor: '#ECFDF5'
  },
  {
    id: 'f-seo',
    title: 'SEO optimized',
    titleAr: 'مهيأ لمحركات البحث',
    body: 'Get discovered on Google and social previews',
    bodyAr: 'ظهور متميز في نتائج بحث جوجل وبطاقات التواصل',
    icon: 'search',
    color: '#14B8A6',
    bgColor: '#F0FDFA'
  },
  {
    id: 'f-custom',
    title: 'Fully customizable',
    titleAr: 'تخصيص كامل وشامل',
    body: 'Colors, fonts, sections — make it yours',
    bodyAr: 'الألوان والخطوط والأقسام — خصصها كما تحب',
    icon: 'sliders',
    color: '#F59E0B',
    bgColor: '#FEF3C7'
  }
];

export const dictionary = {
  en: {
    nav: {
      templates: 'Templates',
      features: 'Features',
      howItWorks: 'How it works',
      pricing: 'Pricing',
      resources: 'Resources',
      langToggle: 'العربية',
      signIn: 'Sign in',
      createPage: 'Create your page'
    },
    hero: {
      eyebrow: 'MINI-SITES FOR CREATORS · ENGLISH + ARABIC',
      headlineStart: 'Your story.',
      headlineGradient: 'One beautiful link.',
      subheadline: 'Turn your links, content and bookings into a stunning mini-site in minutes. No coding. No limits.',
      prefix: 'raloa.app/@',
      placeholder: 'yourname',
      cta: 'Create your page',
      proof: ['Free forever', 'No credit card required', 'Live in 60 seconds'],
      allLinksSticker: 'All your links in one place',
      templatesSticker: 'Templates that convert',
      anyDeviceSticker: 'Looks amazing on any device',
      clicksMetric: '+300% More clicks'
    },
    trust: {
      label: 'TRUSTED BY CREATORS, FREELANCERS AND BUSINESSES WORLDWIDE'
    },
    templatesSection: {
      eyebrow: 'PROFESSIONALLY DESIGNED',
      headline: 'Templates for',
      headlineGradient: 'every creator',
      subheadline: 'Choose from modern, conversion-focused templates and make them yours.',
      browseAll: 'Browse all templates',
      moreTemplates: 'More templates'
    },
    howItWorksSection: {
      eyebrow: 'GET STARTED TODAY',
      headline: 'How RALOA works',
      subheadline: 'Three simple steps to your stunning mini-site.',
      doodleText: 'From idea to impact in minutes',
      steps: [
        {
          num: 1,
          title: 'Choose a template',
          body: 'Pick a design that fits your style or start from scratch.'
        },
        {
          num: 2,
          title: 'Add your content',
          body: 'Links, media, bookings, products and more — all in one place.'
        },
        {
          num: 3,
          title: 'Go live and share',
          body: 'Get your unique raloa.app/@name link and start growing.'
        }
      ]
    },
    featuresSection: {
      eyebrow: 'MORE THAN JUST LINKS',
      headline: 'Everything you need to grow',
      subheadline: 'Powerful features designed for creators, freelancers and businesses.',
      seeAll: 'See all features'
    },
    testimonialsSection: {
      eyebrow: 'LOVED BY CREATORS WORLDWIDE',
      headline: 'Real people. Real results.',
      seeMore: 'See more stories'
    },
    pricingSection: {
      eyebrow: 'SIMPLE & TRANSPARENT',
      headline: 'Pricing for every creator',
      subheadline: 'Powerful features designed for your stunning mini-site.',
      monthly: 'Monthly',
      yearly: 'Yearly',
      saveBadge: 'Save 20%',
      popularBadge: 'Most popular'
    },
    faqSection: {
      eyebrow: 'COMMON QUESTIONS',
      headline: 'Frequently asked questions',
      stillQuestions: 'Still have questions?',
      contactSupport: 'Contact our support team.'
    },
    finalCta: {
      eyebrow: 'READY TO BUILD YOURS?',
      headline: 'Create your mini-site today',
      subheadline: 'Join thousands of creators, freelancers and businesses using RALOA.',
      cta: 'Create your page',
      proof: ['Free forever', 'No credit card required', 'Live in 60 seconds']
    },
    footer: {
      tagline: 'Design-first mini-sites',
      product: 'Product',
      company: 'Company',
      resources: 'Resources',
      legal: 'Legal',
      copyright: '© 2024 RALOA. All rights reserved.'
    }
  },
  ar: {
    nav: {
      templates: 'القوالب',
      features: 'المميزات',
      howItWorks: 'كيف يعمل',
      pricing: 'الأسعار',
      resources: 'المصادر',
      langToggle: 'English',
      signIn: 'تسجيل الدخول',
      createPage: 'أنشئ صفحتك'
    },
    hero: {
      eyebrow: 'مواقع مصغرة للمبدعين · باللغتين العربية والإنجليزية',
      headlineStart: 'قصتك وتأثيرك.',
      headlineGradient: 'في رابط واحد مذهل.',
      subheadline: 'حوّل روابطك ومحتواك ومواعيدك إلى موقع شخصي مصغر في دقائق معدودة. بلا أي برمجة وبلا قيود.',
      prefix: 'raloa.app/@',
      placeholder: 'اسمك',
      cta: 'أنشئ صفحتك الآن',
      proof: ['مجاني مدى الحياة', 'بدون بطاقة ائتمانية', 'موقعك جاهز في ٦٠ ثانية'],
      allLinksSticker: 'كل روابطك في مكان واحد',
      templatesSticker: 'قوالب تحقق نتائج',
      anyDeviceSticker: 'مظهر جذاب على كل الشاشات',
      clicksMetric: '+٣٠٠٪ نقرات أكثر'
    },
    trust: {
      label: 'موثوق من صناع المحتوى والمستقلين وأصحاب الأعمال حول العالم'
    },
    templatesSection: {
      eyebrow: 'تصاميم احترافية',
      headline: 'قوالب لكل',
      headlineGradient: 'مبدع ومحترف',
      subheadline: 'اختر من بين تشكيلة قوالب عصرية مصممة لزيادة التفاعل واجعلها تعبر عن هويتك.',
      browseAll: 'تصفح جميع القوالب',
      moreTemplates: 'المزيد من القوالب'
    },
    howItWorksSection: {
      eyebrow: 'ابدأ اليوم بسهولة',
      headline: 'كيف يعمل رالوا',
      subheadline: 'ثلاث خطوات بسيطة فقط لتنطلق بموقعك المصغر الجذاب.',
      doodleText: 'من الفكرة إلى الإطلاق في دقائق',
      steps: [
        {
          num: 1,
          title: 'اختر القالب المناسب',
          body: 'انتقِ قالباً يمثل علامتك وذوقك أو ابدأ من لوحة بيضاء.'
        },
        {
          num: 2,
          title: 'أضف محتواك وروابطك',
          body: 'روابط، وسائط، مواعيد، منتجات والمزيد — كلها في مكان واحد.'
        },
        {
          num: 3,
          title: 'انشر وابدأ المشاركة',
          body: 'احصل على رابطك الفريد raloa.app/@اسمك وشاركه مع العالم.'
        }
      ]
    },
    featuresSection: {
      eyebrow: 'أكثر من مجرد روابط',
      headline: 'كل الأدوات التي تحتاجها للنمو',
      subheadline: 'ميزات متطورة مصممة خصيصاً للمبدعين والمستقلين والشركات.',
      seeAll: 'شاهد كافة المميزات'
    },
    testimonialsSection: {
      eyebrow: 'تجارب المبدعين حول العالم',
      headline: 'أشخاص حقيقيون. نتائج واقعية.',
      seeMore: 'شاهد المزيد من القصص'
    },
    pricingSection: {
      eyebrow: 'خطط بسيطة وشفافة',
      headline: 'أسعار مناسبة لكل صانع محتوى',
      subheadline: 'ميزات قوية صُممت خصيصاً لموقعك المصغر المتميز.',
      monthly: 'شهري',
      yearly: 'سنوي',
      saveBadge: 'وفّر ٢٠٪',
      popularBadge: 'الأكثر طلباً'
    },
    faqSection: {
      eyebrow: 'الأسئلة الشائعة',
      headline: 'إجابات على تساؤلاتك',
      stillQuestions: 'هل لديك استفسار آخر؟',
      contactSupport: 'تواصل مع فريق الدعم الفني لدينا.'
    },
    finalCta: {
      eyebrow: 'هل أنت مستعد للانطلاق؟',
      headline: 'أنشئ موقعك المصغر اليوم',
      subheadline: 'انضم لآلاف المبدعين والمستقلين والشركات الذين يعتمدون على رالوا.',
      cta: 'أنشئ صفحتك الآن',
      proof: ['مجاني مدى الحياة', 'بدون بطاقة ائتمانية', 'جاهز في ٦٠ ثانية']
    },
    footer: {
      tagline: 'مواقع مصغرة تركز على التصميم',
      product: 'المنتج',
      company: 'الشركة',
      resources: 'المصادر',
      legal: 'الشروط والخصوصية',
      copyright: '© ٢٠٢٤ رالوا. جميع الحقوق محفوظة.'
    }
  }
};
