/**
 * TAKVIM ENTEGRASYON MODÜLÜ - v2.0
 *
 * Akıllı Fallback Zinciri:
 * 1. Direkt App Yönlendirme (URL scheme)
 * 2. Varsayılan Takvim App (ICS auto-open)
 * 3. Web URL Yönlendirme (Google/Outlook)
 * 4. ICS Download (son çare)
 *
 * Platform Desteği:
 * - iOS (Safari, Chrome)
 * - macOS (Safari, Chrome)
 * - Android (Chrome, diğer)
 * - Windows (Edge, Chrome)
 */

import { DateUtils } from './date-utils';
import { StringUtils } from './string-utils';
import { APPOINTMENT_TYPE_NAMES, CALENDAR_CONFIG } from './calendar-config';

// Global scope'tan değişkenleri al (fonksiyon olarak - lazy evaluation)
const getConfig = () => (window as any).CONFIG || {};
const getModalUtils = () => (window as any).ModalUtils || { open: () => {}, close: () => {} };
const lastAppointmentData = () => (window as any).lastAppointmentData;

// ==================== PLATFORM TESPİTİ ====================

interface PlatformInfo {
    ios: boolean;
    android: boolean;
    macos: boolean;
    windows: boolean;
    safari: boolean;
    chrome: boolean;
    firefox: boolean;
    edge: boolean;
    mobile: boolean;
}

function detectPlatform(): PlatformInfo {
    const ua = navigator.userAgent;
    const platform = navigator.platform || '';

    return {
        ios: /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream,
        android: /Android/.test(ua),
        macos: /Mac/.test(platform) && !/iPhone|iPad|iPod/.test(ua),
        windows: /Win/.test(platform),
        safari: /Safari/.test(ua) && !/Chrome|CriOS/.test(ua),
        chrome: /Chrome|CriOS/.test(ua) && !/Edg/.test(ua),
        firefox: /Firefox|FxiOS/.test(ua),
        edge: /Edg/.test(ua),
        mobile: /iPhone|iPad|iPod|Android/.test(ua)
    };
}

// ==================== YARDIMCI FONKSİYONLAR ====================

/**
 * Randevu verilerini hazırla
 */
