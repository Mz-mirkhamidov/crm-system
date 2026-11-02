# TourSales Insight — turagentlik diagnostika sayti

SPIN usulidagi ichki suhbat yo‘riqnomasi, rahbar oldida ko‘rsatish uchun maxfiy qaydlarsiz alohida **taqdimot rejimi**, 4 bosqichli moliyaviy kalkulyator hamda PDF taqdimot.

## Ishlash

`index.html` faylini brauzerda oching yoki Vercel production manzilidan foydalaning. Vercel loyihasining root directory qiymati: `tools/turagent-spin-audit`. JavaScript bilan ishlaydigan mustaqil HTML, backend/kalit talab qilmaydi.

1. **Bosh sahifa:** agentlik, rahbar, sana va maqsadlarini yozing. Har bir mijoz uchun alohida profil.
2. **Ichki suhbat:** SPIN bo‘yicha avval 16 ta asosiy savol (4×4), istasangiz qolganlarini oching. Javoblar, eslatmalar va muammo holatini saqlang. S1, S4, P1, I1, I4 kiritilgan sonlarni kalkulyator bilan bog‘laydi.
3. **Kalkulyator:** 01 Hozirgi holat → 02 Yo‘qotishlar → 03 O‘sish farazlari → 04 Xarajat va natija. O‘zgartirilgan qiymatlar avtomatik saqlanadi, jonli hisob yangilanadi.
4. **Rahbarga taqdimot:** navigatsiya, ichki SPIN savollar, javoblar, kontakt va eslatmalar yashiriladi. 4 sahifali ko‘rsatkichlar, biznes imkoniyatlari va pilot rejasi. “PDF” bilan barcha 4 sahifani chop eting.
5. **Ichki hisobot:** faqat siz uchun suhbat javoblari va batafsil ma’lumotlar. Ekran ulashishda bunga o‘tmang.

Taqdimotdan chiqish uchun tasdiqlash so‘raladi. Ekran ulashishdan **oldin** taqdimot rejimini yoqing.

## Metodika

- Javobsiz so‘rovlar aniq son sifatida kiritilsa foiz o‘rniga aniq son ishlatiladi.
- Aloqa o‘rnatilgan so‘rovlar = jami so‘rovlar − javobsizlar.
- Tiklangan bronlar = javobsiz × qayta bog‘lanish foizi × qayta bog‘langanlar konversiyasi.
- Follow-up bronlar = (aloqa o‘rnatilgan − mavjud bronlar) × qo‘shimcha sotuv foizi.
- Jami qo‘shimcha bronlar = tiklangan + follow-up bronlar; **bir-birini kesmaydigan guruhlar**.
- Qo‘shimcha foyda hissasi = qo‘shimcha bronlar × bitta bronning foyda hissasi.
- Oylik hisobiy sof natija = qo‘shimcha foyda hissasi − CRM oylik to‘lovi.
- Birinchi oy natijasi = oylik sof natija − bir martalik sozlash xarajati.
- Ssenariylar faraz foizlarini 60% / 100% / 130% koeffitsiyentga ko‘paytiradi; foizlar 100 dan oshmaydi.
- Xodimlarning bo‘shashi mumkin bo‘lgan vaqtining pul ekvivalenti **ROIga qo‘shilmaydi**.

**Muhim:** Hisob prognoz, natija kafolati emas. Xato yoki yetishmaydigan ma’lumotlar bo‘lsa natija yakuniy emas. Demo qiymatlarini mijoz faktlari bilan adashtirmang. Mijoz ma’lumotlari shu brauzerning `localStorage` xotirasida; zaxira uchun JSON eksport qiling. Ekran ulashishdan oldin taqdimot rejimiga o‘ting, chunki ichki ish rejimi maxfiy suhbat matnini saqlaydi.


## Kirish va rahbar profili (v3)

- `Kirish va rahbar` — SPIN'dan oldin alohida ish bosqichi. Tanishish, vaqt va agenda kelishish, savolga ruxsat, Situationga o'tish uchun 5 bosqichli checklist.
- Rahbar F.I.Sh., lavozimi, telefon/Telegram/email, qaror roli va qarorga ta’sir qiluvchi shaxslar; agentlik nomi, shahar, sayt, yillik tajriba, jamoa soni, lid manbalari, hozirgi CRM; uchrashuv sanasi/vaqti/joyi/formati/holati; kelishuv va keyingi aloqa.
- 3 ta tabiiy kirish nutqi (rasmiy, qisqa, samimiy), nutq tanlash va nusxa olish tugmasi. Nutqda mavjud rahbar nomidan foydalanadi.
- Kirish qaydlari ichki hisobotga kiritiladi, ammo ommaviy taqdimot va PDFga chiqarilmaydi. Shaxsiy kontaktlar hech bir ommaviy slaydga chiqarilmaydi.
- Oldingi `toursales-insight-v1` localStorage yozuvlari bilan mos: yangi maydonlar bo‘sh qoladi, oldingi agentlik/savollar/kalkulyator saqlanadi.

**Shaxsiy ma’lumotlar:** sayt serverga avtomatik yubormaydi; kontaktlar va qaydlar faqat o‘sha brauzerning `localStorage` xotirasida va foydalanuvchi alohida eksport qilgan JSONda qoladi. Umumiy qurilmadan foydalanmang va JSON eksportni xavfsiz joyda saqlang. Bu foydalanuvchilararo avtorizatsiyali CRM tizimi emas.
