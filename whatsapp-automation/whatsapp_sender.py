#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WhatsApp Desktop Otomatik Mesaj Gönderici
Rolex İzmir İstinyepark - Randevu Hatırlatma Sistemi

Kullanım:
1. WhatsApp Desktop uygulamasını açın ve giriş yapın
2. Bu script'i çalıştırın
3. Tarih seçin
4. Script otomatik olarak mesajları gönderecek
"""

import sys
import time
import json
import subprocess
import urllib.request
import urllib.parse
from datetime import datetime, date

try:
    import pyautogui
except ImportError:
    print("❌ PyAutoGUI yüklü değil!")
    print("Kurulum: pip3 install pyautogui")
    sys.exit(1)

# ==================== CONFIGURATION ====================
API_URL = "https://script.google.com/macros/s/AKfycbwmowzsBLrAOjn-HVtw_LSLf-Gn0jrWdaQMrxaJeulqnhJCQduyyeSvctsWPAXxSAuo/exec"
API_KEY = "RLX_VewvTd8IJ9fIc95IC0B2nlQW1OEwhzg3"  # Admin API Key

WAIT_TIME_BETWEEN_MESSAGES = 12  # Her mesaj arası bekleme süresi (saniye)
WAIT_TIME_AFTER_SEARCH = 3       # Arama sonrası bekleme
WAIT_TIME_AFTER_OPEN_CHAT = 2    # Chat açıldıktan sonra bekleme

# ==================== HELPER FUNCTIONS ====================

def show_notification(title, message):
    """macOS bildirim göster"""
    try:
        subprocess.run([
            'osascript', '-e',
            f'display notification "{message}" with title "{title}"'
        ])
    except:
        pass

def activate_whatsapp():
    """WhatsApp Desktop'ı ön plana getir"""
    try:
        print("📱 WhatsApp Desktop açılıyor...")
        subprocess.run(['open', '-a', 'WhatsApp'])
        time.sleep(3)  # WhatsApp'ın açılması için bekle

        # WhatsApp'ı focus yap
        subprocess.run([
            'osascript', '-e',
            'tell application "WhatsApp" to activate'
        ])
        time.sleep(1)
        return True
    except Exception as e:
        print(f"❌ WhatsApp Desktop açılamadı: {e}")
        show_notification("Hata", "WhatsApp Desktop açılamadı")
        return False

def fetch_reminders(target_date):
    """Backend'den belirli tarihteki randevuları çek"""
    try:
        print(f"🔄 {target_date} tarihli randevular getiriliyor...")

        # API Key kontrolü
        if not API_KEY:
            print("❌ API Key bulunamadı!")
            print("whatsapp_sender.py dosyasındaki API_KEY değişkenine admin panelden aldığınız key'i yapıştırın.")
            return []

        # API parametreleri
        params = {
            'action': 'getTodayWhatsAppReminders',
            'date': target_date,
            'apiKey': API_KEY
        }

        # URL oluştur
        url = f"{API_URL}?{urllib.parse.urlencode(params)}"

        # Request at
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))

        if data.get('success'):
            reminders = data.get('data', [])
            print(f"✅ {len(reminders)} randevu bulundu")
            return reminders
        else:
            error = data.get('error', 'Bilinmeyen hata')
            print(f"❌ API hatası: {error}")
            return []

    except Exception as e:
        print(f"❌ Backend bağlantı hatası: {e}")
        return []

def send_whatsapp_message(phone, customer_name, message):
    """WhatsApp Desktop ile mesaj gönder"""
    try:
        # 1. Yeni chat aç (Cmd+N)
        print(f"  → Yeni chat açılıyor: {customer_name}")
        pyautogui.hotkey('command', 'n')
        time.sleep(WAIT_TIME_AFTER_OPEN_CHAT)

        # 2. Telefon numarasını yaz
        # Türkiye için: +90XXXXXXXXXX formatına çevir
        clean_phone = ''.join(filter(str.isdigit, phone))
        if clean_phone.startswith('0'):
            clean_phone = '90' + clean_phone[1:]
        elif not clean_phone.startswith('90'):
            clean_phone = '90' + clean_phone

        formatted_phone = f"+{clean_phone}"
        print(f"  → Telefon aranıyor: {formatted_phone}")
        pyautogui.write(formatted_phone, interval=0.1)
        time.sleep(WAIT_TIME_AFTER_SEARCH)

        # 3. Enter - İlk kişiyi seç
        pyautogui.press('enter')
        time.sleep(WAIT_TIME_AFTER_OPEN_CHAT)

        # 4. Mesajı yaz
        print(f"  → Mesaj yazılıyor...")

        # Türkçe karakter desteği için clipboard kullan
        # Mesaj backend'den geliyor, URL decode edilmiş hali kullanılıyor
        subprocess.run(['osascript', '-e', f'set the clipboard to "{message}"'])
        time.sleep(0.5)
        pyautogui.hotkey('command', 'v')
        time.sleep(1)

        # 5. Enter - Mesajı gönder
        pyautogui.press('enter')
        print(f"  ✅ Mesaj gönderildi: {customer_name}")

        return True

    except Exception as e:
        print(f"  ❌ Mesaj gönderilemedi: {e}")
        return False

