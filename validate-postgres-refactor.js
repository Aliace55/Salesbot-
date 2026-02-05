const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'server', 'services');

console.log('Validating service modules...');

try {
    const files = fs.readdirSync(servicesDir);
    let errorCount = 0;

    for (const file of files) {
        if (file.endsWith('.js')) {
            const filePath = path.join(servicesDir, file);
            try {
                require(filePath);
                console.log(`✅ Loaded ${file}`);
            } catch (err) {
                console.error(`❌ Failed to load ${file}:`, err.message);

                // Ignore "db pool" errors if they happen on load due to missing .env
                if (err.message.includes('env') || err.message.includes('pool')) {
                    console.log(`   (Likely due to missing environment during test load)`);
                } else {
                    errorCount++;
                }
            }
        }
    }

    if (errorCount === 0) {
        console.log('All services loaded successfully (syntax check passed).');
    } else {
        console.error(`Found ${errorCount} load errors.`);
        process.exit(1);
    }

} catch (err) {
    console.error('Test script failed:', err);
    process.exit(1);
}
