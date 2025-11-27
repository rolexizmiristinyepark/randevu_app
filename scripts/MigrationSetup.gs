// ==================== MIGRATION SETUP SCRIPT ====================
// FAZ 2: PropertiesService'den Google Sheets'e geçiş için kurulum scripti
// Bu dosyayı Google Apps Script projesine ekleyin ve manuel çalıştırın

/**
 * =====================================================
 * 🚀 KURULUM TALİMATLARI
 * =====================================================
 *
 * ADIM 1: Google Sheets Veritabanı Oluşturma
 * ------------------------------------------
 * 1. Google Drive'da yeni bir Spreadsheet oluşturun
 * 2. Spreadsheet adını "Randevu Sistemi Database" yapın
 * 3. URL'den Spreadsheet ID'sini kopyalayın:
 *    https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
 *
 * ADIM 2: Script Properties Ayarlama
 * -----------------------------------
 * 1. Apps Script editöründe: Project Settings (dişli ikonu)
 * 2. "Script Properties" bölümüne gidin
 * 3. Aşağıdaki property'yi ekleyin:
 *    Key: SHEETS_DATABASE_ID
 *    Value: [Kopyaladığınız Spreadsheet ID]
 *
 * ADIM 3: Migration Çalıştırma
 * ----------------------------
 * 1. runFullMigration() fonksiyonunu çalıştırın
 * 2. Logları kontrol edin
 * 3. Google Sheets'te verilerin oluştuğunu doğrulayın
 *
 * ADIM 4: Feature Flag Aktifleştirme
 * -----------------------------------
 * 1. enableSheetStorageAndVerify() fonksiyonunu çalıştırın
 * 2. Sistem artık Google Sheets kullanacak
 *
 * =====================================================
 */

/**
 * Tam migration işlemi - TEK SEFERDE ÇALIŞTIRIN
 * @returns {Object} Migration sonucu
 */
