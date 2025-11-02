/**
 * TAKVIM ENTEGRASYON MODÜLÜ
 *
 * Bu modül, randevu başarıyla oluşturulduktan sonra kullanıcının
 * randevuyu kendi takvimine eklemesi için gerekli fonksiyonları içerir.
 *
 * Lazy Loading ile yüklenir - sadece "Takvime Ekle" butonuna tıklandığında
 * dinamik olarak import edilir. Bu sayede ana app.js dosyasının boyutu küçülür
 * ve ilk yükleme hızlanır.
 *
 * Dependencies (Global Scope):
 * - CONFIG (app.js)
 * - DateUtils (date-utils.js)
 * - ModalUtils (app.js)
 * - lastAppointmentData (app.js)
 */

// DateUtils import et
import { DateUtils } from './date-utils.js';

// Global scope'tan değişkenleri al
const CONFIG = window.CONFIG;
const ModalUtils = window.ModalUtils;
const lastAppointmentData = () => window.lastAppointmentData;

// ==================== TAKVİME EKLEME FONKSİYONLARI ====================

/**
 * Takvime ekleme modal'ını aç
 * Kullanıcı takvim seçeneğini seçebilir (Google, Apple, Outlook, ICS)
 */
export function openCalendarModal() {
    ModalUtils.open('calendarModal');
}

/**
 * Apple Calendar için ICS indirme (Safari detection ile)
 * Safari + Apple cihazlarda data URL ile direkt Calendar app'i açar
 * Diğer tarayıcılarda Blob download yapar
 */
export function addToCalendarApple() {
    const appointment = lastAppointmentData();
    if (!appointment) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        ModalUtils.close('calendarModal');
        return;
    }

    const platform = detectPlatform();
    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);
    const icsContent = generateICS(date, endDate);

    // Safari + Apple cihazında data URL ile Calendar app'i direkt aç
    if ((platform.ios || platform.macos) && platform.safari) {
        const base64 = btoa(unescape(encodeURIComponent(icsContent)));
        const dataUrl = `data:text/calendar;base64,${base64}`;
        window.location.href = dataUrl;
        ModalUtils.close('calendarModal');
        showToast('Apple Calendar açılıyor...', 'success');
    } else {
        // Diğer tarayıcılarda Blob download (dosya adı garantili)
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'rolex-randevu.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        ModalUtils.close('calendarModal');
        showToast('ICS dosyası indirildi', 'success');
    }
}

/**
 * Google Calendar web URL'ini oluştur ve yeni sekmede aç
 * Mobil cihazlarda Google Calendar app'i kuruluysa onu açar
 */