function prepareAppointmentData() {
    const appointment = lastAppointmentData();
    if (!appointment) return null;

    const CONFIG = getConfig();

    // İsim formatlaması
    appointment.staffName = StringUtils.toTitleCase(appointment.staffName || '');

    const date = new Date(appointment.date + 'T' + appointment.time);
    const duration = appointment.duration || CONFIG.APPOINTMENT_HOURS?.interval || 60;
    const endDate = new Date(date.getTime() + duration * 60000);

    const appointmentTypeName = (APPOINTMENT_TYPE_NAMES as any)[appointment.appointmentType] ||
        CONFIG.APPOINTMENT_TYPES?.find((t: any) => t.value === appointment.appointmentType)?.name || 'Genel';

    // v3.9.19d: İlgili atanmadıysa farklı başlık göster
    // Format: Rolex İzmir İstinyepark - Görüşme Randevusu
    const isStaffAssigned = appointment.staffName && appointment.staffName !== 'Atanmadı' && appointment.staffName !== 'Atanacak';
    let title: string;
    if (isStaffAssigned) {
        title = `İzmir İstinyepark Rolex - ${appointment.staffName} (${appointmentTypeName})`;
    } else {
        // v3.9.19d: Sadece tip adı (zaten "Randevusu" içeriyor)
        title = `Rolex İzmir İstinyepark - ${appointmentTypeName}`;
    }

    // v3.9: Telefon numarasına + ekle (yoksa)
    const formatPhone = (phone: unknown) => {
        if (!phone) return 'Belirtilmedi';
        const phoneStr = String(phone);
        const cleaned = phoneStr.replace(/\D/g, '');
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    };

    let details = 'RANDEVU BİLGİLERİ\n\n';
    // v3.9: İlgili atanmadıysa İlgili satırını gösterme
    if (isStaffAssigned) {
        details += `İlgili: ${appointment.staffName}\n`;
        details += `İletişim: ${formatPhone(appointment.staffPhone)}\n`;
        details += `E-posta: ${appointment.staffEmail || 'Belirtilmedi'}\n`;
    }
    details += `Tarih: ${new Date(appointment.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    details += `Saat: ${appointment.time}\n`;
    details += `Konu: ${appointmentTypeName}\n`;
    if (appointment.customerNote) {
        details += `Ek Bilgi: ${appointment.customerNote}\n`;
    }
    details += `\n${CALENDAR_CONFIG.ICS_REMINDERS.ON_TIME}`;

    return { appointment, date, endDate, title, details, appointmentTypeName };
}

/**
 * URL scheme ile app açmayı dene
 * @returns Promise<boolean> - Başarılı olursa true
 */
function tryOpenApp(scheme: string, timeout: number = 2000): Promise<boolean> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let resolved = false;

        // Visibility change listener
        const handleVisibilityChange = () => {
            if (document.hidden && !resolved) {
                resolved = true;
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                resolve(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Blur event (app opened)
        const handleBlur = () => {
            if (!resolved) {
                resolved = true;
                window.removeEventListener('blur', handleBlur);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                resolve(true);
            }
        };

        window.addEventListener('blur', handleBlur);

        // Try to open the app
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = scheme;
        document.body.appendChild(iframe);

        // Fallback: window.location
        setTimeout(() => {
            if (!resolved) {
                window.location.href = scheme;
            }
        }, 100);

        // Timeout - app didn't open
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                window.removeEventListener('blur', handleBlur);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                if (iframe.parentNode) {
                    document.body.removeChild(iframe);
                }
                resolve(false);
            }
        }, timeout);
    });
}

/**
 * ICS dosyası oluştur ve indir
 * NOT: MIME type 'text/calendar' olmalı, charset=utf-8 OLMAMALI (iOS uyumluluğu)
 * Ref: https://stackoverflow.com/questions/51231882
 */
function downloadICS(autoOpen: boolean = true): void {
    const data = prepareAppointmentData();
    if (!data) return;

    const icsContent = generateICS(data.date, data.endDate);
    const platform = detectPlatform();

    // iOS Safari - data URL ile direkt Calendar app aç (EN İYİ YÖNTEM)
    if (platform.ios && platform.safari) {
        const base64 = btoa(unescape(encodeURIComponent(icsContent)));
        const dataUrl = `data:text/calendar;base64,${base64}`;
        window.location.href = dataUrl;
        return;
    }

    // iOS Chrome - data URL dene (blob çalışmıyor)
    if (platform.ios && !platform.safari) {
        const base64 = btoa(unescape(encodeURIComponent(icsContent)));
        const dataUrl = `data:text/calendar;base64,${base64}`;

        // Yeni pencerede aç
        const newWindow = window.open(dataUrl, '_blank');
        if (!newWindow) {
            // Popup engellendi, kullanıcıya bilgi ver
            showToast('Dosya indirilemiyor. Popup izni verin veya Safari kullanın.', 'info');
        }
        return;
    }

    // macOS, Windows, Android - blob download
    // NOT: charset=utf-8 KULLANMA - iOS uyumsuzluğu
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'rolex-randevu.ics';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
        if (link.parentNode) {
            document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Toast bildirim göster
 */
function showToast(message: string, type: string = 'success'): void {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

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

// ==================== GOOGLE CALENDAR URL ====================

function getGoogleCalendarUrl(): string {
    const data = prepareAppointmentData();
    if (!data) return '';

    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', data.title);
    url.searchParams.set('dates', `${formatDate(data.date)}/${formatDate(data.endDate)}`);
    url.searchParams.set('details', data.details);
    url.searchParams.set('location', 'Rolex İzmir İstinyepark');
    url.searchParams.set('ctz', 'Europe/Istanbul');

    return url.toString();
}

// ==================== OUTLOOK CALENDAR URL ====================

function getOutlookCalendarUrl(): string {
    const data = prepareAppointmentData();
    if (!data) return '';

    const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    url.searchParams.set('path', '/calendar/action/compose');
    url.searchParams.set('rru', 'addevent');
    url.searchParams.set('subject', data.title);
    url.searchParams.set('startdt', data.date.toISOString());
    url.searchParams.set('enddt', data.endDate.toISOString());
    url.searchParams.set('body', data.details);
    url.searchParams.set('location', 'Rolex İzmir İstinyepark');

    return url.toString();
}

// ==================== ANA TAKVİM FONKSİYONLARI ====================

/**
 * Takvime ekleme modal'ını aç
 */
export function openCalendarModal() {
    getModalUtils().open('calendarModal');
}

/**
 * Apple Calendar - Akıllı Fallback
 * 1. calshow:// scheme (iOS/macOS Safari)
 * 2. ICS data URL (iOS Safari)
 * 3. ICS download (diğer)
 */
export async function addToCalendarApple() {
    const data = prepareAppointmentData();
    if (!data) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        getModalUtils().close('calendarModal');
        return;
    }

    const platform = detectPlatform();
    getModalUtils().close('calendarModal');

    // iOS + Safari: data URL ile direkt Calendar app
    if (platform.ios && platform.safari) {
        const icsContent = generateICS(data.date, data.endDate);
        const base64 = btoa(unescape(encodeURIComponent(icsContent)));
        const dataUrl = `data:text/calendar;base64,${base64}`;
        window.location.href = dataUrl;
        showToast('Apple Calendar açılıyor...', 'success');
        return;
    }

    // macOS + Safari: ICS indir (otomatik Calendar ile açılır)
    if (platform.macos && platform.safari) {
        downloadICS(true);
        showToast('Apple Calendar açılıyor...', 'success');
        return;
    }

    // iOS/macOS + Chrome veya diğer: ICS indir
    if (platform.ios || platform.macos) {
        downloadICS(true);
        showToast('Takvim dosyası indirildi. Açarak takvime ekleyin.', 'info');
        return;
    }

    // Diğer platformlar (Windows/Android): ICS indir
    downloadICS(true);
    showToast('Takvim dosyası indirildi', 'success');
}

/**
 * Google Calendar - Akıllı Fallback
 * 1. Android: intent:// scheme ile Google Calendar app
 * 2. Tüm platformlar: Web URL
 * 3. Fallback: ICS download
 */
export async function addToCalendarGoogle() {
    const data = prepareAppointmentData();
    if (!data) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        getModalUtils().close('calendarModal');
        return;
    }

    const platform = detectPlatform();
    getModalUtils().close('calendarModal');

    // Android: Google Calendar app deneyerek aç
    if (platform.android) {
        // Önce intent URL ile dene
        const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const intentUrl = `intent://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(data.title)}&dates=${formatDate(data.date)}/${formatDate(data.endDate)}&location=${encodeURIComponent('Rolex İzmir İstinyepark')}&details=${encodeURIComponent(data.details)}#Intent;scheme=https;package=com.google.android.calendar;end`;

        try {
            const opened = await tryOpenApp(intentUrl, 1500);
            if (opened) {
                showToast('Google Calendar açıldı', 'success');
                return;
            }
        } catch (e) {
            // Intent failed, try web URL
        }
    }

    // Web URL ile aç (tüm platformlar)
    const googleUrl = getGoogleCalendarUrl();
    const newWindow = window.open(googleUrl, '_blank');

    if (newWindow) {
        showToast('Google Calendar açılıyor...', 'success');
    } else {
        // Popup engellendi, ICS fallback
        downloadICS(true);
        showToast('Popup engellendi. Takvim dosyası indirildi.', 'info');
    }
}

