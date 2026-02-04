/**
 * Lead Source Detection & Type Classification
 * Determines if a lead is INBOUND (hot) or OUTBOUND (cold) based on source.
 */

// Source patterns for classification
const INBOUND_SOURCES = {
    google: ['google', 'gclid', 'adwords', 'ppc'],
    facebook: ['facebook', 'fb', 'fbclid', 'meta', 'instagram', 'ig'],
    website: ['organic', 'website', 'form', 'contact', 'web', 'landing'],
    referral: ['referral', 'refer', 'word-of-mouth', 'partner']
};

const OUTBOUND_SOURCES = {
    cold_email: ['cold', 'outbound', 'list', 'prospect', 'csv', 'import'],
    linkedin: ['linkedin', 'li', 'connection'],
    cold_call: ['call', 'dialer', 'phone_list']
};

/**
 * Detect lead type and source from various inputs
 * @param {string} source - The source field or any identifying data
 * @param {string} campaign - Campaign name if available
 * @param {string} notes - Any notes that might contain source info
 * @returns {Object} { leadType, leadSource, isHot }
 */
function detectLeadType(source, campaign = '', notes = '') {
    const combined = `${source || ''} ${campaign || ''} ${notes || ''}`.toLowerCase();

    // Check inbound sources
    for (const [sourceType, patterns] of Object.entries(INBOUND_SOURCES)) {
        if (patterns.some(p => combined.includes(p))) {
            return {
                leadType: 'INBOUND',
                leadSource: sourceType,
                isHot: 1
            };
        }
    }

    // Check outbound sources
    for (const [sourceType, patterns] of Object.entries(OUTBOUND_SOURCES)) {
        if (patterns.some(p => combined.includes(p))) {
            return {
                leadType: 'OUTBOUND',
                leadSource: sourceType,
                isHot: 0
            };
        }
    }

    // Default to outbound (cold) if unknown
    return {
        leadType: 'OUTBOUND',
        leadSource: 'unknown',
        isHot: 0
    };
}

/**
 * Get display info for a lead source
 */
function getSourceDisplay(leadSource) {
    const displays = {
        google: { label: 'Google Ads', icon: '🔍', color: 'blue' },
        facebook: { label: 'Facebook', icon: '📘', color: 'indigo' },
        website: { label: 'Website', icon: '🌐', color: 'green' },
        referral: { label: 'Referral', icon: '🤝', color: 'purple' },
        cold_email: { label: 'Cold Email', icon: '📧', color: 'slate' },
        linkedin: { label: 'LinkedIn', icon: '💼', color: 'sky' },
        cold_call: { label: 'Cold Call', icon: '📞', color: 'slate' },
        unknown: { label: 'Unknown', icon: '❓', color: 'slate' }
    };

    return displays[leadSource] || displays.unknown;
}

/**
 * Get stats by lead type
 */
function getLeadTypeStats(leads) {
    const inbound = leads.filter(l => l.lead_type === 'INBOUND');
    const outbound = leads.filter(l => l.lead_type === 'OUTBOUND' || !l.lead_type);

    return {
        inbound: {
            total: inbound.length,
            bySource: groupBySource(inbound),
            hotLeads: inbound.filter(l => l.is_hot).length
        },
        outbound: {
            total: outbound.length,
            bySource: groupBySource(outbound)
        }
    };
}

function groupBySource(leads) {
    const groups = {};
    leads.forEach(l => {
        const source = l.lead_source || 'unknown';
        groups[source] = (groups[source] || 0) + 1;
    });
    return groups;
}

module.exports = {
    detectLeadType,
    getSourceDisplay,
    getLeadTypeStats,
    INBOUND_SOURCES,
    OUTBOUND_SOURCES
};
