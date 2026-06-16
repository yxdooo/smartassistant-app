import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      navbar: {
        dashboard: "Dashboard",
        analytics: "Analytics",
        logout: "Logout",
        login: "Sign In",
        register: "Sign Up"
      },
      common: {
        save: "Save Changes",
        saving: "Saving...",
        cancel: "Cancel",
        exportCsv: "CSV",
        exportPdf: "Export PDF",
        settings: "Settings"
      },
      settings: {
        title: "Profile Settings",
        age: "Age",
        gender: "Gender",
        male: "Male",
        female: "Female",
        height: "Height (cm)",
        weight: "Weight (kg)",
        activity: "Activity Level",
        sedentary: "Sedentary (Little to no exercise)",
        light: "Lightly Active (Light exercise 1-3 days/week)",
        moderate: "Moderately Active (Moderate exercise 3-5 days/week)",
        very: "Very Active (Hard exercise 6-7 days/week)",
        extra: "Extra Active (Very hard job)",
        weightGoal: "Weight Goal",
        lose: "Lose Weight",
        maintain: "Maintain Weight",
        gain: "Gain Weight",
        budgetLimit: "Monthly Budget Limit ($)"
      },
      dashboard: {
        title: "Overview",
        subtitle: "Here's your personal digest for today.",
        budgetForecast: "Budget Forecast",
        spentSoFar: "Spent So Far",
        monthlyLimit: "Monthly Limit",
        calorieStatus: "Calorie Status",
        netCalories: "Net Calories",
        dailyGoal: "Daily Goal",
        expensesCategory: "Expenses by Category",
        noExpenses: "No expenses yet",
        quickAdd: "Quick Add",
        scanReceipt: "Scan Receipt",
        scanning: "Scanning...",
        category: "Category",
        amount: "$0.00",
        description: "Description (Optional)",
        add: "Add",
        subscriptions: "Subscriptions",
        noSubscriptions: "No subscriptions tracked.",
        name: "Name",
        calorieGoals: "Calorie & Macro Goals",
        consumed: "Consumed",
        burned: "Burned",
        net: "Net",
        goal: "Goal",
        healthTracker: "Health Tracker",
        hydration: "Hydration",
        glasses: "Glasses",
        goal16h: "Goal 16h",
        stopFast: "Stop Fast",
        startFast: "Start Fast",
        activityLog: "Activity Log",
        exerciseType: "Exercise Type",
        mins: "Mins",
        foodDatabase: "Food Database",
        searchPlaceholder: "Search Apple, Chicken...",
        search: "Search",
        import: "Import",
        mySavedFoods: "My Saved Foods",
        grams: "Grams",
        breakfast: "Breakfast",
        lunch: "Lunch",
        dinner: "Dinner",
        snack: "Snack",
        logFood: "Log Food"
      },
      analytics: {
        title: "Analytics & Achievements",
        subtitle: "Track your long-term progress and unlock badges.",
        spendingTrends: "Spending Trends (Last 6 Months)",
        spent: "Spent",
        noData: "No data available",
        trophyCabinet: "Trophy Cabinet",
        unlocked: "Unlocked",
        locked: "Locked"
      },
      smartbot: {
        title: "SmartAssistant",
        subtitle: "AI Advisor",
        placeholder: "Ask me anything..."
      },
      landing: {
        heroTitle: "Manage Wealth & Health in One Place",
        heroSub: "The ultimate Super App to track your budget, fasting, calories, and habits with AI.",
        getStarted: "Get Started Free",
        features: "Features",
        f1Title: "Smart Budgeting",
        f1Sub: "AI-driven forecasting and receipt scanning.",
        f2Title: "Health Tracking",
        f2Sub: "Monitor calories, macros, fasting, and hydration.",
        f3Title: "Gamification",
        f3Sub: "Unlock badges and view your long-term progress."
      }
    }
  },
  tr: {
    translation: {
      navbar: {
        dashboard: "Panel",
        analytics: "Analizler",
        logout: "Çıkış Yap",
        login: "Giriş Yap",
        register: "Kayıt Ol"
      },
      common: {
        save: "Değişiklikleri Kaydet",
        saving: "Kaydediliyor...",
        cancel: "İptal",
        exportCsv: "CSV",
        exportPdf: "PDF İndir",
        settings: "Ayarlar"
      },
      settings: {
        title: "Profil Ayarları",
        age: "Yaş",
        gender: "Cinsiyet",
        male: "Erkek",
        female: "Kadın",
        height: "Boy (cm)",
        weight: "Kilo (kg)",
        activity: "Aktivite Seviyesi",
        sedentary: "Hareketsiz (Egzersiz yok)",
        light: "Hafif Aktif (Haftada 1-3 gün)",
        moderate: "Orta Aktif (Haftada 3-5 gün)",
        very: "Çok Aktif (Haftada 6-7 gün)",
        extra: "Aşırı Aktif (Fiziksel meslek)",
        weightGoal: "Kilo Hedefi",
        lose: "Kilo Ver",
        maintain: "Kilo Koru",
        gain: "Kilo Al",
        budgetLimit: "Aylık Bütçe Sınırı ($)"
      },
      dashboard: {
        title: "Genel Bakış",
        subtitle: "İşte bugünkü kişisel özetin.",
        budgetForecast: "Bütçe Tahmini",
        spentSoFar: "Şu Ana Kadar Harcanan",
        monthlyLimit: "Aylık Sınır",
        calorieStatus: "Kalori Durumu",
        netCalories: "Net Kalori",
        dailyGoal: "Günlük Hedef",
        expensesCategory: "Kategorilere Göre Harcamalar",
        noExpenses: "Henüz harcama yok",
        quickAdd: "Hızlı Ekle",
        scanReceipt: "Fiş Tara",
        scanning: "Taranıyor...",
        category: "Kategori",
        amount: "$0.00",
        description: "Açıklama (İsteğe bağlı)",
        add: "Ekle",
        subscriptions: "Abonelikler",
        noSubscriptions: "Takip edilen abonelik yok.",
        name: "İsim",
        calorieGoals: "Kalori ve Makro Hedefleri",
        consumed: "Alınan",
        burned: "Yakılan",
        net: "Net",
        goal: "Hedef",
        healthTracker: "Sağlık Takibi",
        hydration: "Su Tüketimi",
        glasses: "Bardak",
        goal16h: "Hedef 16s",
        stopFast: "Orucu Bitir",
        startFast: "Oruca Başla",
        activityLog: "Aktivite Günlüğü",
        exerciseType: "Egzersiz Türü",
        mins: "Dk",
        foodDatabase: "Yemek Veritabanı",
        searchPlaceholder: "Elma, Tavuk Ara...",
        search: "Ara",
        import: "İçe Aktar",
        mySavedFoods: "Kayıtlı Yemeklerim",
        grams: "Gram",
        breakfast: "Kahvaltı",
        lunch: "Öğle Yemeği",
        dinner: "Akşam Yemeği",
        snack: "Atıştırmalık",
        logFood: "Yemek Ekle"
      },
      analytics: {
        title: "Analizler ve Başarılar",
        subtitle: "Uzun vadeli gelişimini takip et ve rozetleri aç.",
        spendingTrends: "Harcama Trendi (Son 6 Ay)",
        spent: "Harcanan",
        noData: "Veri bulunmuyor",
        trophyCabinet: "Kupa Dolabı",
        unlocked: "Açıldı",
        locked: "Kilitli"
      },
      smartbot: {
        title: "SmartAsistan",
        subtitle: "Yapay Zeka Danışmanı",
        placeholder: "Bana her şeyi sor..."
      },
      landing: {
        heroTitle: "Bütçe ve Sağlık Tek Bir Yerde",
        heroSub: "Yapay zeka ile bütçeni, orucunu, kalorilerini ve alışkanlıklarını takip eden nihai Süper Uygulama.",
        getStarted: "Ücretsiz Başla",
        features: "Özellikler",
        f1Title: "Akıllı Bütçe",
        f1Sub: "Yapay zeka destekli bütçe tahmini ve fiş tarama.",
        f2Title: "Sağlık Takibi",
        f2Sub: "Kalori, makro, aralıklı oruç ve su takibi.",
        f3Title: "Oyunlaştırma",
        f3Sub: "Rozetlerin kilidini aç ve uzun vadeli analizleri gör."
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en', // Default to 'en' unless local storage has a pref
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
