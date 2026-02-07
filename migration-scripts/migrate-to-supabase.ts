/**
 * MIGRATION SCRIPT: Google Apps Script -> Supabase
 *
 * Calistirma:
 *   npx tsx migration-scripts/migrate-to-supabase.ts
 *
 * Gereksinimler:
 *   - GAS_URL: Mevcut Google Apps Script deployment URL'i
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key (RLS bypass)
 *
 * Ortam degiskenleri .env.migration dosyasindan okunur.
 *
 * Sira (FK uyumu):
 *   1. staff (+ Supabase Auth user olusturma)
 *   2. shifts
 *   3. settings
 *   4. profile_settings (seed'den geliyor, override varsa guncelle)
 *   5. appointments (Google Calendar'dan)
 *   6. notification_flows
 *   7. whatsapp_templates
 *   8. mail_templates
 *   9. mail_info_cards
 *  10. daily_tasks
 *  11. audit_log (opsiyonel)
 *  12. message_log (opsiyonel)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ==================== CONFIG ====================

interface MigrationConfig {
    GAS_URL: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    DEFAULT_PASSWORD: string;
    SKIP_AUDIT_LOG: boolean;
    SKIP_MESSAGE_LOG: boolean;
    DRY_RUN: boolean;
}

function loadConfig(): MigrationConfig {
    const envPath = resolve(__dirname, '../.env.migration');
    if (!existsSync(envPath)) {
        console.error('.env.migration dosyasi bulunamadi!');
        console.error('Ornek .env.migration:');
        console.error('  GAS_URL=https://script.google.com/macros/s/.../exec');
        console.error('  SUPABASE_URL=https://xxx.supabase.co');
        console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ...');
        console.error('  DEFAULT_PASSWORD=TempPass123!');
        process.exit(1);
    }

    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...valueParts] = trimmed.split('=');
        env[key.trim()] = valueParts.join('=').trim();
    });

    return {
        GAS_URL: env.GAS_URL || '',
        SUPABASE_URL: env.SUPABASE_URL || '',
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || '',
        DEFAULT_PASSWORD: env.DEFAULT_PASSWORD || 'TempPass123!',
        SKIP_AUDIT_LOG: env.SKIP_AUDIT_LOG === 'true',
        SKIP_MESSAGE_LOG: env.SKIP_MESSAGE_LOG === 'true',
        DRY_RUN: env.DRY_RUN === 'true',
    };
}

// ==================== GAS API ====================

async function gasCall(gasUrl: string, action: string, params: Record<string, unknown> = {}): Promise<any> {
    const url = new URL(gasUrl);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`GAS API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(`GAS API error: ${data.message || 'Unknown error'}`);
    }

    return data.data || data;
}

// ==================== MIGRATION STATS ====================

interface MigrationStats {
    table: string;
    source: number;
    migrated: number;
    errors: number;
    skipped: number;
}

const stats: MigrationStats[] = [];

function addStats(table: string, source: number, migrated: number, errors: number, skipped: number = 0): void {
    stats.push({ table, source, migrated, errors, skipped });
    console.log(`  [${table}] Kaynak: ${source}, Migre: ${migrated}, Hata: ${errors}, Atlanan: ${skipped}`);
}

// ==================== MIGRATION FUNCTIONS ====================

/**
 * 1. Staff migration - Auth user olustur + staff tablosuna yaz
 * Returns: staffIdMap (GAS ID -> Supabase staff ID)
 */