function runFullMigration() {
  const results = {
    steps: [],
    success: false,
    finalMessage: ''
  };

  console.log('🚀 Migration başlıyor...\n');

  // STEP 1: Spreadsheet ID kontrolü
  console.log('STEP 1: Spreadsheet ID kontrolü...');
  try {
    const props = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('SHEETS_DATABASE_ID');

    if (!sheetId) {
      results.steps.push({
        step: 1,
        name: 'Spreadsheet ID Kontrolü',
        success: false,
        error: 'SHEETS_DATABASE_ID Script Properties\'de tanımlı değil!'
      });
      console.error('❌ HATA: SHEETS_DATABASE_ID bulunamadı!');
      console.log('\n📋 Çözüm:');
      console.log('1. Google Drive\'da yeni Spreadsheet oluşturun');
      console.log('2. URL\'den ID\'yi kopyalayın');
      console.log('3. Project Settings > Script Properties > SHEETS_DATABASE_ID ekleyin');
      return results;
    }

    results.steps.push({
      step: 1,
      name: 'Spreadsheet ID Kontrolü',
      success: true,
      data: { spreadsheetId: sheetId.substring(0, 10) + '...' }
    });
    console.log('✅ Spreadsheet ID bulundu\n');

  } catch (error) {
    results.steps.push({ step: 1, name: 'Spreadsheet ID Kontrolü', success: false, error: error.toString() });
    return results;
  }

  // STEP 2: Spreadsheet erişim kontrolü
  console.log('STEP 2: Spreadsheet erişim kontrolü...');
  try {
    const ss = SheetStorageService.getSpreadsheet();
    results.steps.push({
      step: 2,
      name: 'Spreadsheet Erişim',
      success: true,
      data: { name: ss.getName() }
    });
    console.log('✅ Spreadsheet\'e erişildi: ' + ss.getName() + '\n');

  } catch (error) {
    results.steps.push({ step: 2, name: 'Spreadsheet Erişim', success: false, error: error.toString() });
    console.error('❌ Spreadsheet\'e erişilemedi:', error.toString());
    return results;
  }

  // STEP 3: Veritabanı tablolarını oluştur
  console.log('STEP 3: Veritabanı tabloları oluşturuluyor...');
  try {
    const initResult = SheetStorageService.initializeDatabase();
    results.steps.push({
      step: 3,
      name: 'Tablo Oluşturma',
      success: initResult.success,
      data: initResult
    });

    if (initResult.success) {
      console.log('✅ Tablolar oluşturuldu: Staff, Shifts, Settings, AuditLog\n');
    } else {
      console.error('❌ Tablo oluşturma hatası:', initResult.error);
      return results;
    }

  } catch (error) {
    results.steps.push({ step: 3, name: 'Tablo Oluşturma', success: false, error: error.toString() });
    return results;
  }

  // STEP 4: Mevcut veriyi kontrol et
  console.log('STEP 4: Mevcut PropertiesService verisi kontrol ediliyor...');
  try {
    const props = PropertiesService.getScriptProperties();
    const oldDataJson = props.getProperty('RANDEVU_DATA');

    if (!oldDataJson) {
      console.log('ℹ️ PropertiesService\'de veri yok. Varsayılan veriler yüklenecek.\n');
      results.steps.push({
        step: 4,
        name: 'Mevcut Veri Kontrolü',
        success: true,
        data: { hasData: false, message: 'Mevcut veri yok, varsayılanlar yüklenecek' }
      });

      // Varsayılan veriyi yükle
      const resetResult = SheetStorageService.resetData();
      results.steps.push({
        step: '4b',
        name: 'Varsayılan Veri Yükleme',
        success: resetResult.success
      });

      console.log('✅ Varsayılan veriler yüklendi\n');

    } else {
      const oldData = JSON.parse(oldDataJson);
      console.log('✅ Mevcut veri bulundu:');
      console.log('   - Staff sayısı:', oldData.staff?.length || 0);
      console.log('   - Shift günü sayısı:', Object.keys(oldData.shifts || {}).length);
      console.log('   - Settings:', JSON.stringify(oldData.settings));
      console.log('');

      results.steps.push({
        step: 4,
        name: 'Mevcut Veri Kontrolü',
        success: true,
        data: {
          hasData: true,
          staffCount: oldData.staff?.length || 0,
          shiftsCount: Object.keys(oldData.shifts || {}).length
        }
      });

      // STEP 5: Migration yap
      console.log('STEP 5: Veri migration yapılıyor...');
      const migrationResult = migratePropertiesToSheets();
      results.steps.push({
        step: 5,
        name: 'Veri Migration',
        success: migrationResult.success,
        data: migrationResult
      });

      if (migrationResult.success) {
        console.log('✅ Migration tamamlandı!\n');
      } else {
        console.error('❌ Migration hatası:', migrationResult.error);
        return results;
      }
    }

  } catch (error) {
    results.steps.push({ step: 4, name: 'Veri Kontrolü/Migration', success: false, error: error.toString() });
    return results;
  }

  // STEP 6: Doğrulama
  console.log('STEP 6: Migration doğrulanıyor...');
  try {
    const verifyResult = verifyMigration();
    results.steps.push({
      step: 6,
      name: 'Migration Doğrulama',
      success: verifyResult.success,
      data: verifyResult
    });

    if (verifyResult.success) {
      console.log('✅ Migration doğrulandı!\n');
    } else {
      console.warn('⚠️ Doğrulama uyarısı:', verifyResult.message);
      console.log('Karşılaştırma:', JSON.stringify(verifyResult.comparison, null, 2));
    }

  } catch (error) {
    results.steps.push({ step: 6, name: 'Migration Doğrulama', success: false, error: error.toString() });
  }

  // Final
  const allSuccess = results.steps.every(s => s.success);
  results.success = allSuccess;
  results.finalMessage = allSuccess
    ? '🎉 Migration başarıyla tamamlandı! Artık enableSheetStorageAndVerify() çalıştırabilirsiniz.'
    : '⚠️ Migration tamamlandı ancak bazı adımlarda sorun oluştu. Logları kontrol edin.';

  console.log('\n' + '='.repeat(60));
  console.log(results.finalMessage);
  console.log('='.repeat(60));

  return results;
}