export function addToCalendarGoogle() {
    const appointment = lastAppointmentData();
    if (!appointment) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        return;
    }

    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);

    const formatDateForGoogle = (d) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startTime = formatDateForGoogle(date);
    const endTime = formatDateForGoogle(endDate);

    // Detaylı randevu bilgileri oluştur
    let details = 'RANDEVU BİLGİLERİ\n\n';
    details += `Müşteri: ${appointment.customerName}\n`;
    details += `İletişim: ${appointment.customerPhone}\n`;
    if (appointment.customerEmail) {
        details += `E-posta: ${appointment.customerEmail}\n`;
    }

    // Tarih formatla
    const appointmentDate = new Date(appointment.date);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = appointmentDate.toLocaleDateString('tr-TR', options);

    details += `Tarih: ${formattedDate}\n`;
    details += `Saat: ${appointment.time}\n`;

    // Randevu türü
    const appointmentTypeName = CONFIG.APPOINTMENT_TYPES?.find(t => t.value === appointment.appointmentType)?.name || 'Genel';
    details += `Konu: ${appointmentTypeName}\n`;
    details += `İlgili: ${appointment.staffName}\n`;

    if (appointment.customerNote) {
        details += `Ek Bilgi: ${appointment.customerNote}\n`;
    }

    // Google Calendar web URL (mobil cihazlarda app'i açar eğer kuruluysa)
    const eventTitle = `${appointment.customerName} - ${appointment.staffName}`;
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}&location=${encodeURIComponent('Rolex İzmir İstinyepark')}`;

    window.open(calendarUrl, '_blank');
    ModalUtils.close('calendarModal');
    showToast('Google Calendar açıldı', 'success');
}

/**
 * Outlook Calendar web URL'ini oluştur ve yeni sekmede aç
 */
export function addToCalendarOutlook() {
    const appointment = lastAppointmentData();
    if (!appointment) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        return;
    }

    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);

    // Detaylı randevu bilgileri oluştur
    let details = 'RANDEVU BİLGİLERİ<br><br>';
    details += `Müşteri: ${appointment.customerName}<br>`;
    details += `İletişim: ${appointment.customerPhone}<br>`;
    if (appointment.customerEmail) {
        details += `E-posta: ${appointment.customerEmail}<br>`;
    }
    details += `Tarih: ${appointment.date}<br>`;
    details += `Saat: ${appointment.time}<br>`;

    const appointmentTypeName = CONFIG.APPOINTMENT_TYPES?.find(t => t.value === appointment.appointmentType)?.name || 'Genel';
    details += `Konu: ${appointmentTypeName}<br>`;
    details += `İlgili: ${appointment.staffName}<br>`;

    if (appointment.customerNote) {
        details += `Ek Bilgi: ${appointment.customerNote}<br>`;
    }

    const eventTitle = `${appointment.customerName} - ${appointment.staffName}`;

    const outlookUrl = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    outlookUrl.searchParams.append('path', '/calendar/action/compose');
    outlookUrl.searchParams.append('rru', 'addevent');
    outlookUrl.searchParams.append('startdt', date.toISOString());
    outlookUrl.searchParams.append('enddt', endDate.toISOString());
    outlookUrl.searchParams.append('subject', eventTitle);
    outlookUrl.searchParams.append('location', 'Rolex İzmir İstinyepark');
    outlookUrl.searchParams.append('body', details);

    window.open(outlookUrl.toString(), '_blank');
    ModalUtils.close('calendarModal');
    showToast('Outlook Calendar açıldı', 'success');
}

/**
 * Universal ICS Dosya İndirme
 * Herhangi bir takvim uygulaması için kullanılabilir (.ics dosyası)
 */
export function downloadICSUniversal() {
    const appointment = lastAppointmentData();
    if (!appointment) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        ModalUtils.close('calendarModal');
        return;
    }

    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);
    const icsContent = generateICS(date, endDate);

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rolex-randevu.ics';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        ModalUtils.close('calendarModal');
        showToast('Takvim dosyası (.ics) indirildi', 'success');
    }, 100);
}

/**
 * ICS (iCalendar) dosya içeriği oluştur
 * RFC 5545 standardına uygun format
 */
export function generateICS(startDate, endDate) {
    const appointment = lastAppointmentData();

    // Detaylı randevu bilgileri oluştur
    let description = 'RANDEVU BİLGİLERİ\\n\\n';
    let summary = 'Rolex Randevu';
    let alarmTrigger = '-PT30M'; // Default

    if (appointment) {
        // Müşteri takvimi için özel isimler
        const customerAppointmentTypeNames = {
            'delivery': 'Saat Takdimi',
            'consultation': 'Genel Görüşme'
        };

        // Müşteri takvimi için randevu türü adı
        const appointmentTypeName = customerAppointmentTypeNames[appointment.appointmentType] ||
            CONFIG.APPOINTMENT_TYPES?.find(t => t.value === appointment.appointmentType)?.name || 'Genel';

        // Müşteri takvimi için başlık: İzmir İstinyepark Rolex - İlgili (Görüşme Türü)
        summary = `İzmir İstinyepark Rolex - ${appointment.staffName} (${appointmentTypeName})`;

        // Tarih objesi oluştur
        const appointmentDate = new Date(appointment.date);

        // Randevu günü sabah 10:00 Türkiye saati için alarm hesapla
        // Türkiye UTC+3 olduğu için 10:00 local = 07:00 UTC
        const year = appointmentDate.getFullYear();
        const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
        const day = String(appointmentDate.getDate()).padStart(2, '0');
        alarmTrigger = `VALUE=DATE-TIME:${year}${month}${day}T070000Z`;

        // Yeni sıralama: İlgili, İletişim, E-posta, Tarih, Saat, Konu, Ek Bilgi
        description += `İlgili: ${appointment.staffName}\\n`;
        description += `İletişim: ${appointment.staffPhone || 'Belirtilmedi'}\\n`;
        description += `E-posta: ${appointment.staffEmail || 'Belirtilmedi'}\\n`;

        // Tarih formatla
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = appointmentDate.toLocaleDateString('tr-TR', options);

        description += `Tarih: ${formattedDate}\\n`;
        description += `Saat: ${appointment.time}\\n`;
        description += `Konu: ${appointmentTypeName}\\n`;

        if (appointment.customerNote) {
            description += `Ek Bilgi: ${appointment.customerNote}\\n`;
        }

        description += `\\nRandevunuza zamanında gelmenizi rica ederiz.\\nLütfen kimlik belgenizi yanınızda bulundurun.`;
    } else {
        description = 'Randevunuz onaylandı';
    }

    // ICS içeriği - VTIMEZONE tanımı ile
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Rolex İzmir İstinyepark//Randevu Sistemi//TR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Istanbul',
        'BEGIN:STANDARD',
        'DTSTART:19701025T040000',
        'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
        'TZOFFSETFROM:+0300',
        'TZOFFSETTO:+0300',
        'TZNAME:+03',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        `UID:rolex-${Date.now()}@istinyepark.com`,
        `DTSTAMP:${DateUtils.toICSDate(new Date())}Z`,
        `DTSTART;TZID=Europe/Istanbul:${DateUtils.toICSDate(startDate)}`,
        `DTEND;TZID=Europe/Istanbul:${DateUtils.toICSDate(endDate)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        'LOCATION:Rolex İzmir İstinyepark',
        'STATUS:CONFIRMED',
        'ORGANIZER;CN=Rolex İzmir İstinyepark:mailto:istinyeparkrolex35@gmail.com',
        'BEGIN:VALARM',
        `TRIGGER;${alarmTrigger}`,
        'ACTION:DISPLAY',
        'DESCRIPTION:Randevunuza zamanında gelmenizi rica ederiz. Lütfen kimlik belgenizi yanınızda bulundurun.',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
}

