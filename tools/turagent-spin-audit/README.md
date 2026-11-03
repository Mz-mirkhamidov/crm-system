# OMON CRM — Individual tijorat taklifnomasi (KP)

**Production:** https://toursales-insight.vercel.app

## 2026-11-03 yangilanishi

- **Telefoniya ixtiyoriy.** “Kerak emas” tanlansa, KPning narx, xizmat tarkibi, shartlar va ko‘chiriladigan matnida telefoniya qatorlari umuman ko‘rsatilmaydi.
- **Turagentlik rasmi/logotipi** upload qilish mumkin: JPG/PNG/WebP, 8 MB gacha; fayl brauzerda 440 px dan oshmaydigan WebPga siqiladi va tayyor KPda chiqadi. Saqlangan taklif bilan birga localStorageda qoladi.
- **Ijrochi doimiy:** Muzaffar Mirkhamidov, +998 77 177 13 19. Tahrirlash maydonlari olib tashlangan. Eski saqlangan takliflar ham yangi doimiy ijrochi ma’lumotiga moslashtiriladi.
- **Avtomatik bonus:** 6 oy uchun to‘lov → 6 + 1 = **7 oy foydalanish**; 12 oy uchun to‘lov → 12 + 3 = **15 oy foydalanish**. Bonus CRMga ham, tanlangan bo‘lsa MyZvanki/UzTelga ham tatbiq etiladi. Bonus oylar uchun qo‘shimcha obuna to‘lovi olinmaydi. Bonusni qo‘lda o‘zgartirish maydoni yo‘q.
- Yuqorida ko‘k rangli bonus banneri va 6+1 / 12+3 solishtirishlari; 04-bo‘limda mijoz nimani olayotgani: akkauntlar soni, bonusli foydalanish muddati, bir martalik sozlash, lidlar bazasi, menejer nazorati, hisobotlar, tur qidirish va tanlangan telefoniya.

## Narxlar

- CRM akkaunt: **189 000 so‘m / agent / oy**
- MyZvanki: **49 000 so‘m / raqam / oy**
- UzTel: **110 000 so‘m / raqam / oy**
- Texnik xizmat (bir marta): **1–3 agent $200**, **4–5 agent $300**, **6+ agent $400**

```
Jami = CRM agentlar soni × 189 000 × (6 yoki 12 to‘lov oyi)
     + ixtiyoriy telefoniya narxi × raqamlar soni × (6 yoki 12 to‘lov oyi)
     + texnik xizmat USD × 1 USD kursi
```

Bonus oylar to‘lov oylariga ko‘paytirilmaydi. USD kursi Markaziy bank orqali avtomatik olishga uriniladi, olinmasa sahifada aniq ko‘rsatilgan namunaviy kurs yoki foydalanuvchi qo‘lda kiritgan kurs ishlatiladi.

## Lidlar va natijalar hisoblash

- Yo‘qolgan lidlar/oy = kunlik ishlanmay qolgan lidlar × ish kunlari
- Qayta qamrab olinadigan lidlar = yo‘qolgan lidlar/oy × qayta ishlash ulushi
- Qo‘shimcha bronlar ssenariysi = qayta qamrab olinadigan lidlar × bron ehtimoli
- Qo‘shimcha sof foyda ssenariysi = qo‘shimcha bronlar × bron uchun o‘rtacha sof foyda
- Tur qidirish vaqti tejalishi = max(hozirgi − maqsadli daqiqa, 0) × kundalik tur qidirishlar × ish kunlari / 60

**Natijalar prognoz, kafolat emas.** 04-bo‘limdagi ba’zi integratsiyalar ulanish/shartnoma shartlariga bog‘liq. AI xizmati avtomatik qo‘shilgan deb hisoblanmaydi.

## Ishlatish

Bitta `index.html` fayl, tashqi JS paketlari va backend talab qilinmaydi. Vercel root: `tools/turagent-spin-audit`. Tahrirlash, mijozga taqdim etish, PDFga chop etish, taklifni saqlash/yuklash va JSON eksport ishlaydi. Shaxsiy ma’lumot va agentlik rasmi faqat joriy brauzerning localStorage xotirasida saqlanadi — umumiy qurilmalarda ehtiyot bo‘ling.