async function migrateStaff(
    supabase: SupabaseClient,
    gasUrl: string,
    defaultPassword: string,
    dryRun: boolean
): Promise<Map<string, number>> {
    console.log('\n1. Staff migrasyon basliyor...');

    const gasStaff = await gasCall(gasUrl, 'getStaff');
    const staffList = Array.isArray(gasStaff) ? gasStaff : (gasStaff.staff || gasStaff.data || []);

    const staffIdMap = new Map<string, number>();
    let migrated = 0;
    let errors = 0;

    for (const staff of staffList) {
        try {
            if (dryRun) {
                console.log(`  [DRY] Staff: ${staff.name} (${staff.email || 'no-email'})`);
                migrated++;
                continue;
            }

            // Email yoksa olustur
            const email = staff.email || `staff_${staff.id}@migration.local`;

            // 1a. Supabase Auth user olustur
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email,
                password: defaultPassword,
                email_confirm: true,
                app_metadata: {
                    role: staff.role || 'sales',
                    is_admin: staff.isAdmin || false,
                    staff_name: staff.name,
                },
            });

            if (authError) {
                // User zaten varsa, mevcut user'i bul
                if (authError.message?.includes('already been registered')) {
                    const { data: { users } } = await supabase.auth.admin.listUsers();
                    const existingUser = users?.find(u => u.email === email);
                    if (existingUser) {
                        // staff tablosuna yaz
                        const { data: staffRow, error: staffError } = await supabase
                            .from('staff')
                            .upsert({
                                auth_user_id: existingUser.id,
                                name: staff.name,
                                phone: staff.phone || '',
                                email: email,
                                role: staff.role || 'sales',
                                is_admin: staff.isAdmin || false,
                                is_vip: staff.isVip || false,
                                active: staff.active !== false,
                                permissions: staff.permissions || {},
                            }, { onConflict: 'email' })
                            .select('id')
                            .single();

                        if (staffError) throw staffError;
                        staffIdMap.set(String(staff.id), staffRow.id);
                        migrated++;
                        continue;
                    }
                }
                throw authError;
            }

            // 1b. Staff tablosuna yaz
            const { data: staffRow, error: staffError } = await supabase
                .from('staff')
                .insert({
                    auth_user_id: authUser.user.id,
                    name: staff.name,
                    phone: staff.phone || '',
                    email: email,
                    role: staff.role || 'sales',
                    is_admin: staff.isAdmin || false,
                    is_vip: staff.isVip || false,
                    active: staff.active !== false,
                    permissions: staff.permissions || {},
                })
                .select('id')
                .single();

            if (staffError) throw staffError;

            staffIdMap.set(String(staff.id), staffRow.id);
            migrated++;
        } catch (error) {
            console.error(`  HATA: Staff ${staff.name}: ${error}`);
            errors++;
        }
    }

    addStats('staff', staffList.length, migrated, errors);

    // ID mapping'i kaydet
    const mapObj = Object.fromEntries(staffIdMap);
    writeFileSync(
        resolve(__dirname, 'staff-id-mapping.json'),
        JSON.stringify(mapObj, null, 2)
    );
    console.log('  Staff ID mapping kaydedildi: staff-id-mapping.json');

    return staffIdMap;
}

/**
 * 2. Shifts migration
 */
async function migrateShifts(
    supabase: SupabaseClient,
    gasUrl: string,
    staffIdMap: Map<string, number>,
    dryRun: boolean
): Promise<void> {
    console.log('\n2. Shifts migrasyon basliyor...');

    // GAS'ta shift verisi genelde haftalik/aylik yukleniyor
    // getStaff + shifts bilgisi iceriyorsa oradan alalim
    // Aksi halde settings'den shift bilgisi gelir
    let shifts: any[] = [];
    try {
        const gasShifts = await gasCall(gasUrl, 'getWeekAppointments');
        // GAS'tan gelen shift verisi formatina bagli olarak parse et
        if (gasShifts.dayShifts) {
            for (const [date, staffShifts] of Object.entries(gasShifts.dayShifts as Record<string, Record<string, string>>)) {
                for (const [staffId, shiftType] of Object.entries(staffShifts)) {
                    const newStaffId = staffIdMap.get(String(staffId));
                    if (newStaffId) {
                        shifts.push({ date, staff_id: newStaffId, shift_type: shiftType });
                    }
                }
            }
        }
    } catch (error) {
        console.warn('  Shift verisi yuklenemedi, bos migrasyon:', error);
    }

    if (shifts.length === 0 || dryRun) {
        addStats('shifts', shifts.length, dryRun ? shifts.length : 0, 0);
        return;
    }

    const { error } = await supabase.from('shifts').upsert(shifts, {
        onConflict: 'date,staff_id',
    });

    if (error) {
        console.error('  Shifts insert hatasi:', error);
        addStats('shifts', shifts.length, 0, shifts.length);
    } else {
        addStats('shifts', shifts.length, shifts.length, 0);
    }
}

