/**
 * Reports Export Service
 * Generates CSV and PDF exports of analytics data
 */

const { query } = require('../db');

/**
 * Export leads to CSV format
 * @param {object} filters - Optional filters
 * @returns {string} CSV content
 */
async function exportLeadsCSV(filters = {}) {
    let sql = 'SELECT * FROM leads';
    const conditions = [];
    const params = [];

    if (filters.status) {
        params.push(filters.status);
        conditions.push(`status = $${params.length}`);
    }

    if (filters.campaign) {
        params.push(filters.campaign);
        conditions.push(`campaign = $${params.length}`);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const res = await query(sql, params);
    const leads = res.rows;

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
async function exportMessagesCSV(leadId = null) {
    let sql = `
        SELECT m.*, l.name as lead_name, l.email as lead_email
        FROM messages m
        LEFT JOIN leads l ON m.lead_id = l.id
    `;

    const params = [];
    if (leadId) {
        params.push(leadId);
        sql += ` WHERE m.lead_id = $${params.length}`;
    }

    sql += ' ORDER BY m.created_at DESC';

    const res = await query(sql, params);
    const messages = res.rows;

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
async function exportAnalyticsCSV() {
    const [totalLeadsRes, activeLeadsRes, totalSentRes, totalRepliesRes] = await Promise.all([
        query('SELECT COUNT(*) as count FROM leads'),
        query("SELECT COUNT(*) as count FROM leads WHERE status = 'ACTIVE'"),
        query("SELECT COUNT(*) as count FROM messages WHERE direction = 'OUTBOUND'"),
        query("SELECT COUNT(*) as count FROM messages WHERE direction = 'INBOUND'")
    ]);

    const totalLeads = parseInt(totalLeadsRes.rows[0].count);
    const activeLeads = parseInt(activeLeadsRes.rows[0].count);
    const totalSent = parseInt(totalSentRes.rows[0].count);
    const totalReplies = parseInt(totalRepliesRes.rows[0].count);

    // Channel breakdown
    const channels = ['SMS', 'EMAIL', 'CALL', 'LINKEDIN'];

    // Parallelize channel stats queries
    const channelStatsPromises = channels.map(async (ch) => {
        const [sentRes, repliesRes] = await Promise.all([
            query("SELECT COUNT(*) as count FROM messages WHERE type = $1 AND direction = 'OUTBOUND'", [ch]),
            query("SELECT COUNT(*) as count FROM messages WHERE type = $1 AND direction = 'INBOUND'", [ch])
        ]);
        return {
            channel: ch,
            sent: parseInt(sentRes.rows[0].count),
            replies: parseInt(repliesRes.rows[0].count)
        };
    });

    const channelStats = await Promise.all(channelStatsPromises);

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
async function exportTasksCSV(status = null) {
    let sql = `
        SELECT t.*, l.name as lead_name, l.email as lead_email
        FROM tasks t
        LEFT JOIN leads l ON t.lead_id = l.id
    `;

    const params = [];
    if (status) {
        params.push(status);
        sql += ` WHERE t.status = $${params.length}`;
    }

    sql += ' ORDER BY t.due_date ASC';

    const res = await query(sql, params);
    const tasks = res.rows;

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
async function generatePerformanceReport(dateRange = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    const startStr = startDate.toISOString();

    // Daily activity
    const dailyActivityRes = await query(`
        SELECT created_at::date as date, 
               COUNT(*) as total,
               SUM(CASE WHEN direction = 'OUTBOUND' THEN 1 ELSE 0 END) as sent,
               SUM(CASE WHEN direction = 'INBOUND' THEN 1 ELSE 0 END) as received
        FROM messages
        WHERE created_at >= $1
        GROUP BY created_at::date
        ORDER BY date ASC
    `, [startStr]);

    // Top performing channels
    const channelPerformanceRes = await query(`
        SELECT type,
               COUNT(*) as total,
               SUM(CASE WHEN direction = 'INBOUND' THEN 1 ELSE 0 END) as replies
        FROM messages
        WHERE created_at >= $1
        GROUP BY type
        ORDER BY replies DESC
    `, [startStr]);

    return {
        dateRange,
        generatedAt: new Date().toISOString(),
        dailyActivity: dailyActivityRes.rows,
        channelPerformance: channelPerformanceRes.rows
    };
}

module.exports = {
    exportLeadsCSV,
    exportMessagesCSV,
    exportAnalyticsCSV,
    exportTasksCSV,
    generatePerformanceReport
};
