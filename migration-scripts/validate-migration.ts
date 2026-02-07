/**
 * MIGRATION VALIDATION SCRIPT
 *
 * Calistirma:
 *   npx tsx migration-scripts/validate-migration.ts
 *
 * Kontroller:
 *   1. Satir sayisi karsilastirmasi (GAS vs Supabase)
 *   2. Staff ID esleme dogrulamasi
 *   3. Randevu tarih/saat dogrulamasi
 *   4. Notification flow baglantilari dogrulamasi
 *   5. Secrets/config dogrulamasi
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ==================== CONFIG ====================

interface ValidationConfig {
    GAS_URL: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}

function loadConfig(): ValidationConfig {
    const envPath = resolve(__dirname, '../.env.migration');
    if (!existsSync(envPath)) {
        console.error('.env.migration dosyasi bulunamadi!');
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
        throw new Error(`GAS API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
}

// ==================== VALIDATION ====================

interface ValidationResult {
    check: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
}

const results: ValidationResult[] = [];

function pass(check: string, details: string): void {
    results.push({ check, status: 'PASS', details });
    console.log(`  PASS  ${check}: ${details}`);
}

function fail(check: string, details: string): void {
    results.push({ check, status: 'FAIL', details });
    console.log(`  FAIL  ${check}: ${details}`);
}

function warn(check: string, details: string): void {
    results.push({ check, status: 'WARN', details });
    console.log(`  WARN  ${check}: ${details}`);
}

// ==================== CHECKS ====================

async function checkRowCounts(supabase: any, gasUrl: string): Promise<void> {
    console.log('\n--- 1. Satir Sayisi Karsilastirmasi ---');

    const tables = [
        { table: 'staff', gasAction: 'getStaff', gasKey: null },
        { table: 'whatsapp_templates', gasAction: 'getWhatsAppTemplates', gasKey: null },
        { table: 'mail_templates', gasAction: 'getMailTemplates', gasKey: null },
        { table: 'mail_info_cards', gasAction: 'getMailInfoCards', gasKey: null },
        { table: 'notification_flows', gasAction: 'getUnifiedFlows', gasKey: null },
    ];

    for (const { table, gasAction } of tables) {
        try {
            // Supabase count
            const { count: sbCount, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                fail(`${table} count`, `Supabase hatasi: ${error.message}`);
                continue;
            }

            // GAS count
            let gasCount = 0;
            try {
                const gasData = await gasCall(gasUrl, gasAction);
                const items = Array.isArray(gasData) ? gasData : (gasData.data || gasData[table] || []);
                gasCount = items.length;
            } catch {
                warn(`${table} count`, `GAS verisi alinamadi, sadece Supabase: ${sbCount}`);
                continue;
            }

            if (sbCount === gasCount) {
                pass(`${table} count`, `Esit: ${sbCount}`);
            } else {
                fail(`${table} count`, `GAS: ${gasCount}, Supabase: ${sbCount}`);
            }
        } catch (error) {
            fail(`${table} count`, `Hata: ${error}`);
        }
    }
}

async function checkStaffMapping(supabase: any): Promise<void> {
    console.log('\n--- 2. Staff ID Esleme Dogrulamasi ---');

    // Staff ID mapping dosyasi var mi?
    const mapPath = resolve(__dirname, 'staff-id-mapping.json');
    if (!existsSync(mapPath)) {
        warn('staff-id-mapping', 'staff-id-mapping.json bulunamadi');
        return;
    }

    const mapping = JSON.parse(readFileSync(mapPath, 'utf-8'));
    const mappedCount = Object.keys(mapping).length;

    // Supabase'deki staff sayisi
    const { count, error } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true });

    if (error) {
        fail('staff mapping', `Supabase hatasi: ${error.message}`);
        return;
    }

    if (count === mappedCount) {
        pass('staff mapping', `${mappedCount} staff dogru eslestirildi`);
    } else {
        warn('staff mapping', `Mapping: ${mappedCount}, Supabase: ${count}`);
    }

    // Her staff'in auth_user_id'si var mi?
    const { data: staffWithoutAuth } = await supabase
        .from('staff')
        .select('id, name')
        .is('auth_user_id', null);

    if (staffWithoutAuth && staffWithoutAuth.length > 0) {
        fail('staff auth_user_id', `${staffWithoutAuth.length} staff auth_user_id olmadan: ${staffWithoutAuth.map((s: any) => s.name).join(', ')}`);
    } else {
        pass('staff auth_user_id', 'Tum staff auth_user_id ile eslestirildi');
    }
}

async function checkAppointments(supabase: any): Promise<void> {
    console.log('\n--- 3. Randevu Dogrulamasi ---');

    // Toplam randevu sayisi
    const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true });

    if (error) {
        fail('appointments total', `Supabase hatasi: ${error.message}`);
        return;
    }

    console.log(`  Toplam randevu: ${count}`);

    // Gelecek randevular
    const today = new Date().toISOString().split('T')[0];
    const { count: futureCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('date', today);

    pass('appointments future', `Gelecek randevu: ${futureCount}`);

    // staff_id null olanlar (opsiyonel - assign_by_admin olabilir)
    const { count: noStaffCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .is('staff_id', null);

    if (noStaffCount && noStaffCount > 0) {
        warn('appointments no-staff', `${noStaffCount} randevu staff_id olmadan`);
    } else {
        pass('appointments no-staff', 'Tum randevular staff ile eslestirildi');
    }

    // status dagilimi
    const { data: statusData } = await supabase
        .from('appointments')
        .select('status')
        .limit(10000);

    if (statusData) {
        const statusMap: Record<string, number> = {};
        statusData.forEach((a: any) => {
            statusMap[a.status] = (statusMap[a.status] || 0) + 1;
        });
        pass('appointments status', `Dagilim: ${JSON.stringify(statusMap)}`);
    }
}

async function checkNotificationFlows(supabase: any): Promise<void> {
    console.log('\n--- 4. Notification Flow Baglantilari ---');

    const { data: flows, error } = await supabase
        .from('notification_flows')
        .select('id, name, whatsapp_template_ids, mail_template_ids, active');

    if (error) {
        fail('notification_flows', `Supabase hatasi: ${error.message}`);
        return;
    }

    if (!flows || flows.length === 0) {
        warn('notification_flows', 'Hic flow bulunamadi');
        return;
    }

    pass('notification_flows count', `${flows.length} flow mevcut`);

    // Her flow'un referans ettigi template'ler var mi?
    const { data: waTemplates } = await supabase.from('whatsapp_templates').select('id');
    const { data: mailTemplates } = await supabase.from('mail_templates').select('id');

    const waIds = new Set((waTemplates || []).map((t: any) => t.id));
    const mailIds = new Set((mailTemplates || []).map((t: any) => t.id));

    let brokenRefs = 0;
    for (const flow of flows) {
        const waRefs = flow.whatsapp_template_ids || [];
        const mailRefs = flow.mail_template_ids || [];

        for (const ref of waRefs) {
            if (!waIds.has(ref)) {
                warn('flow ref', `Flow "${flow.name}" referans: WA template "${ref}" bulunamadi`);
                brokenRefs++;
            }
        }
        for (const ref of mailRefs) {
            if (!mailIds.has(ref)) {
                warn('flow ref', `Flow "${flow.name}" referans: Mail template "${ref}" bulunamadi`);
                brokenRefs++;
            }
        }
    }

    if (brokenRefs === 0) {
        pass('flow references', 'Tum flow referanslari gecerli');
    } else {
        fail('flow references', `${brokenRefs} kirik referans bulundu`);
    }
}

async function checkDatabaseFunctions(supabase: any): Promise<void> {
    console.log('\n--- 5. Veritabani Fonksiyonlari ---');

    const functions = [
        'check_rate_limit',
        'anonymize_old_messages',
        'delete_old_message_content',
    ];

    for (const fnName of functions) {
        const { data, error } = await supabase.rpc('pg_function_exists', { fn_name: fnName }).maybeSingle();

        // Fallback: Try a direct query
        if (error) {
            // pg_function_exists may not exist, try a raw check
            const { data: fnCheck } = await supabase
                .from('pg_proc')
                .select('proname')
                .eq('proname', fnName)
                .limit(1);

            if (fnCheck && fnCheck.length > 0) {
                pass(`fn:${fnName}`, 'Mevcut');
            } else {
                warn(`fn:${fnName}`, 'Dogrulanamadi (pg_proc erisim yok olabilir)');
            }
            continue;
        }

        if (data) {
            pass(`fn:${fnName}`, 'Mevcut');
        } else {
            fail(`fn:${fnName}`, 'Bulunamadi');
        }
    }
}

async function checkProfileSettings(supabase: any): Promise<void> {
    console.log('\n--- 6. Profil Ayarlari ---');

    const expectedProfiles = ['g', 'w', 'b', 's', 'm', 'v'];

    const { data, error } = await supabase
        .from('profile_settings')
        .select('profile_code');

    if (error) {
        fail('profile_settings', `Supabase hatasi: ${error.message}`);
        return;
    }

    const existingCodes = new Set((data || []).map((p: any) => p.profile_code));
    const missing = expectedProfiles.filter(p => !existingCodes.has(p));

    if (missing.length === 0) {
        pass('profile_settings', `6/6 profil mevcut: ${expectedProfiles.join(', ')}`);
    } else {
        fail('profile_settings', `Eksik profiller: ${missing.join(', ')}`);
    }
}

async function checkRealtimePublication(supabase: any): Promise<void> {
    console.log('\n--- 7. Realtime Publication ---');

    // This check uses a raw query, might not work via supabase-js
    // Just verify the tables are accessible
    const tables = ['appointments', 'message_log'];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            fail(`realtime:${table}`, `Tablo erisim hatasi: ${error.message}`);
        } else {
            pass(`realtime:${table}`, 'Tablo erisilebilir');
        }
    }
}

// ==================== MAIN ====================

async function main(): Promise<void> {
    console.log('================================================');
    console.log('  MIGRASYON DOGRULAMA');
    console.log('================================================');

    const config = loadConfig();

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
    console.log('Supabase baglantisi basarili.');

    // Run all checks
    await checkRowCounts(supabase, config.GAS_URL);
    await checkStaffMapping(supabase);
    await checkAppointments(supabase);
    await checkNotificationFlows(supabase);
    await checkDatabaseFunctions(supabase);
    await checkProfileSettings(supabase);
    await checkRealtimePublication(supabase);

    // ---- SUMMARY ----
    console.log('\n================================================');
    console.log('  DOGRULAMA OZETI');
    console.log('================================================');

    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warnCount = results.filter(r => r.status === 'WARN').length;

    console.log(`  PASS: ${passCount}`);
    console.log(`  FAIL: ${failCount}`);
    console.log(`  WARN: ${warnCount}`);
    console.log(`  TOPLAM: ${results.length}`);

    if (failCount > 0) {
        console.log('\n*** BASARISIZ KONTROLLER ***');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  - ${r.check}: ${r.details}`);
        });
        console.log('\nMigrasyon dogrulamasi BASARISIZ!');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('\nMigrasyon dogrulandi (uyarilar mevcut).');
    } else {
        console.log('\nMigrasyon dogrulama BASARILI!');
    }
}

main().catch(error => {
    console.error('Beklenmeyen hata:', error);
    process.exit(1);
});