/**
 * 3. Settings migration
 */
async function migrateSettings(
    supabase: SupabaseClient,
    gasUrl: string,
    dryRun: boolean
): Promise<void> {
    console.log('\n3. Settings migrasyon basliyor...');

    const gasSettings = await gasCall(gasUrl, 'getSettings');
    const settings = gasSettings.settings || gasSettings;

    const rows: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of Object.entries(settings)) {
        rows.push({ key, value: JSON.parse(JSON.stringify(value)) });
    }

    if (dryRun) {
        addStats('settings', rows.length, rows.length, 0);
        return;
    }

    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });

    if (error) {
        console.error('  Settings insert hatasi:', error);
        addStats('settings', rows.length, 0, rows.length);
    } else {
        addStats('settings', rows.length, rows.length, 0);
    }
}

/**
 * 5. Appointments migration (Calendar'dan)
 */
async function migrateAppointments(
    supabase: SupabaseClient,
    gasUrl: string,
    staffIdMap: Map<string, number>,
    dryRun: boolean
): Promise<void> {
    console.log('\n5. Appointments migrasyon basliyor...');

    // Son 90 gunun randevularini al
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    const end = new Date(today);
    end.setDate(end.getDate() + 60);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    let allAppointments: any[] = [];

    try {
        // Aylik olarak cek
        const gasData = await gasCall(gasUrl, 'getMonthAppointments', {
            month: String(today.getMonth()),
            year: String(today.getFullYear()),
        });

        const appointments = gasData.appointments || gasData.allAppointments || {};

        for (const [date, dayAppts] of Object.entries(appointments as Record<string, any[]>)) {
            if (Array.isArray(dayAppts)) {
                dayAppts.forEach((appt: any) => {
                    allAppointments.push({ ...appt, date });
                });
            }
        }
    } catch (error) {
        console.warn('  Randevu verisi yuklenemedi:', error);
    }

    if (allAppointments.length === 0) {
        addStats('appointments', 0, 0, 0);
        return;
    }

    let migrated = 0;
    let errors = 0;

    for (const appt of allAppointments) {
        try {
            if (dryRun) {
                migrated++;
                continue;
            }

            const newStaffId = staffIdMap.get(String(appt.staffId || appt.staff_id));

            // Parse time from Calendar event
            const startTime = appt.startTime || appt.time || appt.start?.time || '11:00';
            const endTime = appt.endTime || '';
            const duration = appt.duration || 60;

            // Calculate end time if not provided
            let calculatedEndTime = endTime;
            if (!calculatedEndTime && startTime) {
                const [h, m] = startTime.split(':').map(Number);
                const endMinutes = h * 60 + m + duration;
                const endH = Math.floor(endMinutes / 60);
                const endM = endMinutes % 60;
                calculatedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
            }

            const { error } = await supabase.from('appointments').insert({
                google_event_id: appt.eventId || appt.google_event_id || null,
                staff_id: newStaffId || null,
                customer_name: appt.customerName || appt.customer_name || '',
                customer_phone: appt.customerPhone || appt.customer_phone || '',
                customer_email: appt.customerEmail || appt.customer_email || '',
                customer_note: appt.customerNote || appt.customer_note || '',
                date: appt.date,
                start_time: startTime,
                end_time: calculatedEndTime || startTime,
                duration: duration,
                shift_type: appt.shiftType || appt.shift_type || 'full',
                appointment_type: appt.appointmentType || appt.appointment_type || 'general',
                profile: appt.profile || 'g',
                is_vip_link: appt.isVipLink || appt.is_vip_link || false,
                assign_by_admin: appt.assignByAdmin || appt.assign_by_admin || false,
                status: appt.status || 'confirmed',
                kvkk_consent: appt.kvkkConsent || appt.kvkk_consent || false,
            });

            if (error) throw error;
            migrated++;
        } catch (error) {
            console.error(`  HATA: Randevu ${appt.date} ${appt.customerName}: ${error}`);
            errors++;
        }
    }

    addStats('appointments', allAppointments.length, migrated, errors);
}

