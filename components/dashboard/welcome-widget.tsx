"use client";

import { useEffect, useState } from "react";
import { useOperator } from "@/lib/useOperator";
import { Sparkles, TrendingUp, Target, Sun, Moon, Sunset } from "lucide-react";

const MOTIVATIONAL_QUOTES = [
  "Har bir 'YO'Q' — seni muvaffaqiyatga yaqinlashtiradi!",
  "Bugun's aktiv bo'l, ertangi natijalar bugun yaratiladi.",
  "Eng yaxshi sotuv — mijozga haqiqiy yordam bergan sotuvdir.",
  "Kamtarona harakat + Izchillik = Katta natija.",
  "Yaxshi muloqot — eng kuchli sotish vositasi.",
  "Har bir qo'ng'iroq — yangi imkoniyat.",
  "Champions don't quit — siz ham qila olasiz!",
  "Bugun bir qadam olg'a — ertaga bitta yutuq ko'p.",
];

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return { text: "Xayrli tong", icon: Sun, color: "text-yellow-400" };
  if (hour >= 12 && hour < 17) return { text: "Xayrli kun", icon: Target, color: "text-orange-400" };
  if (hour >= 17 && hour < 21) return { text: "Xayrli kechqurun", icon: Sunset, color: "text-pink-400" };
  return { text: "Xayrli kecha", icon: Moon, color: "text-blue-400" };
}

export function WelcomeWidget() {
  const operator = useOperator();
  const [quote, setQuote] = useState("");
  const [hour, setHour] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const now = new Date();
    setHour(now.getHours());
    setQuote(MOTIVATIONAL_QUOTES[now.getDay() % MOTIVATIONAL_QUOTES.length]);
    // Animate in
    setTimeout(() => setVisible(true), 100);
  }, []);

  const name = operator?.name ?? "";

  const greeting = getGreeting(hour);
  const Icon = greeting.icon;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-violet-900/10 border border-primary/15 rounded-2xl p-5 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{ boxShadow: "0 0 30px hsl(262 83% 62% / 0.06)" }}>

      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-600/5 rounded-full blur-xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${greeting.color}`} />
            <span className={`text-sm font-medium ${greeting.color}`}>{greeting.text}!</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {name ? `${name} 👋` : "Xush kelibsiz!"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed italic">
            "{quote}"
          </p>
        </div>

        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="mt-4 h-0.5 bg-gradient-to-r from-primary/40 via-violet-500/20 to-transparent rounded-full" />
    </div>
  );
}