/**
 * Sheet storage'ı aktifleştir ve son kontrol yap
 * @returns {Object} Aktivasyon sonucu
 */
function enableSheetStorageAndVerify() {
  console.log('🔄 Sheet Storage aktifleştiriliyor...\n');

  // Son bir doğrulama yap
  const verifyResult = verifyMigration();
  if (!verifyResult.success) {
    console.error('❌ Doğrulama başarısız. Önce runFullMigration() çalıştırın.');
    return {
      success: false,
      message: 'Doğrulama başarısız. Migration tamamlanmamış olabilir.',
      verification: verifyResult
    };
  }

  // Feature flag'i aktifleştir
  STORAGE_FEATURE_FLAG.enableSheetStorage();

  // Test oku
  console.log('Test okuma yapılıyor...');
  const testData = SheetStorageService.getData();

  console.log('\n✅ Sheet Storage AKTİF!');
  console.log('📊 Mevcut veriler:');
  console.log('   - Staff sayısı:', testData.staff?.length || 0);
  console.log('   - Shift günü sayısı:', Object.keys(testData.shifts || {}).length);
  console.log('   - Settings:', JSON.stringify(testData.settings));

  console.log('\n📋 Sonraki adımlar:');
  console.log('1. Uygulamayı test edin');
  console.log('2. Yeni randevular oluşturup Sheets\'te kontrol edin');
  console.log('3. Her şey çalışıyorsa cleanupOldPropertiesData() ile eski veriyi silebilirsiniz');

  return {
    success: true,
    message: 'Sheet Storage aktifleştirildi!',
    currentData: {
      staffCount: testData.staff?.length || 0,
      shiftsCount: Object.keys(testData.shifts || {}).length,
      settings: testData.settings
    }
  };
}

/**
 * Rollback - Sheet storage'dan PropertiesService'e geri dön
 * Sorun olursa bu fonksiyonu kullanın
 * @returns {Object} Rollback sonucu
 */