def get_user_date():
    """Kullanıcıdan tarih al"""
    print("\n" + "="*50)
    print("WhatsApp Randevu Hatırlatıcı")
    print("="*50)

    # Bugünün tarihini öneri olarak göster
    today = date.today().strftime('%Y-%m-%d')
    print(f"\nBugün: {today}")
    print("\nHangi tarihteki randevular için mesaj göndermek istiyorsunuz?")
    print("(Boş bırakırsanız bugün kullanılır)")

    user_input = input(f"Tarih (YYYY-MM-DD) [{today}]: ").strip()

    if not user_input:
        return today

    # Tarih formatı kontrolü
    try:
        datetime.strptime(user_input, '%Y-%m-%d')
        return user_input
    except ValueError:
        print("❌ Geçersiz tarih formatı! Bugün kullanılıyor.")
        return today

# ==================== MAIN FUNCTION ====================

def main():
    """Ana fonksiyon"""

    # 1. Kullanıcıdan tarih al
    target_date = get_user_date()
    print(f"\n📅 Seçilen tarih: {target_date}")

    # 2. Backend'den randevuları çek
    reminders = fetch_reminders(target_date)

    if not reminders:
        print("\n❌ Bu tarihte randevu bulunamadı!")
        show_notification("WhatsApp Hatırlatıcı", "Bu tarihte randevu bulunamadı")
        input("\nÇıkmak için Enter'a basın...")
        return

    # 3. Onay al
    print(f"\n📊 Toplam {len(reminders)} müşteriye mesaj gönderilecek:")
    for i, reminder in enumerate(reminders, 1):
        print(f"  {i}. {reminder['customerName']} - {reminder['startTime']}")

    print(f"\n⏱️  Tahmini süre: ~{len(reminders) * WAIT_TIME_BETWEEN_MESSAGES // 60} dakika")
    confirm = input("\nDevam etmek istiyor musunuz? (E/H) [E]: ").strip().upper()

    if confirm and confirm != 'E':
        print("❌ İşlem iptal edildi")
        return

    # 4. WhatsApp'ı aç
    if not activate_whatsapp():
        input("\nÇıkmak için Enter'a basın...")
        return

    print("\n⚠️  ÖNEMLI:")
    print("  • WhatsApp Desktop açık ve giriş yapılmış olmalı")
    print("  • Ekranı değiştirmeyin, fare/klavyeye dokunmayın")
    print("  • Script otomatik olarak çalışacak")

    input("\n✅ Hazır olduğunuzda Enter'a basın...")

    # 5. Mesajları gönder
    print(f"\n🚀 Mesaj gönderimi başlıyor...\n")

    success_count = 0
    failed_count = 0

    for i, reminder in enumerate(reminders, 1):
        print(f"\n[{i}/{len(reminders)}] {reminder['customerName']}")

        # Telefon numarasını ve mesajı link'ten çıkar
        # link format: https://wa.me/905XXXXXXXXX?text=...
        link_parts = reminder['link'].split('?')
        phone = link_parts[0].split('/')[3]

        # Mesajı URL'den decode et
        encoded_message = link_parts[1].replace('text=', '') if len(link_parts) > 1 else ''
        message = urllib.parse.unquote(encoded_message)

        if send_whatsapp_message(phone, reminder['customerName'], message):
            success_count += 1
        else:
            failed_count += 1

        # Son mesaj değilse bekle
        if i < len(reminders):
            print(f"  ⏳ Bekleniyor ({WAIT_TIME_BETWEEN_MESSAGES} saniye)...")
            time.sleep(WAIT_TIME_BETWEEN_MESSAGES)

    # 6. Sonuç
    print("\n" + "="*50)
    print("İŞLEM TAMAMLANDI")
    print("="*50)
    print(f"✅ Başarılı: {success_count}")
    print(f"❌ Başarısız: {failed_count}")
    print(f"📊 Toplam: {len(reminders)}")

    show_notification(
        "WhatsApp Hatırlatıcı",
        f"✅ {success_count} mesaj gönderildi"
    )

    input("\nÇıkmak için Enter'a basın...")

# ==================== ENTRY POINT ====================

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Kullanıcı tarafından iptal edildi")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Beklenmeyen hata: {e}")
        show_notification("Hata", "Script beklenmedik bir hatayla karşılaştı")
        input("\nÇıkmak için Enter'a basın...")
        sys.exit(1)