// ==================== YARDIMCI FONKSİYONLAR ====================

/**
 * Gelişmiş Platform ve Tarayıcı Tespiti
 * iOS, Android, macOS, Windows, Safari, Chrome, Firefox, Edge tespiti
 */
function detectPlatform() {
    const ua = navigator.userAgent;
    const platform = navigator.platform || '';

    const detection = {
        // Operating System
        ios: /iPhone|iPad|iPod/.test(ua) && !window.MSStream,
        android: /Android/.test(ua),
        macos: /Mac/.test(platform) && !/iPhone|iPad|iPod/.test(ua),
        windows: /Win/.test(platform),

        // Browser
        safari: /Safari/.test(ua) && !/Chrome|CriOS/.test(ua),
        chrome: /Chrome|CriOS/.test(ua),
        firefox: /Firefox|FxiOS/.test(ua),
        edge: /Edg/.test(ua),

        // Mobile
        mobile: /iPhone|iPad|iPod|Android/.test(ua)
    };

    return detection;
}

/**
 * Toast bildirim göster
 * Kullanıcıya kısa süreli bilgi mesajı gösterir (3 saniye)
 */
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Güvenli DOM manipülasyonu - XSS koruması
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

/**
 * iOS Rehber Modalı
 * iOS kullanıcılarına ICS dosyasını nasıl açacaklarını gösterir
 */
function showIOSGuide() {
    ModalUtils.open('guideModal');
}

/**
 * Apple cihazlar için ICS İndirme (fallback)
 * detectPlatform sonucuna göre iOS veya macOS için özel işlem
 */
function downloadICSForApple(platformType) {
    const appointment = lastAppointmentData();
    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);

    const icsContent = generateICS(date, endDate);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'rolex-randevu.ics';
    link.style.display = 'none';

    if (platformType === 'ios') {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
    }

    document.body.appendChild(link);
    link.click();

    if (platformType === 'ios') {
        setTimeout(() => showIOSGuide(), 1500);
    } else {
        showToast('ICS dosyası indirildi', 'success');
    }

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}
