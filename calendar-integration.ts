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

// Shared utilities import et
import { DateUtils } from './date-utils';
import { StringUtils } from './string-utils';
import { APPOINTMENT_TYPE_NAMES } from './calendar-config';

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
 * Apple Calendar için akıllı yönlendirme
 * Platform ve tarayıcıya göre en iyi yöntem seçilir
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

    // iOS cihazlar için
    if (platform.ios) {
        if (platform.safari) {
            // iOS Safari: data URL ile direkt Calendar app aç
            const base64 = btoa(unescape(encodeURIComponent(icsContent)));
            const dataUrl = `data:text/calendar;base64,${base64}`;
            window.location.href = dataUrl;
            ModalUtils.close('calendarModal');
            showToast('Apple Calendar açılıyor...', 'success');
        } else {
            // iOS Chrome/diğer: ICS indir, kullanıcı kendisi açacak
            downloadICSFile(icsContent, 'rolex-randevu.ics');
            ModalUtils.close('calendarModal');
            showToast('İndirilen dosyayı açarak takvime ekleyebilirsiniz', 'info');
        }
    }
    // macOS cihazlar için
    else if (platform.macos) {
        // macOS tüm tarayıcılar: ICS indir, otomatik Apple Calendar açılır
        downloadICSFile(icsContent, 'rolex-randevu.ics');
        ModalUtils.close('calendarModal');
        showToast('Apple Calendar açılıyor...', 'success');
    }
    // Diğer platformlar
    else {
        downloadICSFile(icsContent, 'rolex-randevu.ics');
        ModalUtils.close('calendarModal');
        showToast('ICS dosyası indirildi', 'success');
    }
}

/**
 * Google Calendar için akıllı yönlendirme
 * Android'de app, diğer platformlarda web açılır
 */
