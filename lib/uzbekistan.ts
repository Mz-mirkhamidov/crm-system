export interface District { name: string }
export interface Region { name: string; districts: string[] }

export const UZBEKISTAN_REGIONS: Region[] = [
  {
    name: "Toshkent shahri",
    districts: ["Bektemir", "Chilonzor", "Hamza", "Mirzo Ulug'bek", "Mirobod", "Olmazor", "Sergeli", "Shayxontohur", "Uchtepa", "Yakkasaroy", "Yunusobod"],
  },
  {
    name: "Toshkent viloyati",
    districts: ["Angren", "Bekabad", "Bo'stonliq", "Bo'ka", "Chinoz", "Ohangaron", "Oqqo'rg'on", "Parkent", "Piskent", "Qibray", "Urtachirchiq", "Yuqorichirchiq", "Zangiota"],
  },
  {
    name: "Andijon viloyati",
    districts: ["Andijon shahri", "Asaka", "Baliqchi", "Bo'ston", "Izboskan", "Jalolquduq", "Marhamat", "Oltinko'l", "Paxtaobod", "Qo'rg'ontepa", "Shahrixon", "Ulug'nor", "Xo'jaobod"],
  },
  {
    name: "Farg'ona viloyati",
    districts: ["Farg'ona shahri", "Oltiariq", "Bag'dod", "Beshariq", "Buvayda", "Dang'ara", "Furqat", "Qo'shtepa", "Marg'ilon shahri", "Quva", "Rishton", "Toshloq", "Uchko'prik", "O'g'on"],
  },
  {
    name: "Namangan viloyati",
    districts: ["Namangan shahri", "Chortoq", "Chust", "Kosonsoy", "Mingbuloq", "Norin", "Pop", "To'raqo'rg'on", "Uychi", "Yangiyo'l"],
  },
  {
    name: "Samarqand viloyati",
    districts: ["Samarqand shahri", "Bulungur", "Ishtixon", "Jomboy", "Kattaqo'rg'on", "Narpay", "Nurobod", "Oqdaryo", "Pastdarg'om", "Payariq", "Qo'shrabot", "Toyloq", "Urgut"],
  },
  {
    name: "Buxoro viloyati",
    districts: ["Buxoro shahri", "G'ijduvon", "Jondor", "Kogon", "Olot", "Peshku", "Qorako'l", "Qorovulbozor", "Romitan", "Shofirkon", "Vobkent"],
  },
  {
    name: "Navoiy viloyati",
    districts: ["Navoiy shahri", "Karmana", "Konimex", "Navbahor", "Nurota", "Qiziltepa", "Tomdi", "Uchquduq", "Xatirchi"],
  },
  {
    name: "Qashqadaryo viloyati",
    districts: ["Qarshi shahri", "Chiroqchi", "Dehqonobod", "G'uzor", "Kasbi", "Kitob", "Koson", "Mirishkor", "Muborak", "Nishon", "Qamashi", "Shahrisabz", "Yakkabog'"],
  },
  {
    name: "Surxondaryo viloyati",
    districts: ["Termiz shahri", "Angor", "Bandixon", "Bo'ysun", "Denov", "Jarqo'rg'on", "Muzrabot", "Oltinsoy", "Qiziriq", "Qumqo'rg'on", "Sariosiy", "Sherobod", "Sho'rchi", "Uzun"],
  },
  {
    name: "Jizzax viloyati",
    districts: ["Jizzax shahri", "Arnasoy", "Baxmal", "Do'stlik", "Forish", "G'allaorol", "Mirzacho'l", "Paxtakor", "Yangiobod", "Zafarobod", "Zarbdor", "Zomin"],
  },
  {
    name: "Sirdaryo viloyati",
    districts: ["Guliston shahri", "Boyovut", "Mirzaobod", "Oqoltin", "Sardoba", "Sayxunobod", "Shirin shahri", "Xovos", "Yangiyer"],
  },
  {
    name: "Xorazm viloyati",
    districts: ["Urganch shahri", "Bog'ot", "Gurlan", "Hazorasp", "Xiva shahri", "Qo'shko'pir", "Shovot", "Tuproqqal'a", "Xonqa", "Yangiariq", "Yangibozor"],
  },
  {
    name: "Qoraqalpog'iston Respublikasi",
    districts: ["Nukus shahri", "Amudaryo", "Beruniy", "Bo'zatov", "Chimboy", "Ellikkala", "Kegeyli", "Mo'ynoq", "Qanliko'l", "Qorao'zak", "Qo'ng'irot", "Shumanay", "Taxtako'pir", "To'rtko'l", "Xo'jayli"],
  },
];

export const REGION_NAMES = UZBEKISTAN_REGIONS.map((r) => r.name);

export function getDistricts(regionName: string): string[] {
  return UZBEKISTAN_REGIONS.find((r) => r.name === regionName)?.districts || [];
}
