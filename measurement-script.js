// ==================== VERİ ÖLÇÜM ARACI ====================
// Bu fonksiyonu Google Apps Script editöründe çalıştırın
// Script Editor: Extensions > Apps Script > Bu kodu yapıştırın ve Run edin

function measureCurrentData() {
  try {
    const calendarId = 'YOUR_CALENDAR_ID'; // apps-script-backend.js'deki CONFIG.CALENDAR_ID değerini buraya yapıştırın
    const calendar = CalendarApp.getCalendarById(calendarId);

    if (!calendar) {
      Logger.log('❌ Takvim bulunamadı! Calendar ID kontrol edin.');
      return;
    }

    // Son 2 ay için date range
    const now = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(now.getMonth() - 2);

    // Başlangıçtan bugüne tüm eventler (veya son 6 ay)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    Logger.log('📊 VERİ ÖLÇÜM RAPORU');
    Logger.log('═══════════════════════════════════════════════');
    Logger.log('Takvim: ' + calendar.getName());
    Logger.log('Ölçüm Tarihi: ' + now.toLocaleDateString('tr-TR'));
    Logger.log('');

    // SON 2 AY ANALİZİ
    Logger.log('📅 SON 2 AY ANALİZİ (' + twoMonthsAgo.toLocaleDateString('tr-TR') + ' - ' + now.toLocaleDateString('tr-TR') + ')');
    Logger.log('─────────────────────────────────────────────');

    const twoMonthEvents = calendar.getEvents(twoMonthsAgo, now);
    const twoMonthCount = twoMonthEvents.length;

    // Test randevularını filtrele (başlıkta "test" geçenler)
    const realAppointments = twoMonthEvents.filter(event => {
      const title = event.getTitle().toLowerCase();
      return !title.includes('test') && !title.includes('deneme') && !title.includes('örnek');
    });

    const realCount = realAppointments.length;
    const testCount = twoMonthCount - realCount;

    Logger.log('Toplam Event: ' + twoMonthCount);
    Logger.log('Gerçek Randevu: ' + realCount);
    Logger.log('Test Randevu: ' + testCount);
    Logger.log('Günlük Ortalama: ' + (realCount / 60).toFixed(1) + ' randevu/gün');
    Logger.log('Aylık Projeksiyon: ' + Math.round(realCount / 2) + ' randevu/ay');
    Logger.log('');

    // RANDEVU TİPİ ANALİZİ
    Logger.log('📋 RANDEVU TİPİ DAĞILIMI');
    Logger.log('─────────────────────────────────────────────');

    const typeStats = {};
    realAppointments.forEach(event => {
      const type = event.getTag('appointmentType') || 'unknown';
      typeStats[type] = (typeStats[type] || 0) + 1;
    });

    Object.entries(typeStats).forEach(([type, count]) => {
      Logger.log(type + ': ' + count + ' (' + ((count / realCount) * 100).toFixed(1) + '%)');
    });
    Logger.log('');

    // VERİ BOYUTU TAHMİNİ
    Logger.log('💾 VERİ BOYUTU ANALİZİ');
    Logger.log('─────────────────────────────────────────────');

    // Örnek bir randevu verisinin boyutunu hesapla
    if (realAppointments.length > 0) {
      const sampleEvent = realAppointments[0];
      const sampleData = {
        title: sampleEvent.getTitle(),
        description: sampleEvent.getDescription(),
        startTime: sampleEvent.getStartTime(),
        endTime: sampleEvent.getEndTime(),
        staffId: sampleEvent.getTag('staffId'),
        customerPhone: sampleEvent.getTag('customerPhone'),
        customerEmail: sampleEvent.getTag('customerEmail'),
        appointmentType: sampleEvent.getTag('appointmentType')
      };

      const sampleJson = JSON.stringify(sampleData);
      const bytesPerAppointment = sampleJson.length;

      Logger.log('Randevu Başına Veri Boyutu: ~' + bytesPerAppointment + ' bytes');
      Logger.log('2 Aylık Veri: ~' + ((realCount * bytesPerAppointment) / 1024).toFixed(2) + ' KB');
      Logger.log('');

      // PROJEKSİYON
      Logger.log('📈 PROJEKSİYON (Gerçek Verilere Göre)');
      Logger.log('─────────────────────────────────────────────');

      const monthlyRate = realCount / 2;

      Logger.log('Aylık Gerçek Oran: ' + monthlyRate.toFixed(1) + ' randevu/ay');
      Logger.log('');

      // Farklı senaryolar
      const scenarios = [
        { name: '6 Ay', months: 6 },
        { name: '1 Yıl', months: 12 },
        { name: '2 Yıl', months: 24 },
        { name: '5 Yıl', months: 60 }
      ];

      scenarios.forEach(scenario => {
        const totalEvents = Math.round(monthlyRate * scenario.months);
        const totalSizeKB = (totalEvents * bytesPerAppointment) / 1024;
        const totalSizeMB = totalSizeKB / 1024;

        Logger.log(scenario.name + ':');
        Logger.log('  - Toplam Randevu: ' + totalEvents);
        Logger.log('  - Veri Boyutu: ' + totalSizeKB.toFixed(2) + ' KB (' + totalSizeMB.toFixed(2) + ' MB)');

        // Calendar limit kontrolü
        if (totalEvents > 3000) {
          Logger.log('  ⚠️ UYARI: Google Calendar soft limit (3,000 event) AŞILIR');
        }

        Logger.log('');
      });
    }

    // TÜM TAKVIM BOYUTU (6 ay veya tümü)
    Logger.log('📦 TOPLAM TAKVİM VERİSİ');
    Logger.log('─────────────────────────────────────────────');

    const allEvents = calendar.getEvents(sixMonthsAgo, now);
    Logger.log('Son 6 Aydaki Toplam Event: ' + allEvents.length);

    // PropertiesService boyutu
    const props = PropertiesService.getScriptProperties();
    const propsData = props.getProperty('rolex_randevu_data');
    if (propsData) {
      const propsSize = propsData.length;
      Logger.log('PropertiesService Boyutu: ' + (propsSize / 1024).toFixed(2) + ' KB / 500 KB');
      Logger.log('PropertiesService Kullanım: %' + ((propsSize / (500 * 1024)) * 100).toFixed(1));
    }

    Logger.log('');
    Logger.log('═══════════════════════════════════════════════');
    Logger.log('✅ Ölçüm tamamlandı!');
    Logger.log('');
    Logger.log('📝 SONUÇ:');
    Logger.log('Google Apps Script > Executions menüsünden bu log çıktısını kopyalayın');
    Logger.log('ve Claude Code\'a yapıştırın.');

  } catch (error) {
    Logger.log('❌ HATA: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}