export function addToCalendarGoogle() {
    const appointment = lastAppointmentData();
    if (!appointment) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        return;
    }

    // İsim formatlaması
    appointment.staffName = StringUtils.toTitleCase(appointment.staffName);

    const platform = detectPlatform();
    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);

    const formatDateForGoogle = (d) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startTime = formatDateForGoogle(date);
    const endTime = formatDateForGoogle(endDate);

    // Müşteri takvimi için başlık (shared config kullan)
    const appointmentTypeName = APPOINTMENT_TYPE_NAMES[appointment.appointmentType] ||
        CONFIG.APPOINTMENT_TYPES?.find(t => t.value === appointment.appointmentType)?.name || 'Genel';

    const eventTitle = `İzmir İstinyepark Rolex - ${appointment.staffName} (${appointmentTypeName})`;

    // Detaylı randevu bilgileri
    let details = 'RANDEVU BİLGİLERİ\n\n';
    details += `İlgili: ${appointment.staffName}\n`;
    details += `İletişim: ${appointment.staffPhone || 'Belirtilmedi'}\n`;
    details += `E-posta: ${appointment.staffEmail || 'Belirtilmedi'}\n`;
    details += `Tarih: ${new Date(appointment.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    details += `Saat: ${appointment.time}\n`;
    details += `Konu: ${appointmentTypeName}\n`;
    if (appointment.customerNote) {
        details += `Ek Bilgi: ${appointment.customerNote}\n`;
    }
    details += '\nRandevunuza zamanında gelmenizi rica ederiz.\nLütfen kimlik belgenizi yanınızda bulundurun.';

    // Google Calendar için ICS dosyası kullan (alarmlar doğru çalışır)
    // URL parametreleri ile alarm kontrolü sınırlı olduğu için ICS standart çözüm
    const icsContent = generateICS(date, endDate);
    downloadICSFile(icsContent, 'rolex-randevu.ics');
    ModalUtils.close('calendarModal');
    showToast('Takvim dosyası indirildi. Google Calendar ile açın.', 'success');
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

    // İsim formatlaması
    appointment.staffName = StringUtils.toTitleCase(appointment.staffName);

    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);

    // Müşteri takvimi için başlık (shared config kullan)
    const appointmentTypeName = APPOINTMENT_TYPE_NAMES[appointment.appointmentType] ||
        CONFIG.APPOINTMENT_TYPES?.find(t => t.value === appointment.appointmentType)?.name || 'Genel';

    const eventTitle = `İzmir İstinyepark Rolex - ${appointment.staffName} (${appointmentTypeName})`;

    // Detaylı randevu bilgileri
    let details = 'RANDEVU BİLGİLERİ<br><br>';
    details += `İlgili: ${appointment.staffName}<br>`;
    details += `İletişim: ${appointment.staffPhone || 'Belirtilmedi'}<br>`;
    details += `E-posta: ${appointment.staffEmail || 'Belirtilmedi'}<br>`;
    details += `Tarih: ${new Date(appointment.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}<br>`;
    details += `Saat: ${appointment.time}<br>`;
    details += `Konu: ${appointmentTypeName}<br>`;
    if (appointment.customerNote) {
        details += `Ek Bilgi: ${appointment.customerNote}<br>`;
    }
    details += '<br>Randevunuza zamanında gelmenizi rica ederiz.<br>Lütfen kimlik belgenizi yanınızda bulundurun.';

    // Outlook için ICS dosyası kullan (alarmlar doğru çalışır)
    // Web URL parametreleri ile alarm kontrolü sınırlı olduğu için ICS standart çözüm
    const icsContent = generateICS(date, endDate);
    downloadICSFile(icsContent, 'rolex-randevu.ics');
    ModalUtils.close('calendarModal');
    showToast('Takvim dosyası indirildi. Outlook Calendar ile açın.', 'success');
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

    downloadICSFile(icsContent, 'rolex-randevu.ics');
    ModalUtils.close('calendarModal');
    showToast('Takvim dosyası (.ics) indirildi', 'success');
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
    const alarmTrigger = '-PT30M'; // Default
    let alarms = null; // Müşteri takvimi için birden fazla alarm

    if (appointment) {
        // İsim formatlaması
        appointment.staffName = StringUtils.toTitleCase(appointment.staffName);

        // Müşteri takvimi için randevu türü adı (shared config kullan)
        const appointmentTypeName = APPOINTMENT_TYPE_NAMES[appointment.appointmentType] ||
            CONFIG.APPOINTMENT_TYPES?.find(t => t.value === appointment.appointmentType)?.name || 'Genel';

        // Müşteri takvimi için başlık: İzmir İstinyepark Rolex - İlgili (Görüşme Türü)
        summary = `İzmir İstinyepark Rolex - ${appointment.staffName} (${appointmentTypeName})`;

        // Tarih objesi oluştur
        const appointmentDate = new Date(appointment.date);

        // 3 ayrı alarm: 1 gün önce, randevu günü sabah 10:00, 1 saat önce
        alarms = [
            { trigger: '-P1D', description: 'Yarın randevunuz var. Lütfen kimlik belgenizi yanınızda bulundurun.' },
            { trigger: '-PT1H', description: '1 saat sonra randevunuz var. Lütfen zamanında gelin.' }
        ];

        // Randevu günü sabah 10:00 için dinamik hesaplama
        // Örnek: Randevu 13:00 ise, 3 saat önce (10:00'da alarm)
        const appointmentHour = parseInt(appointment.time.split(':')[0]);
        const hoursUntilMorning = appointmentHour - 10; // 13 - 10 = 3 saat önce

        // Sadece randevu saat 10:00'dan sonraysa sabah alarmı ekle
        if (hoursUntilMorning > 0) {
            alarms.splice(1, 0, {
                trigger: `-PT${hoursUntilMorning}H`,
                description: 'Bugün randevunuz var. Rolex İzmir İstinyepark.'
            });
        }

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
        'ORGANIZER;CN=Rolex İzmir İstinyepark:mailto:istinyeparkrolex35@gmail.com'
    ];

    // Alarm dizisi varsa (müşteri takvimi), her biri için VALARM bloğu ekle
    if (alarms && alarms.length > 0) {
        alarms.forEach(alarm => {
            // TRIGGER formatı: VALUE=DATE-TIME için ; kullan, relative için : kullan
            const triggerLine = alarm.trigger.startsWith('VALUE=')
                ? `TRIGGER;${alarm.trigger}`
                : `TRIGGER:${alarm.trigger}`;

            icsContent.push(
                'BEGIN:VALARM',
                triggerLine,
                'ACTION:DISPLAY',
                `DESCRIPTION:${alarm.description}`,
                'END:VALARM'
            );
        });
    } else {
        // Alarm dizisi yoksa (eski format), tek alarm ekle
        const triggerLine = alarmTrigger.startsWith('VALUE=')
            ? `TRIGGER;${alarmTrigger}`
            : `TRIGGER:${alarmTrigger}`;

        icsContent.push(
            'BEGIN:VALARM',
            triggerLine,
            'ACTION:DISPLAY',
            'DESCRIPTION:Randevunuza zamanında gelmenizi rica ederiz. Lütfen kimlik belgenizi yanınızda bulundurun.',
            'END:VALARM'
        );
    }

    icsContent.push(
        'END:VEVENT',
        'END:VCALENDAR'
    );

    return icsContent.join('\r\n');
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
 * ICS dosyasını indir
 * Blob kullanarak güvenli download
 */
function downloadICSFile(icsContent, filename) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Toast bildirim göster
 * Kullanıcıya kısa süreli bilgi mesajı gösterir (3 saniye)
 */
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Stil ekle
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
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