/**
 * Outlook Calendar - Akıllı Fallback
 * 1. Windows: ms-outlook:// scheme ile Outlook app
 * 2. Tüm platformlar: Web URL
 * 3. Fallback: ICS download
 */
export async function addToCalendarOutlook() {
    const data = prepareAppointmentData();
    if (!data) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        getModalUtils().close('calendarModal');
        return;
    }

    const platform = detectPlatform();
    getModalUtils().close('calendarModal');

    // Windows: Outlook app deneyerek aç
    if (platform.windows) {
        // Önce ms-outlook scheme ile dene (Outlook masaüstü app)
        const formatDate = (d: Date) => d.toISOString();
        const outlookScheme = `ms-outlook://calendar/create?subject=${encodeURIComponent(data.title)}&startdt=${encodeURIComponent(formatDate(data.date))}&enddt=${encodeURIComponent(formatDate(data.endDate))}&location=${encodeURIComponent('Rolex İzmir İstinyepark')}&body=${encodeURIComponent(data.details)}`;

        try {
            const opened = await tryOpenApp(outlookScheme, 1500);
            if (opened) {
                showToast('Outlook açıldı', 'success');
                return;
            }
        } catch (e) {
            // Scheme failed, try web URL
        }
    }

    // Web URL ile aç (tüm platformlar)
    const outlookUrl = getOutlookCalendarUrl();
    const newWindow = window.open(outlookUrl, '_blank');

    if (newWindow) {
        showToast('Outlook Calendar açılıyor...', 'success');
    } else {
        // Popup engellendi, ICS fallback
        downloadICS(true);
        showToast('Popup engellendi. Takvim dosyası indirildi.', 'info');
    }
}

