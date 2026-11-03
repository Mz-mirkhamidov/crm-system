# OMON CRM — Tijorat taklifnomasi (KP) konstruktori

Onlayn: https://toursales-insight.vercel.app

## Imkoniyatlar
- OMON CRM ko‘k gradient brendi va foydalanuvchi taqdim etgan logo belgisiga mos jonli KP
- Turagentlik nomi, rahbar, telefon, hudud, ijrochi, uchrashuv sanasi
- Xodimlar, ish kunlari, kunlik lidlar va ishlanmagan lidlar
- Qayta bog‘lanadigan lidlar %, issiq lead bron ehtimoli %, 1 ta bron sof foydasi
- Hozirgi/maqsadli javob tezligi, tur qidirish vaqti va qidiruvlar soni
- Natijalar: ishlanmay qolgan lidlar/oy, qo‘shimcha bronlar/oy, qo‘shimcha sof foyda imkoniyati/oy, tur qidirishda faol vaqt tejalishi/oy
- 6 va 12 oylik CRM paketi, ixtiyoriy bonus oylar, MyZvanki yoki UzTel, bir martalik texnik xizmat
- Yakuniy narxni yuqorida va batafsil tarkibda ko‘rsatish, taqdimot rejimi va PDFga chop etish
- Lokal takliflar ro‘yxati, saqlash/o‘chirish, JSON eksport va matnni nusxalash

## Narxlar (UZS)
- 1 CRM agent / oy = **189 000 so‘m**
- MyZvanki shaxsiy raqami / oy = **49 000 so‘m**
- UzTel kompaniya raqami / oy = **110 000 so‘m**
- Bir martalik texnik xizmat: **1–3 agent = $200**, **4–5 agent = $300**, **6+ agent = $400**

**Jami to‘lov (6/12 oy) = (agentlar × 189000 + telefoniya raqamlari × telefon tarifi) × paket oylari + texnik xizmat USD × USD/UZS kursi.**

Texnik xizmat faqat bir marta qo‘shiladi. Kursni O‘zbekiston Markaziy banki JSON API dan olishga harakat qiladi; API ishlamasa 2026-11-03 uchun yozib qo‘yilgan 11 941,65 so‘mlik namunaviy kurs ishlatilishi va uning holati ekranda alohida ko‘rsatiladi. Kursni qo‘lda kiritish mumkin. Bunday holatda yakuniy shartnoma kursini tekshirish lozim. Kurs butunlay o‘chirib yuborilsa so‘m va dollar summalari **alohida** ko‘rsatiladi, noto‘g‘ri birlashtirilmaydi.

## KPI formulasi
- Yo‘qolgan lidlar / oy = ishlanmagan lidlar / kun × ish kunlari.
- Qayta ishlangan lidlar / oy = yo‘qolgan lidlar / oy × qayta bog‘lanish ulushi.
- Qo‘shimcha bronlar / oy = qayta ishlangan lidlar × issiq paytda bron ehtimoli.
- Qo‘shimcha foyda prognozi = qo‘shimcha bronlar × bitta bronning sof foydasi.
- Tur qidirishda faol ish vaqti tejalishi = max(hozirgi − maqsadli qidirish vaqti, 0) × bir kundagi qidirishlar soni × ish kunlari / 60.

**Muhim:** qo‘shimcha bronlar va foyda — foydalanuvchi kiritgan taxminlarga asoslangan ssenariy, kafolatlangan natija emas. Javob kechikishi ish soati tejalishi bilan adashtirilmaydi.

## Deploy
Yagona mustaqil `index.html`; HTML/CSS/JS va inline PNG logotip. Vercel project root: `tools/turagent-spin-audit`. Backend talab qilinmaydi.

Shaxsiy ma’lumotlar faqat foydalanuvchi brauzerining localStorage xotirasida saqlanadi. Serverga uzatilmaydi (USD kursini olish uchun rasmiy tashqi API bilan aloqa bundan mustasno). Saqlash qurilmalararo sinxron emas. Ekranni ulashishda **Mijozga ko‘rsatish** rejimini tanlang; chop etishda tahrir paneli yashiriladi.
