# OMON CRM — Narx kalkulyatori (minimal versiya)

Endi faqat narx kalkulyatori mavjud. Oldingi SPIN, kirish, rahbar profili, savollar va taqdimot bo‘limlari sahifadan olib tashlangan.

## Formulalar

- CRM oylik: agentlar × 189 000 so‘m.
- CRM jami: oylik × 6 yoki 12.
- Texnik xizmat: **1–3 agent uchun $200**, **4–5 agent uchun $300**, **6+ agent uchun $400**.
- **Texnik xizmat davriyligi**: aniqlashtirilmagan. Interfeysda «bir martalik (taxmin)» / «har oy» tanlovi bor. $200/$300/$400 6 va 12 oylik hisobga faqat shu tanlov bo‘yicha kiritiladi.
- Telefon xizmati: shaxsiy raqam uchun 42 000 so‘m/raqam/oy; kompaniya raqami uchun 110 000 so‘m/raqam/oy, yoki «kerak emas».
- Paket jami (so‘m): (CRM oylik + telefoniya oylik) × oylar.
- Texnik xizmat USDda alohida, ixtiyoriy qo‘lda kiritiladigan USD kursi bilan umumiy so‘m ekvivalentini olish mumkin. Kurs avtomatik olinmaydi.

## Foydalanish

`index.html` mustaqil HTML/CSS/JavaScript fayl, tashqi kutubxona, login yoki backend kerak emas. Kalkulyator ma’lumotlarni serverga yoki localStoragega saqlamaydi. Natijani nusxalash yoki PDF sifatida chop etish mumkin.

Vercel loyihasining Root Directory: `tools/turagent-spin-audit`; domen: https://toursales-insight.vercel.app

Narxlar taklif sifatida hisoblanadi; soliq, chegirma, valyuta konvertatsiyasi va qo‘shimcha xizmatlar shartnoma bo‘yicha tasdiqlanishi zarur.