/**
 * Universal ICS Dosya İndirme
 * Herhangi bir takvim uygulaması için kullanılabilir
 */
export function downloadICSUniversal() {
    const data = prepareAppointmentData();
    if (!data) {
        alert('Randevu bilgileri bulunamadı. Lütfen tekrar deneyin.');
        getModalUtils().close('calendarModal');
        return;
    }

    getModalUtils().close('calendarModal');
    downloadICS(true);
    showToast('Takvim dosyası indirildi', 'success');
}

// ==================== ICS OLUŞTURMA ====================

/**
 * ICS (iCalendar) dosya içeriği oluştur
 * RFC 5545 standardına uygun format
 */
export function generateICS(startDate: Date, endDate: Date): string {
    const appointment = lastAppointmentData();
    const CONFIG = getConfig();

    let description = 'RANDEVU BİLGİLERİ\\n\\n';
    let summary = 'Rolex Randevu';
    let alarms: Array<{ trigger: string; description: string }> = [];

    if (appointment) {
        appointment.staffName = StringUtils.toTitleCase(appointment.staffName || '');

        const appointmentTypeName = (APPOINTMENT_TYPE_NAMES as any)[appointment.appointmentType] ||
            CONFIG.APPOINTMENT_TYPES?.find((t: any) => t.value === appointment.appointmentType)?.name || 'Genel';

        // v3.9.19d: İlgili atanmadıysa farklı başlık göster
        // Format: Rolex İzmir İstinyepark - Görüşme Randevusu
        const isStaffAssigned = appointment.staffName && appointment.staffName !== 'Atanmadı' && appointment.staffName !== 'Atanacak';
        if (isStaffAssigned) {
            summary = `İzmir İstinyepark Rolex - ${appointment.staffName} (${appointmentTypeName})`;
        } else {
            // v3.9.19d: Sadece tip adı (zaten "Randevusu" içeriyor)
            summary = `Rolex İzmir İstinyepark - ${appointmentTypeName}`;
        }

        const appointmentDate = new Date(appointment.date);
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = appointmentDate.toLocaleDateString('tr-TR', options);

        // v3.9: Telefon numarasına + ekle (yoksa)
        const formatPhone = (phone: unknown) => {
            if (!phone) return 'Belirtilmedi';
            const phoneStr = String(phone);
            const cleaned = phoneStr.replace(/\D/g, '');
            return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
        };

        // v3.9: İlgili atanmadıysa İlgili satırını gösterme
        if (isStaffAssigned) {
            description += `İlgili: ${appointment.staffName}\\n`;
            description += `İletişim: ${formatPhone(appointment.staffPhone)}\\n`;
            description += `E-posta: ${appointment.staffEmail || 'Belirtilmedi'}\\n`;
        }
        description += `Tarih: ${formattedDate}\\n`;
        description += `Saat: ${appointment.time}\\n`;
        description += `Konu: ${appointmentTypeName}\\n`;

        if (appointment.customerNote) {
            description += `Ek Bilgi: ${appointment.customerNote}\\n`;
        }

        description += `\\n${CALENDAR_CONFIG.ICS_REMINDERS.ON_TIME}`;

        // 3 ayrı alarm: 1 gün önce, sabah, 1 saat önce
        alarms = [
            { trigger: '-P1D', description: 'Yarın randevunuz var. Rolex İzmir İstinyepark.' },
            { trigger: '-PT1H', description: '1 saat sonra randevunuz var. Lütfen zamanında gelin.' }
        ];

        const appointmentHour = parseInt((appointment.time || '12:00').split(':')[0]);
        const hoursUntilMorning = appointmentHour - 10;
        if (hoursUntilMorning > 0) {
            alarms.splice(1, 0, {
                trigger: `-PT${hoursUntilMorning}H`,
                description: 'Bugün randevunuz var. Rolex İzmir İstinyepark.'
            });
        }
    }

    const icsContent = [
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

    // Alarmlar ekle
    alarms.forEach((alarm) => {
        icsContent.push(
            'BEGIN:VALARM',
            `TRIGGER:${alarm.trigger}`,
            'ACTION:DISPLAY',
            `DESCRIPTION:${alarm.description}`,
            'END:VALARM'
        );
    });

    icsContent.push(
        'END:VEVENT',
        'END:VCALENDAR'
    );

    return icsContent.join('\r\n');
}
