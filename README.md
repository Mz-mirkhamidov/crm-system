# Sellora CRM

Shaxsiy CRM tizimi — Lidlar, Mijozlar, Zakazlar, Follow-up va Telegram bot.

## Tech Stack

- **Frontend:** Next.js 16 (App Router)
- **Auth:** Supabase Auth (telefon + parol)
- **Database:** Supabase (PostgreSQL)
- **UI:** Tailwind CSS + custom komponentlar
- **Deploy:** Vercel (GitHub bilan ulangan)
- **Bot:** Supabase Edge Functions

---

## Login tizimi (Supabase Auth)

Foydalanuvchilar **telefon raqam + parol** orqali kiradilar. Ichkarida har bir telefon
raqam yashirin (sintetik) emailga aylantiriladi va Supabase Auth orqali tekshiriladi —
SMS/OTP shart emas. Sessiya xavfsiz HttpOnly cookie orqali saqlanadi.

- `app/login` — kirish
- `app/register` — ro'yxatdan o'tish (ochiq, darhol faol)
- `app/api/auth/*` — server route'lar (login / register / logout / me)
- `lib/phone.ts` — telefon → email mapping
- `proxy.ts` — sahifalarni rol bo'yicha himoyalaydi

`operators` jadvali profil jadvali sifatida saqlanadi va `auth.users.id === operators.id`.

### Kerakli Environment Variables (Vercel)

| O'zgaruvchi | Qayerdan | Izoh |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public (anon/publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | **Maxfiy**, faqat server |

---

## Funksiyalar

- Dashboard: statistika + grafik + bugungi ro'yxatlar
- Lidlar / Mijozlar / Zakazlar: CRUD + filter + follow-up
- Follow-ups: bugungi + kechikkanlar + bajarildi belgisi
- Admin panel: operatorlar va umumiy statistika
- Telegram: kunlik avtomatik xabar (Edge Function)