function rollbackToPropertiesService() {
  console.log('⚠️ Rollback yapılıyor...\n');

  try {
    // Feature flag'i devre dışı bırak
    STORAGE_FEATURE_FLAG.disableSheetStorage();

    // Backup'tan geri yükle
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    // En son backup'ı bul
    const backupKeys = Object.keys(allProps).filter(k => k.startsWith('RANDEVU_DATA_BACKUP_'));
    if (backupKeys.length === 0) {
      console.log('ℹ️ Backup bulunamadı. Mevcut PropertiesService verisi kullanılacak.');
      return {
        success: true,
        message: 'Feature flag devre dışı bırakıldı. Backup yoktu.',
        usedBackup: false
      };
    }

    // En son backup'ı al
    backupKeys.sort().reverse();
    const latestBackup = backupKeys[0];
    const backupData = props.getProperty(latestBackup);

    // Geri yükle
    props.setProperty('RANDEVU_DATA', backupData);

    console.log('✅ Rollback tamamlandı!');
    console.log('Kullanılan backup:', latestBackup);

    return {
      success: true,
      message: 'Rollback tamamlandı. PropertiesService kullanılıyor.',
      usedBackup: true,
      backupKey: latestBackup
    };

  } catch (error) {
    console.error('❌ Rollback hatası:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Mevcut storage durumunu göster
 * @returns {Object} Storage durumu
 */
function getStorageStatus() {
  const props = PropertiesService.getScriptProperties();

  const status = {
    activeStorage: STORAGE_FEATURE_FLAG.isSheetStorageEnabled() ? 'Google Sheets' : 'PropertiesService',
    sheetsConfigured: !!props.getProperty('SHEETS_DATABASE_ID'),
    propertiesHasData: !!props.getProperty('RANDEVU_DATA'),
    backupCount: Object.keys(props.getProperties()).filter(k => k.startsWith('RANDEVU_DATA_BACKUP_')).length
  };

  if (status.sheetsConfigured && STORAGE_FEATURE_FLAG.isSheetStorageEnabled()) {
    try {
      const sheetsData = SheetStorageService.getData();
      status.sheetsData = {
        staffCount: sheetsData.staff?.length || 0,
        shiftsCount: Object.keys(sheetsData.shifts || {}).length,
        settings: sheetsData.settings
      };
    } catch (error) {
      status.sheetsError = error.toString();
    }
  }

  if (status.propertiesHasData) {
    try {
      const propsData = JSON.parse(props.getProperty('RANDEVU_DATA'));
      status.propertiesData = {
        staffCount: propsData.staff?.length || 0,
        shiftsCount: Object.keys(propsData.shifts || {}).length,
        settings: propsData.settings
      };
    } catch (error) {
      status.propertiesError = error.toString();
    }
  }

  console.log('\n📊 Storage Durumu:');
  console.log(JSON.stringify(status, null, 2));

  return status;
}

/**
 * Test fonksiyonu - CRUD işlemlerini test eder
 * @returns {Object} Test sonuçları
 */
function runStorageTests() {
  console.log('🧪 Storage testleri başlıyor...\n');

  const tests = [];

  // Test 1: Staff oku
  console.log('Test 1: Staff okuma...');
  try {
    const staff = SheetStorageService.getStaff();
    tests.push({ name: 'Staff Okuma', success: true, count: staff.length });
    console.log('✅ Staff sayısı:', staff.length);
  } catch (error) {
    tests.push({ name: 'Staff Okuma', success: false, error: error.toString() });
    console.error('❌', error);
  }

  // Test 2: Settings oku
  console.log('Test 2: Settings okuma...');
  try {
    const settings = SheetStorageService.getSettings();
    tests.push({ name: 'Settings Okuma', success: true, data: settings });
    console.log('✅ Settings:', JSON.stringify(settings));
  } catch (error) {
    tests.push({ name: 'Settings Okuma', success: false, error: error.toString() });
    console.error('❌', error);
  }

  // Test 3: Shifts oku
  console.log('Test 3: Shifts okuma...');
  try {
    const shifts = SheetStorageService.getShifts();
    tests.push({ name: 'Shifts Okuma', success: true, count: Object.keys(shifts).length });
    console.log('✅ Shift günü sayısı:', Object.keys(shifts).length);
  } catch (error) {
    tests.push({ name: 'Shifts Okuma', success: false, error: error.toString() });
    console.error('❌', error);
  }

  // Test 4: getData() uyumluluk
  console.log('Test 4: getData() uyumluluk...');
  try {
    const data = SheetStorageService.getData();
    const hasAllKeys = data.hasOwnProperty('staff') && data.hasOwnProperty('shifts') && data.hasOwnProperty('settings');
    tests.push({ name: 'getData Uyumluluk', success: hasAllKeys });
    console.log(hasAllKeys ? '✅ getData() uyumlu' : '❌ getData() uyumsuz');
  } catch (error) {
    tests.push({ name: 'getData Uyumluluk', success: false, error: error.toString() });
    console.error('❌', error);
  }

  // Test 5: Audit log yazma
  console.log('Test 5: Audit log yazma...');
  try {
    SheetStorageService.addAuditLog('TEST', { test: true, timestamp: new Date().toISOString() }, 'test-user');
    tests.push({ name: 'Audit Log Yazma', success: true });
    console.log('✅ Audit log yazıldı');
  } catch (error) {
    tests.push({ name: 'Audit Log Yazma', success: false, error: error.toString() });
    console.error('❌', error);
  }

  // Özet
  const passedCount = tests.filter(t => t.success).length;
  console.log('\n' + '='.repeat(40));
  console.log(`📋 Test Sonucu: ${passedCount}/${tests.length} başarılı`);
  console.log('='.repeat(40));

  return {
    passed: passedCount,
    total: tests.length,
    allPassed: passedCount === tests.length,
    tests: tests
  };
}
