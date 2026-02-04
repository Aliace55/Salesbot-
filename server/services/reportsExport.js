/**
 * Reports Export Service
 * Generates CSV and PDF exports of analytics data
 */

const { db } = require('../db');

/**
 * Export leads to CSV format
 * @param {object} filters - Optional filters
 * @returns {string} CSV content
 */
function exportLeadsCSV(filters = {}) {
    let query = 'SELECT * FROM leads';
    const conditions = [];
    const params = [];

    if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
    }

    if (filters.campaign) {
        conditions.push('campaign = ?');
        params.push(filters.campaign);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const leads = db.prepare(query).all(...params);

    // Generate CSV header
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Product Interest', 'Source', 'Campaign', 'Status', 'Step', 'Last Contacted', 'Created'];

    const rows = leads.map(lead => [
        lead.id,
        lead.name || '',
        lead.phone || '',
        lead.email || '',
        lead.product_interest || '',
        lead.source || '',
        lead.campaign || '',
        lead.status || '',
        lead.step || 0,
        lead.last_contacted_at || '',
        lead.created_at || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Export messages/activity to CSV
 */
function exportMessagesCSV(leadId = null) {
    let query = `
        SELECT m.*, l.name as lead_name, l.email as lead_email
        FROM messages m
        LEFT JOIN leads l ON m.lead_id = l.id
    `;

    const params = [];
    if (leadId) {
        query += ' WHERE m.lead_id = ?';
        params.push(leadId);
    }

    query += ' ORDER BY m.created_at DESC';

    const messages = db.prepare(query).all(...params);

    const headers = ['ID', 'Lead Name', 'Lead Email', 'Type', 'Direction', 'Content', 'Variant', 'Classification', 'Created'];

    const rows = messages.map(msg => [
        msg.id,
        msg.lead_name || '',
        msg.lead_email || '',
        msg.type || '',
        msg.direction || '',
        (msg.content || '').substring(0, 100).replace(/\n/g, ' '),
        msg.variant || '',
        msg.classification || '',
        msg.created_at || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Export analytics summary to CSV
 */
function exportAnalyticsCSV() {
    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    const activeLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'ACTIVE'").get().count;
    const totalSent = db.prepare("SELECT COUNT(*) as count FROM messages WHERE direction = 'OUTBOUND'").get().count;
    const totalReplies = db.prepare("SELECT COUNT(*) as count FROM messages WHERE direction = 'INBOUND'").get().count;

    // Channel breakdown
    const channels = ['SMS', 'EMAIL', 'CALL', 'LINKEDIN'];
    const channelStats = channels.map(ch => {
        const sent = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE type = ? AND direction = 'OUTBOUND'`).get(ch).count;
        const replies = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE type = ? AND direction = 'INBOUND'`).get(ch).count;
        return { channel: ch, sent, replies };
    });

    let csv = 'SUMMARY REPORT\n';
    csv += `Generated,${new Date().toISOString()}\n\n`;
    csv += 'OVERVIEW\n';
    csv += `Total Leads,${totalLeads}\n`;
    csv += `Active Leads,${activeLeads}\n`;
    csv += `Total Sent,${totalSent}\n`;
    csv += `Total Replies,${totalReplies}\n\n`;
    csv += 'CHANNEL BREAKDOWN\n';
    csv += 'Channel,Sent,Replies,Reply Rate\n';

    channelStats.forEach(ch => {
        const rate = ch.sent > 0 ? ((ch.replies / ch.sent) * 100).toFixed(1) : 0;
        csv += `${ch.channel},${ch.sent},${ch.replies},${rate}%\n`;
    });

    return csv;
}

/**
 * Export tasks to CSV
 */
function exportTasksCSV(status = null) {
    let query = `
        SELECT t.*, l.name as lead_name, l.email as lead_email
        FROM tasks t
        LEFT JOIN leads l ON t.lead_id = l.id
    `;

    const params = [];
    if (status) {
        query += ' WHERE t.status = ?';
        params.push(status);
    }

    query += ' ORDER BY t.due_date ASC';

    const tasks = db.prepare(query).all(...params);

    const headers = ['ID', 'Lead Name', 'Lead Email', 'Type', 'Title', 'Description', 'Due Date', 'Status', 'Completed At'];

    const rows = tasks.map(task => [
        task.id,
        task.lead_name || '',
        task.lead_email || '',
        task.type || '',
        task.title || '',
        (task.description || '').substring(0, 50),
        task.due_date || '',
        task.status || '',
        task.completed_at || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate a performance report object (for JSON or rendering)
 */
function generatePerformanceReport(dateRange = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    const startStr = startDate.toISOString();

    // Daily activity
    const dailyActivity = db.prepare(`
        SELECT date(created_at) as date, 
               COUNT(*) as total,
               SUM(CASE WHEN direction = 'OUTBOUND' THEN 1 ELSE 0 END) as sent,
               SUM(CASE WHEN direction = 'INBOUND' THEN 1 ELSE 0 END) as received
        FROM messages
        WHERE created_at >= ?
        GROUP BY date(created_at)
        ORDER BY date ASC
    `).all(startStr);

    // Top performing channels
    const channelPerformance = db.prepare(`
        SELECT type,
               COUNT(*) as total,
               SUM(CASE WHEN direction = 'INBOUND' THEN 1 ELSE 0 END) as replies
        FROM messages
        WHERE created_at >= ?
        GROUP BY type
        ORDER BY replies DESC
    `).all(startStr);

    return {
        dateRange,
        generatedAt: new Date().toISOString(),
        dailyActivity,
        channelPerformance
    };
}

module.exports = {
    exportLeadsCSV,
    exportMessagesCSV,
    exportAnalyticsCSV,
    exportTasksCSV,
    generatePerformanceReport
};