/**
 * 6-10. Generic table migration (notification_flows, whatsapp_templates, etc.)
 */
async function migrateGenericTable(
    supabase: SupabaseClient,
    gasUrl: string,
    gasAction: string,
    tableName: string,
    transformFn: (item: any) => Record<string, unknown>,
    dryRun: boolean
): Promise<void> {
    console.log(`\n${tableName} migrasyon basliyor...`);

    let items: any[] = [];
    try {
        const gasData = await gasCall(gasUrl, gasAction);
        items = Array.isArray(gasData) ? gasData : (gasData.data || gasData[tableName] || []);
    } catch (error) {
        console.warn(`  ${tableName} verisi yuklenemedi:`, error);
        addStats(tableName, 0, 0, 0);
        return;
    }

    if (items.length === 0 || dryRun) {
        addStats(tableName, items.length, dryRun ? items.length : 0, 0);
        return;
    }

    const rows = items.map(transformFn);

    // Batch insert (100'erlik gruplar)
    let migrated = 0;
    let errors = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(tableName).insert(batch);

        if (error) {
            console.error(`  ${tableName} batch ${i} hatasi:`, error);
            errors += batch.length;
        } else {
            migrated += batch.length;
        }
    }

    addStats(tableName, items.length, migrated, errors);
}

// ==================== MAIN ====================

