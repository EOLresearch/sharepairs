// This file includes all options arrays split into English and Turkish arrays for conditional localization

export const US_STATES_EN = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
  "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
];

export const US_STATES_TR = [...US_STATES_EN];

export const RACE_OPTIONS_EN = [
  "American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races", "Prefer not to say", "Other"
];

export const RACE_OPTIONS_TR = [
  "Amerikan Yerlisi veya Alaska Yerlisi", "Asyalı", "Siyahi veya Afrikalı Amerikalı", "Hispanik veya Latin",
  "Havai Yerlisi veya Diğer Pasifik Adalı", "Beyaz", "İki veya Daha Fazla Irk", "Belirtmek istemiyorum", "Diğer"
];

export const ETHNICITY_OPTIONS_EN = ["Hispanic or Latino", "Not Hispanic or Latino"];
export const ETHNICITY_OPTIONS_TR = ["Hispanik veya Latin", "Hispanik veya Latin Değil"];

export const BIOLOGICAL_SEX_OPTIONS_EN = ["Male", "Female", "Intersex", "Prefer not to say"];
export const BIOLOGICAL_SEX_OPTIONS_TR = ["Erkek", "Kadın", "İnterseks", "Belirtmek istemiyorum"];

export const EDUCATION_OPTIONS_EN = [
  "No formal education", "Some primary school", "Primary school completed", "Some high school", "High school/GED completed",
  "Trade/Technical/Vocational training", "Some college", "Associate degree (e.g., AA, AS)", "Bachelor’s degree (e.g., BA, BS)",
  "Post-graduate diploma/certificate", "Master’s degree (e.g., MA, MS, MEng, MEd, MSW, MBA)",
  "Professional degree (e.g., MD, DDS, DVM, JD)", "Doctorate (e.g., PhD, EdD)", "Prefer not to say"
];

export const EDUCATION_OPTIONS_TR = [
  "Resmi eğitim yok", "Biraz ilkokul", "İlkokul tamamlandı", "Biraz lise", "Lise/GED tamamlandı",
  "Meslek/Teknik eğitim", "Biraz üniversite", "Ön lisans (ör. AA, AS)", "Lisans (ör. BA, BS)",
  "Lisansüstü diploma/sertifika", "Yüksek lisans (ör. MA, MS, MEng, MEd, MSW, MBA)",
  "Profesyonel derece (ör. MD, DDS, DVM, JD)", "Doktora (ör. PhD, EdD)", "Belirtmek istemiyorum"
];

export const HOUSEHOLD_OPTIONS_EN = [
  "Single adult", "With two or more unrelated adults", "Single parent with children", "Couple without children",
  "Couple with children", "Extended family", "Shared/Roommates", "Group home or communal living",
  "Student residence/dormitory", "Elderly living alone", "Elderly couple without children at home",
  "Other", "Prefer not to say"
];

export const HOUSEHOLD_OPTIONS_TR = [
  "Tek yetişkin", "İki veya daha fazla ilgisiz yetişkinle", "Çocuklu bekar ebeveyn", "Çocuksuz çift",
  "Çocuklu çift", "Geniş aile", "Paylaşılan/ev arkadaşı", "Toplu yaşam",
  "Öğrenci yurdu", "Yalnız yaşayan yaşlı", "Evde çocuksuz yaşlı çift",
  "Diğer", "Belirtmek istemiyorum"
];



export const KINSHIP_OPTIONS_EN = [
  "Spouse", "Partner", "Parent", "Sibling", "Child", "Grandparent",
  "Grandchild", "Aunt", "Uncle", "Niece", "Nephew", "Cousin",
  "Friend", "Other", "Support others"
];

export const KINSHIP_OPTIONS_TR = [
  "Eş", "Partner", "Ebeveyn", "Kardeş", "Çocuk", "Büyükbaba/Büyükanne",
  "Torun", "Hala/Teyze", "Amca/Dayı", "Yeğen (kız)", "Yeğen (erkek)", "Kuzen",
  "Arkadaş", "Diğer", "Başkalarını destekle"
];


export const CAUSE_OPTIONS_EN = ["Natural", "Unnatural"];
export const CAUSE_OPTIONS_TR = ["Doğal", "Doğal olmayan"];

export const TURKISH_PROVINCES_EN = [
  "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Amasya", "Ankara", "Antalya", "Artvin", "Aydin",
  "Balikesir", "Bilecik", "Bingol", "Bitlis", "Bolu", "Burdur", "Bursa", "Canakkale", "Cankiri",
  "Corum", "Denizli", "Diyarbakir", "Edirne", "Elazig", "Erzincan", "Erzurum", "Eskisehir",
  "Gaziantep", "Giresun", "Gumushane", "Hakkari", "Hatay", "Isparta", "Mersin", "Istanbul", "Izmir",
  "Kars", "Kastamonu", "Kayseri", "Kirklareli", "Kirsehir", "Kocaeli", "Konya", "Kutahya", "Malatya",
  "Manisa", "Kahramanmaras", "Mardin", "Mugla", "Mus", "Nevsehir", "Nigde", "Ordu", "Rize",
  "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdag", "Tokat", "Trabzon", "Tunceli",
  "Sanliurfa", "Usak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kirikkale",
  "Batman", "Sirnak", "Bartin", "Ardahan", "Igdir", "Yalova", "Karabuk", "Kilis", "Osmaniye", "Duzce"
];

export const TURKISH_PROVINCES_TR = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın",
  "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı",
  "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
  "Gaziantep", "Giresun", "Gümüşhane", "Hakkâri", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir",
  "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya",
  "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Rize",
  "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli",
  "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale",
  "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
];

