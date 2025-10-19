#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WhatsApp Desktop Otomatik Mesaj Gönderici - OTOMATIK MOD
Onay beklemez, direkt gönderir
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
API_KEY = "RLX_VewvTd8IJ9fIc95IC0B2nlQW1OEwhzg3"

WAIT_TIME_BETWEEN_MESSAGES = 12
WAIT_TIME_AFTER_SEARCH = 3
WAIT_TIME_AFTER_OPEN_CHAT = 2

# ==================== HELPER FUNCTIONS ====================

def show_notification(title, message):
    """macOS bildirim göster"""
    try:
        subprocess.run(['osascript', '-e', f'display notification "{message}" with title "{title}"'])
    except:
        pass

def activate_whatsapp():
    """WhatsApp Desktop'ı ön plana getir"""
    try:
        print("📱 WhatsApp Desktop açılıyor...")
        subprocess.run(['open', '-a', 'WhatsApp'])
        time.sleep(3)
        subprocess.run(['osascript', '-e', 'tell application "WhatsApp" to activate'])
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

        params = {
            'action': 'getTodayWhatsAppReminders',
            'date': target_date,
            'apiKey': API_KEY
        }

        url = f"{API_URL}?{urllib.parse.urlencode(params)}"
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
        print(f"  → Yeni chat açılıyor: {customer_name}")
        pyautogui.hotkey('command', 'n')
        time.sleep(WAIT_TIME_AFTER_OPEN_CHAT)

        clean_phone = ''.join(filter(str.isdigit, phone))
        if clean_phone.startswith('0'):
            clean_phone = '90' + clean_phone[1:]
        elif not clean_phone.startswith('90'):
            clean_phone = '90' + clean_phone

        formatted_phone = f"+{clean_phone}"
        print(f"  → Telefon aranıyor: {formatted_phone}")
        pyautogui.write(formatted_phone, interval=0.1)
        time.sleep(WAIT_TIME_AFTER_SEARCH)

        pyautogui.press('enter')
        time.sleep(WAIT_TIME_AFTER_OPEN_CHAT)

        print(f"  → Mesaj yazılıyor...")
        subprocess.run(['osascript', '-e', f'set the clipboard to "{message}"'])
        time.sleep(0.5)
        pyautogui.hotkey('command', 'v')
        time.sleep(1)

        pyautogui.press('enter')
        print(f"  ✅ Mesaj gönderildi: {customer_name}")

        return True

    except Exception as e:
        print(f"  ❌ Mesaj gönderilemedi: {e}")
        return False

# ==================== MAIN FUNCTION ====================

def main():
    """Ana fonksiyon - OTOMATIK MOD"""

    # Command line argument varsa onu kullan, yoksa bugünü kullan
    if len(sys.argv) > 1:
        target_date = sys.argv[1]
    else:
        target_date = date.today().strftime('%Y-%m-%d')

    print("\n" + "="*50)
    print("WhatsApp Randevu Hatırlatıcı - OTOMATIK MOD")
    print("="*50)
    print(f"\n📅 Tarih: {target_date}")
    print("⚡ Onaysız mod - Direkt gönderilecek!\n")

    # Backend'den randevuları çek
    reminders = fetch_reminders(target_date)

    if not reminders:
        print("\n❌ Bu tarihte randevu bulunamadı!")
        show_notification("WhatsApp Hatırlatıcı", "Bu tarihte randevu bulunamadı")
        time.sleep(2)
        return

    # Randevuları göster
    print(f"\n📊 Toplam {len(reminders)} müşteriye mesaj gönderilecek:")
    for i, reminder in enumerate(reminders, 1):
        print(f"  {i}. {reminder['customerName']} - {reminder['startTime']}")

    print(f"\n⏱️  Tahmini süre: ~{len(reminders) * WAIT_TIME_BETWEEN_MESSAGES // 60} dakika")
    print("\n🚀 3 saniye içinde başlıyor...")
    time.sleep(3)

    # WhatsApp'ı aç
    if not activate_whatsapp():
        time.sleep(2)
        return

    print("\n⚠️  ÖNEMLI:")
    print("  • Ekranı değiştirmeyin, fare/klavyeye dokunmayın")
    print("  • Script otomatik çalışacak\n")
    time.sleep(2)

    # Mesajları gönder
    print(f"🚀 Mesaj gönderimi başlıyor...\n")

    success_count = 0
    failed_count = 0

    for i, reminder in enumerate(reminders, 1):
        print(f"\n[{i}/{len(reminders)}] {reminder['customerName']}")

        # Telefon numarasını ve mesajı link'ten çıkar
        link_parts = reminder['link'].split('?')
        phone = link_parts[0].split('/')[3]

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

    # Sonuç
    print("\n" + "="*50)
    print("İŞLEM TAMAMLANDI")
    print("="*50)
    print(f"✅ Başarılı: {success_count}")
    print(f"❌ Başarısız: {failed_count}")
    print(f"📊 Toplam: {len(reminders)}\n")

    show_notification("WhatsApp Hatırlatıcı", f"✅ {success_count} mesaj gönderildi")

    print("🎉 Script 3 saniye içinde kapanacak...")
    time.sleep(3)

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
        time.sleep(3)
        sys.exit(1)
