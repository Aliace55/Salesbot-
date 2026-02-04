/**
 * Shared IMAP Client
 * Handles connections and email searching for BounceMonitor and MeetingMonitor
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');

/**
 * Connect to IMAP and perform a search
 * @param {Array} searchCriteria - IMAP search filters
 * @param {Function} emailProcessor - Callback for each email found
 * @returns {Promise<number>} Number of emails processed
 */
function searchEmails(searchCriteria, emailProcessor) {
    return new Promise((resolve, reject) => {
        let processedCount = 0;

        const imap = new Imap({
            user: process.env.EMAIL_USER,
            password: process.env.EMAIL_PASS,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000
        });

        // Search timeout (60s)
        const timeout = setTimeout(() => {
            console.log('[IMAP Client] Search timed out');
            try { imap.end(); } catch (e) { }
            resolve(processedCount);
        }, 60000);

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    console.error('[IMAP Client] Error opening inbox:', err.message);
                    clearTimeout(timeout);
                    imap.end();
                    return resolve(0);
                }

                imap.search(searchCriteria, (err, results) => {
                    if (err) {
                        console.error('[IMAP Client] Search error:', err.message);
                        clearTimeout(timeout);
                        imap.end();
                        return resolve(0);
                    }

                    if (!results || results.length === 0) {
                        clearTimeout(timeout);
                        imap.end();
                        return resolve(0);
                    }

                    console.log(`[IMAP Client] Found ${results.length} messages matching criteria`);

                    const fetch = imap.fetch(results, { bodies: '', markSeen: true });
                    const processingPromises = [];

                    fetch.on('message', (msg) => {
                        const promise = new Promise((pResolve) => {
                            msg.on('body', (stream) => {
                                simpleParser(stream, async (err, parsed) => {
                                    if (err) {
                                        console.error('[IMAP Client] Parse error:', err);
                                        return pResolve();
                                    }

                                    try {
                                        await emailProcessor(parsed);
                                        processedCount++;
                                    } catch (procErr) {
                                        console.error('[IMAP Client] Processing callback error:', procErr);
                                    }
                                    pResolve();
                                });
                            });
                        });
                        processingPromises.push(promise);
                    });

                    fetch.once('error', (err) => {
                        console.error('[IMAP Client] Fetch error:', err);
                    });

                    fetch.once('end', async () => {
                        // Wait for all parsing to finish
                        await Promise.all(processingPromises);
                        clearTimeout(timeout);
                        imap.end();
                        resolve(processedCount);
                    });
                });
            });
        });

        imap.once('error', (err) => {
            // Silence common connection errors if they happen during teardown
            if (err.message !== 'Connection ended unexpectedly') {
                console.error('[IMAP Client] Connection error:', err.message);
            }
            clearTimeout(timeout);
            resolve(processedCount);
        });

        imap.connect();
    });
}

/**
 * Helper to get clean email from text string
 * @param {string} text - Text containing email
 * @returns {string|null} Extracted email or null
 */
function extractEmail(text) {
    if (!text) return null;
    const match = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return match ? match[1].toLowerCase() : null;
}

module.exports = {
    searchEmails,
    extractEmail
};
