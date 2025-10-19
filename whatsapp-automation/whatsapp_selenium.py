#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WhatsApp Web - Tam Otomatik Mesaj Gönderici (Selenium)
Hiçbir manuel işlem gerektirmez!
"""

import sys
import time
import json
import urllib.request
import urllib.parse
from datetime import date
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("❌ Selenium yüklü değil!")
    print("Kurulum: pip3 install selenium webdriver-manager")
    sys.exit(1)

# ==================== CONFIGURATION ====================
API_URL = "https://script.google.com/macros/s/AKfycbwmowzsBLrAOjn-HVtw_LSLf-Gn0jrWdaQMrxaJeulqnhJCQduyyeSvctsWPAXxSAuo/exec"
API_KEY = "RLX_VewvTd8IJ9fIc95IC0B2nlQW1OEwhzg3"

# Chrome profil klasörü (session kaydetmek için)
CHROME_PROFILE_DIR = str(Path.home() / ".whatsapp_automation")

WAIT_AFTER_MESSAGE = 3  # Mesaj gönderdikten sonra bekleme (saniye)

# ==================== HELPER FUNCTIONS ====================

def fetch_reminders(target_date):
    """Backend'den randevuları çek"""
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
            print(f"✅ {len(reminders)} randevu bulundu\n")
            return reminders
        else:
            error = data.get('error', 'Bilinmeyen hata')
            print(f"❌ API hatası: {error}")
            return []

    except Exception as e:
        print(f"❌ Backend bağlantı hatası: {e}")
        return []

def init_driver():
    """Chrome WebDriver başlat"""
    print("🌐 Chrome başlatılıyor...")

    chrome_options = Options()
    chrome_options.add_argument(f"user-data-dir={CHROME_PROFILE_DIR}")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.maximize_window()

    return driver

def wait_for_whatsapp_login(driver):
    """WhatsApp Web'e giriş yapılmasını bekle"""
    print("\n📱 WhatsApp Web açılıyor...")
    driver.get("https://web.whatsapp.com")

    print("\n⏳ WhatsApp Web'e giriş bekleniyor...")
    print("👉 QR kodu telefonunuzla okutun (ilk seferde)")

    try:
        # Chat listesinin yüklenmesini bekle (giriş yapıldı demektir)
        WebDriverWait(driver, 60).until(
            EC.presence_of_element_located((By.XPATH, '//div[@aria-label="Chat list"]'))
        )
        print("✅ WhatsApp Web'e giriş yapıldı!\n")
        return True
    except:
        print("❌ WhatsApp Web'e giriş yapılamadı (zaman aşımı)")
        return False

def send_message(driver, phone, message, customer_name):
    """WhatsApp Web ile mesaj gönder"""
    try:
        # Telefon formatını düzenle
        clean_phone = ''.join(filter(str.isdigit, phone))
        if clean_phone.startswith('0'):
            clean_phone = '90' + clean_phone[1:]
        elif not clean_phone.startswith('90'):
            clean_phone = '90' + clean_phone

        # WhatsApp Web API linki
        url = f"https://web.whatsapp.com/send?phone={clean_phone}"
        print(f"  → Chat açılıyor: {customer_name} (+{clean_phone})")
        driver.get(url)

        # Chat yüklenene kadar bekle
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
        )
        time.sleep(2)  # Ekstra güvenlik

        # Mesaj kutusunu bul
        message_box = driver.find_element(By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]')

        # Mesajı satır satır gönder (Enter karakterlerini korumak için)
        lines = message.split('\n')
        for i, line in enumerate(lines):
            message_box.send_keys(line)
            if i < len(lines) - 1:  # Son satır değilse
                message_box.send_keys(Keys.SHIFT + Keys.ENTER)

        time.sleep(1)

        # Gönder butonuna bas
        message_box.send_keys(Keys.ENTER)

        print(f"  ✅ Mesaj gönderildi: {customer_name}")
        time.sleep(WAIT_AFTER_MESSAGE)

        return True

    except Exception as e:
        print(f"  ❌ Hata: {e}")
        return False

# ==================== MAIN FUNCTION ====================

def main():
    """Ana fonksiyon"""

    # Tarih belirle
    if len(sys.argv) > 1:
        target_date = sys.argv[1]
    else:
        target_date = date.today().strftime('%Y-%m-%d')

    print("\n" + "="*60)
    print("WhatsApp Web - Tam Otomatik Mesaj Gönderici")
    print("="*60)
    print(f"\n📅 Tarih: {target_date}\n")

    # Randevuları çek
    reminders = fetch_reminders(target_date)

    if not reminders:
        print("\n❌ Bu tarihte randevu bulunamadı!")
        return

    # Özet göster
    print(f"📊 Toplam {len(reminders)} müşteriye mesaj gönderilecek:")
    for i, reminder in enumerate(reminders, 1):
        print(f"  {i}. {reminder['customerName']} - {reminder['startTime']}")

    print("\n🚀 5 saniye içinde başlıyor...")
    time.sleep(5)

    driver = None

    try:
        # Chrome'u başlat
        driver = init_driver()

        # WhatsApp Web'e giriş
        if not wait_for_whatsapp_login(driver):
            return

        # Mesajları gönder
        print("📨 Mesaj gönderimi başlıyor...\n")

        success_count = 0
        failed_count = 0

        for i, reminder in enumerate(reminders, 1):
            print(f"\n[{i}/{len(reminders)}] {reminder['customerName']}")

            # Link'ten telefon ve mesajı çıkar
            link_parts = reminder['link'].split('?')
            phone = link_parts[0].split('/')[3]

            encoded_message = link_parts[1].replace('text=', '') if len(link_parts) > 1 else ''
            message = urllib.parse.unquote(encoded_message)

            if send_message(driver, phone, message, reminder['customerName']):
                success_count += 1
            else:
                failed_count += 1

        # Sonuç
        print("\n" + "="*60)
        print("İŞLEM TAMAMLANDI")
        print("="*60)
        print(f"✅ Başarılı: {success_count}")
        print(f"❌ Başarısız: {failed_count}")
        print(f"📊 Toplam: {len(reminders)}\n")

        print("🎉 Tarayıcı 10 saniye içinde kapanacak...")
        time.sleep(10)

    except KeyboardInterrupt:
        print("\n\n❌ Kullanıcı tarafından iptal edildi")

    except Exception as e:
        print(f"\n\n❌ Beklenmeyen hata: {e}")

    finally:
        if driver:
            driver.quit()
            print("✅ Tarayıcı kapatıldı")

# ==================== ENTRY POINT ====================

if __name__ == "__main__":
    main()
