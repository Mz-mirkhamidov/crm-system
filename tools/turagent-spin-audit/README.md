# OMON CRM — Narx kalkulyatori

Vercel production: https://toursales-insight.vercel.app

Bu sahifada faqat narx kalkulyatori mavjud. SPIN, rahbar profili va taqdimot bo‘limlari yo‘q.

## Tariflar

- CRM obunasi: **189 000 so‘m / 1 agent / oy**.
- Paketlar: **6 oy** va **12 oy** (bir vaqtda solishtiriladi).
- Texnik xizmat (bir marta): **1–3 agent uchun $200**, **4–5 agent uchun $300**, **6 va ko‘p agent uchun $400**.
- MyZvanki (shaxsiy raqam): **42 000 so‘m / raqam / oy**.
- UzTel (kompaniya raqami): **110 000 so‘m / raqam / oy**.
- Telefoniya ixtiyoriy, raqamlar soni tanlanadi.

## Formula

```
CRM oylik = agentlar × 189000
Telefoniya oylik = raqamlar × (42000 yoki 110000) [agar tanlangan bo‘lsa]
Texnik xizmat (UZS) = round(texnik xizmat USD × USD/UZS kurs)
6 oylik jami = (CRM oylik + telefoniya oylik) × 6 + texnik xizmat (UZS)
12 oylik jami = (CRM oylik + telefoniya oylik) × 12 + texnik xizmat (UZS)
```

Texnik xizmat **6/12 oylik hisobda bir martagina** qo‘shiladi. So‘mdagi jami eng yuqoridagi ajratilgan blokda ko‘rinadi. CRM oylik, jami CRM, telefoniya oylik/jami va texnik xizmat alohida ko‘rsatiladi. PDF / chop etish va hisobni nusxalash mumkin.

## USD kursi

Sahifa ishga tushganda birinchi navbatda O‘zbekiston Respublikasi Markaziy banki JSON API dan USD kursini oladi: `https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/`. Agar ishlamasa, CBU kursini qayta tarqatuvchi ochiq API dan foydalanadi; ulanish bo‘lmasa **03.11.2026 dagi 11 941,65 so‘m** namunaviy kursi qoldiriladi, bu sana ko‘rsatiladi. Kursni qo‘lda o‘zgartirish va yangilash mumkin. Yakuniy summa kurs va shartnoma shartlariga bog‘liq.

## Ishga tushirish

`index.html` mustaqil HTML/CSS/JS bo‘lib, Node.js, backend yoki login talab qilmaydi. Vercel Root Directory: `tools/turagent-spin-audit`.

Foydalanuvchi kiritgan raqamlar serverga saqlanmaydi. Telefon xizmati va CRM obunasi uchun soliq/qo‘shimcha xarajatlar hisobga kiritilmagan.