async function main(): Promise<void> {
    console.log('================================================');
    console.log('  GAS -> Supabase Migrasyon Script\'i');
    console.log('================================================\n');

    const config = loadConfig();

    if (config.DRY_RUN) {
        console.log('*** DRY RUN MODU - Veritabanina yazilmayacak ***\n');
    }

    // Validate config
    if (!config.GAS_URL || !config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Eksik konfigrasyon! .env.migration dosyasini kontrol edin.');
        process.exit(1);
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    // Test connection
    const { error: testError } = await supabase.from('settings').select('key').limit(1);
    if (testError) {
        console.error('Supabase baglanti hatasi:', testError.message);
        process.exit(1);
    }
    console.log('Supabase baglantisi basarili.\n');

    // ---- MIGRATION SEQUENCE ----

    // 1. Staff (+ Auth users)
    const staffIdMap = await migrateStaff(supabase, config.GAS_URL, config.DEFAULT_PASSWORD, config.DRY_RUN);

    // 2. Shifts
    await migrateShifts(supabase, config.GAS_URL, staffIdMap, config.DRY_RUN);

    // 3. Settings
    await migrateSettings(supabase, config.GAS_URL, config.DRY_RUN);

    // 4. Profile settings - seed'den geliyor, skip (003_seed_data.sql)
    console.log('\n4. Profile settings: Seed data\'dan yuklendi (skip)');

    // 5. Appointments
    await migrateAppointments(supabase, config.GAS_URL, staffIdMap, config.DRY_RUN);

    // 6. Notification flows
    await migrateGenericTable(supabase, config.GAS_URL, 'getUnifiedFlows', 'notification_flows',
        (item) => ({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            trigger: item.trigger || '',
            profiles: item.profiles || [],
            whatsapp_template_ids: item.whatsappTemplateIds || item.whatsapp_template_ids || [],
            mail_template_ids: item.mailTemplateIds || item.mail_template_ids || [],
            active: item.active !== false,
        }),
        config.DRY_RUN
    );

    // 7. WhatsApp templates
    await migrateGenericTable(supabase, config.GAS_URL, 'getWhatsAppTemplates', 'whatsapp_templates',
        (item) => ({
            id: item.id,
            name: item.name || '',
            meta_template_name: item.metaTemplateName || item.meta_template_name || '',
            description: item.description || '',
            content: item.content || '',
            variable_count: item.variableCount || item.variable_count || 0,
            variables: item.variables || [],
            target_type: item.targetType || item.target_type || 'customer',
            language: item.language || 'tr',
            has_button: item.hasButton || item.has_button || false,
            button_variable: item.buttonVariable || item.button_variable || '',
            active: item.active !== false,
        }),
        config.DRY_RUN
    );

    // 8. Mail templates
    await migrateGenericTable(supabase, config.GAS_URL, 'getMailTemplates', 'mail_templates',
        (item) => ({
            id: item.id,
            name: item.name || '',
            subject: item.subject || '',
            body: item.body || '',
            recipient: item.recipient || 'customer',
            info_card_id: item.infoCardId || item.info_card_id || null,
        }),
        config.DRY_RUN
    );

    // 9. Mail info cards
    await migrateGenericTable(supabase, config.GAS_URL, 'getMailInfoCards', 'mail_info_cards',
        (item) => ({
            id: item.id,
            name: item.name || '',
            fields: item.fields || [],
        }),
        config.DRY_RUN
    );

    // 10. Daily tasks
    await migrateGenericTable(supabase, config.GAS_URL, 'getWhatsAppDailyTasks', 'daily_tasks',
        (item) => ({
            id: item.id,
            name: item.name || '',
            schedule: item.schedule || '',
            action: item.action || '',
            params: item.params || {},
            active: item.active !== false,
            last_run: item.lastRun || item.last_run || null,
        }),
        config.DRY_RUN
    );

    // 11-12. Audit log & Message log (opsiyonel)
    if (!config.SKIP_AUDIT_LOG) {
        console.log('\n11. Audit log: Manuel migrasyon gerekli (buyuk veri seti)');
    } else {
        console.log('\n11. Audit log: Atlanacak (SKIP_AUDIT_LOG=true)');
    }

    if (!config.SKIP_MESSAGE_LOG) {
        console.log('12. Message log: Manuel migrasyon gerekli (buyuk veri seti)');
    } else {
        console.log('12. Message log: Atlanacak (SKIP_MESSAGE_LOG=true)');
    }

    // ---- SUMMARY ----
    console.log('\n================================================');
    console.log('  MIGRASYON OZETI');
    console.log('================================================');
    console.log(`${'Tablo'.padEnd(25)} ${'Kaynak'.padStart(8)} ${'Migre'.padStart(8)} ${'Hata'.padStart(8)} ${'Atlanan'.padStart(8)}`);
    console.log('-'.repeat(60));

    let totalSource = 0, totalMigrated = 0, totalErrors = 0;
    for (const s of stats) {
        console.log(`${s.table.padEnd(25)} ${String(s.source).padStart(8)} ${String(s.migrated).padStart(8)} ${String(s.errors).padStart(8)} ${String(s.skipped).padStart(8)}`);
        totalSource += s.source;
        totalMigrated += s.migrated;
        totalErrors += s.errors;
    }
    console.log('-'.repeat(60));
    console.log(`${'TOPLAM'.padEnd(25)} ${String(totalSource).padStart(8)} ${String(totalMigrated).padStart(8)} ${String(totalErrors).padStart(8)}`);

    if (totalErrors > 0) {
        console.log('\n*** HATALAR MEVCUT - Logları kontrol edin! ***');
    } else {
        console.log('\nMigrasyon basariyla tamamlandi!');
    }

    // Sonuclari dosyaya kaydet
    writeFileSync(
        resolve(__dirname, 'migration-results.json'),
        JSON.stringify({ stats, timestamp: new Date().toISOString(), dryRun: config.DRY_RUN }, null, 2)
    );
    console.log('\nSonuclar kaydedildi: migration-results.json');
}

main().catch(error => {
    console.error('Beklenmeyen hata:', error);
    process.exit(1);
});
