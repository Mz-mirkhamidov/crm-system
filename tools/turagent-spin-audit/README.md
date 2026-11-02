# TourSales Insight

Turagentlik rahbari bilan SPIN (Situation, Problem, Implication, Need-Payoff) diagnostika, so‘rovlar va sotuv konversiyasi tahlili, moliyaviy ssenariy va PDF hisobot ishlab chiqadigan **mustaqil bitta HTML sahifa**.

## Boshlash

`index.html` faylini brauzerda oching. Server, API kalit, Node.js yoki ma’lumotlar bazasi kerak emas. Mobil telefonda ham ochiladi.

## Funksiyalar

- 35 ta turagentlikka mos SPIN savol, izoh va holat belgisi.
- Har turagentlik uchun alohida profil va lokal saqlash.
- Javobsiz so‘rovlar, tiklangan lidlar, follow-up imkoniyati, qo‘shimcha bronlar, foyda hissasi, vaqt qiymati, CRM to‘lovi, setup xarajati va ROI.
- Hisobotni brauzer orqali PDFga chiqarish; JSON import/eksport.
- Demo raqamlar tugmasi.

## Formula va ehtiyot chorasi

Aloqa konversiyasi = sotuv / (so‘rovlar − javobsiz so‘rovlar). Tiklangan bronlar = javobsiz so‘rovlar × qayta tiklash % × aloqa konversiyasi. Follow-up bronlar = (aloqa qilingan so‘rovlar − sotuvlar) × qo‘shimcha konversiya %. Oylik qo‘shimcha foyda hissasi = (tiklangan + follow-up bronlar) × bir bronning foyda hissasi. Oylik ROI = (qo‘shimcha foyda hissasi − CRM oylik to‘lovi) / CRM oylik to‘lovi.

**Farazlarni real natija bilan adashtirmang.** Vaqt qiymati ROIga qo‘shilmaydi. Hamma ma’lumot brauzer localStorage xotirasida; markaziy serverga yuborilmaydi. Zaxira uchun JSON eksport qiling. Platforma funksiyalarining mavjudligi alohida tekshiriladi.
