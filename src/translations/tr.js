const tr = {
  welcome: {
    hello_user: "Merhaba, {{name}}",
    thank_you: "Share Pairs'a katıldığınız için teşekkür ederiz.",
    intro_1: "Bu uygulama, benzer bir kayıp yaşamış kişilerle olumlu sosyal etkileşimler kurmanızı sağlamak için tasarlanmıştır. Lütfen her gün en az bir kez giriş yaparak Share Pair'inizle sohbet edin.",
    intro_2: "Amacımız, kaybınıza empati gösterebilecek birini bulmanıza yardımcı olmaktır. Hikayenizi paylaşmaktan ve başkalarının hikayelerini dinlemekten rahatlık bulmanızı umuyoruz. Yas sürecinizde size destek olmak için buradayız.",
    left_panel: "Sol tarafta, aktif sohbetlerinizi ve kişi listenizi bulabilirsiniz. Her iki taraf da daraltılabilir veya genişletilebilir.",
    center_panel: "Orta kısımda ana sohbet penceresini bulacaksınız.",
    right_panel: "Sağ tarafta, Share Pair'iniz hakkında bilgiler ve sohbete başlamanıza yardımcı olacak bazı ipuçları bulacaksınız."
  },
  support: {
    contact_message:
      "Uygulama veya eşleşmenizle sohbet etme konusunda herhangi bir sorun yaşarsanız, Kişiler panelinizden Çalışma Desteği ile iletişime geçin."
  },
  auth: {
    login_title: "Giriş Yap",
    email_placeholder: "E-posta Adresiniz",
    password_placeholder: "Şifreniz",
    login_button: "Giriş Yap",
    logging_in: "Giriş yapılıyor...",
    forgot_password: "Şifrenizi mi unuttunuz?",
    join_prompt: "Üye değil misiniz? ",
    join_now: "Hemen katılın",
    error_unverified: "Lütfen giriş yapmadan önce e-posta adresinizi doğrulayın.",
    error_invalid_credentials: "Geçersiz e-posta veya şifre.",
    error_generic: "Giriş başarısız. Lütfen tekrar deneyin."
  },
  forgot: {
    instructions: "Lütfen hesabınıza bağlı e-posta adresini girin",
    placeholder_email: "E-posta",
    send_button: "Şifre Sıfırlama Gönder",
    sending: "Gönderiliyor...",
    back_to_login: "Giriş Ekranına Dön",
    status_sent: "Şifre sıfırlama e-postası gönderildi!",
    error_not_found: "Bu e-posta ile kayıtlı bir hesap bulunamadı.",
    error_generic: "Sıfırlama e-postası gönderilemedi."
  },
  register: {
    sections: {
      account_info: "Hesap Bilgileri",
      personal_info: "Kişisel Bilgiler",
      your_story: "Hikayeniz"
    },
    labels: {
      email: "E-posta",
      password: "Şifre",
      confirm_password: "Şifreyi Onaylayın",
      display_name: "Görünen Ad",
      country: "Ülke",
      home_state: "İkamet Ettiğiniz Eyalet",
      birth_date: "Doğum Tarihi",
      race: "Sizi en iyi tanımlayan ırk nedir?",
      ethnicity: "Sizi en iyi tanımlayan etnik köken nedir?",
      bio_sex: "Biyolojik Cinsiyet",
      education: "Eğitim Seviyesi",
      household: "Lütfen yaşam durumunuzu açıklayın.",
      hobbies: "Hobileriniz nelerdir?",
      loss_date: "Kayıp yaşadığınız tarih nedir?",
      kinship: "Kaybedilen kişi ile ilişkiniz nedir?",
      cause: "Ölüm Nedeni",
      deceased_age: "Kaç yaşındaydı?",
      loss_experience: "Kayıp deneyiminizi açıklayın",
      consent_label: "Bu kutuyu işaretleyerek yukarıdaki bilgileri paylaşmayı ve diğer kullanıcıların bu bilgileri görmesini kabul ediyorum."
    },
    buttons: {
      submit: "Gönder",
      submitting: "Gönderiliyor...",
      back_to_login: "Girişe Dön",
      return_home: "Ana Sayfaya Dön"
    },
    errors: {
      missing_email: "E-posta adresi eksik.",
      missing_password: "Şifre gerekli.",
      password_mismatch: "Şifreler uyuşmuyor.",
      missing_residence: "İkamet edilen eyalet gerekli.",
      missing_birthdate: "Doğum tarihi gerekli.",
      must_be_18: "Kayıt olmak için en az 18 yaşında olmalısınız.",
      missing_race: "Irk seçimi gerekli.",
      missing_ethnicity: "Etnik köken seçimi gerekli.",
      missing_bio_sex: "Biyolojik cinsiyet gerekli.",
      missing_education: "Eğitim seviyesi gerekli.",
      missing_household: "Yaşam durumu gerekli.",
      missing_loss_date: "Kayıp tarihi gerekli.",
      missing_kinship: "Kaybedilen kişi ile ilişki gerekli.",
      missing_cause: "Ölüm nedeni gerekli.",
      missing_deceased_age: "Kaybedilen kişinin yaşı gerekli.",
      missing_loss_experience: "Kayıp deneyimi gerekli.",
      missing_consent: "Bilgilerinizi paylaşmak için onay vermelisiniz.",
      email_in_use: "Bu e-posta zaten kullanımda.",
      generic: "Kayıt başarısız oldu. Lütfen tekrar deneyin.",
      success: "Doğrulama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin ve doğruladıktan sonra giriş yapın."
    },

  },
  left_panel: {
    contacts: "Kişiler",
    conversations: "Sohbetler"
  },
  right_panel: {
    info: "Bilgi",
    prompts: "Sorular"
  },
  info_panel: {
    lives_in: "Yaşadığı yer",
    unknown: "Bilinmiyor",
    story_title: "Eşinizin Hikayesi:",
    no_story: "Henüz bir hikaye paylaşmadı.",
    non_match: "Bu kişi sizin kişilerinizden biri. Aşağıdan bir konuşma başlatın."
  },
  convo_btn: {
    request: "Konuşma Talebi",
    pending: "Talep Beklemede",
    open: "Konuşma Açık",
    reopen: "Konuşmayı Aç",
    open_prompt: "{name} ile konuşmayı açmak ister misiniz?",
    request_sent: "{name} kişisine konuşma talebi gönderildi.",
    error: "{name} kişisine talep gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
  },
  chatroom: {
    new_request: '{name}, bir konuşma başlatmak istedi. Kabul etmek için tıklayın.',
    new_match: '🎉 Eşleştirildiniz! Yeni eşinizi görmek için kişiler panelini görüntüleyin.',
    request_accepted: '{name} konuşmayı kabul etti. Şimdi açmak ister misiniz?',
    already_active: 'Bu konuşma zaten açık.',
    not_accepted: 'Bu konuşma henüz her iki kullanıcı tarafından kabul edilmedi.',
  },
  distress: {
    title: "Sıkıntı Termometresi",
    instructions: "Eşleşmenizle konuşmaya başlamadan veya devam etmeden önce, şu anki sıkıntı düzeyinizi en iyi tanımlayan sayıya tıklayın.",
    levels: {
      100: "Dayanılmaz derecede üzgünüm, işlev göremiyorum",
      90: "Son derece sıkıntılı",
      80: "Çok sıkıntılı, odaklanmak zor",
      70: "Oldukça sıkıntılı, işlevselliği etkiliyor",
      60: "Orta ile güçlü arası sıkıntı",
      50: "Orta düzeyde sıkıntı, rahatsız ama işlevsel",
      40: "Hafif ile orta arası sıkıntı",
      30: "Hafif sıkıntı ama işlev görebiliyorum",
      20: "Biraz sıkıntılı, üzgün veya endişeli",
      10: "Hiç sıkıntı yok, dikkatli ve odaklanmış",
      0: "Huzurlu, hiçbir sıkıntı yok, tamamen sakin"
    }
  },
  messageWindow: {
    unmatchedTitle: "Hoş geldiniz, {name}.",
    unmatchedLine1: "Benzer bir deneyimi paylaşan biriyle sizi eşleştirmeye çalışıyoruz.",
    unmatchedLine2: "Eşleştiğinizde, Share Pair’iniz Kişiler panelinde görünecek ve bir konuşma başlatabileceksiniz.",
    noConversationTitle: "Bir konuşma seçin",
    noConversationLine: "Mesajlarınız burada görünecek.",
    loadMore: "Daha fazla yükle",
    noMessages: "Henüz mesaj yok. Konuşmayı başlatın!",
    inputPlaceholder: "Bir mesaj yazın",
    send: "Gönder"
  }










};

export default tr;
