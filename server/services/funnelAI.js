/**
 * Funnel AI Service
 * Analyzes lead behavior and messages to automatically progress leads through the sales funnel.
 */

// Funnel Stages in order
const FUNNEL_STAGES = [
    'LEAD',        // New contact, not yet reached
    'CONTACTED',   // First message sent
    'ENGAGED',     // Lead replied
    'QUALIFIED',   // Shows buying intent
    'PROPOSAL',    // Sent pricing/booking link
    'NEGOTIATION', // Active back-and-forth
    'WON',         // Converted/booked
    'LOST'         // Opted out or unresponsive
];

// Keywords that indicate positive intent (move toward QUALIFIED)
const POSITIVE_KEYWORDS = [
    'interested', 'tell me more', 'pricing', 'cost', 'how much',
    'demo', 'schedule', 'meeting', 'call me', 'sounds good',
    'yes', 'let\'s do it', 'sign up', 'book', 'available',
    'want to learn', 'need', 'looking for', 'help me'
];

// Keywords that indicate negative intent (move toward LOST)
const NEGATIVE_KEYWORDS = [
    'not interested', 'no thanks', 'stop', 'unsubscribe', 'remove',
    'don\'t contact', 'wrong number', 'harassment', 'block',
    'already have', 'not looking', 'never', 'go away'
];

// Keywords that indicate a proposal was sent
const PROPOSAL_KEYWORDS = [
    'sent you', 'pricing', 'proposal', 'quote', 'offer',
    'calendar', 'booking link', 'schedule a time'
];

/**
 * Analyze message sentiment (simple keyword-based)
 */
function analyzeSentiment(message) {
    if (!message) return { sentiment: 'NEUTRAL', score: 0 };

    const text = message.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;

    POSITIVE_KEYWORDS.forEach(kw => {
        if (text.includes(kw)) positiveScore++;
    });

    NEGATIVE_KEYWORDS.forEach(kw => {
        if (text.includes(kw)) negativeScore++;
    });

    if (negativeScore > positiveScore) {
        return { sentiment: 'NEGATIVE', score: -negativeScore };
    } else if (positiveScore > negativeScore) {
        return { sentiment: 'POSITIVE', score: positiveScore };
    }

    return { sentiment: 'NEUTRAL', score: 0 };
}

/**
 * Check if message contains proposal keywords
 */
function hasProposalKeywords(message) {
    if (!message) return false;
    const text = message.toLowerCase();
    return PROPOSAL_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Calculate days since last activity
 */
function daysSinceActivity(lastActivity) {
    if (!lastActivity) return 999;
    const diff = Date.now() - new Date(lastActivity).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get the next logical stage based on current state
 */
function getStageIndex(stage) {
    return FUNNEL_STAGES.indexOf(stage);
}

/**
 * Analyze lead and determine if stage should change
 * @param {Object} lead - The lead object
 * @param {Object} message - The latest message (if any)
 * @param {string} eventType - Type of event triggering analysis
 * @returns {Object} { shouldChange, newStage, confidence, reason }
 */
function analyzeAndProgress(lead, message = null, eventType = 'MESSAGE') {
    const currentStage = lead.funnel_stage || 'LEAD';
    const currentIndex = getStageIndex(currentStage);

    // If stage is locked or already WON/LOST, don't change
    if (lead.stage_locked || currentStage === 'WON' || currentStage === 'LOST') {
        return { shouldChange: false, reason: 'Stage locked or terminal' };
    }

    let newStage = currentStage;
    let confidence = 0;
    let reason = '';

    // === EVENT-BASED TRANSITIONS ===

    // Event: First outbound message sent
    if (eventType === 'OUTBOUND_MESSAGE' && currentStage === 'LEAD') {
        newStage = 'CONTACTED';
        confidence = 95;
        reason = 'First outreach message sent';
    }

    // Event: Inbound message received
    else if (eventType === 'INBOUND_MESSAGE' && message) {
        const { sentiment, score } = analyzeSentiment(message.content);

        // Negative response -> LOST
        if (sentiment === 'NEGATIVE') {
            newStage = 'LOST';
            confidence = 85;
            reason = `Negative response detected: "${message.content?.substring(0, 50)}..."`;
        }
        // Positive response
        else if (sentiment === 'POSITIVE') {
            // If high positive score, move to QUALIFIED
            if (score >= 2 && currentIndex < getStageIndex('QUALIFIED')) {
                newStage = 'QUALIFIED';
                confidence = 90;
                reason = 'Strong buying intent detected';
            }
            // Otherwise move to ENGAGED
            else if (currentIndex < getStageIndex('ENGAGED')) {
                newStage = 'ENGAGED';
                confidence = 80;
                reason = 'Lead replied with interest';
            }
            // If already QUALIFIED+, move to NEGOTIATION
            else if (currentIndex >= getStageIndex('QUALIFIED') && currentIndex < getStageIndex('NEGOTIATION')) {
                newStage = 'NEGOTIATION';
                confidence = 75;
                reason = 'Multiple positive exchanges';
            }
        }
        // Neutral response - at least mark as ENGAGED
        else if (currentIndex < getStageIndex('ENGAGED')) {
            newStage = 'ENGAGED';
            confidence = 70;
            reason = 'Lead replied';
        }
    }

    // Event: Proposal/booking link sent
    else if (eventType === 'OUTBOUND_MESSAGE' && message && hasProposalKeywords(message.content)) {
        if (currentIndex < getStageIndex('PROPOSAL')) {
            newStage = 'PROPOSAL';
            confidence = 85;
            reason = 'Pricing/booking information sent';
        }
    }

    // === TIME-BASED TRANSITIONS ===

    // Check for cold leads (no activity in 14+ days)
    const daysSince = daysSinceActivity(lead.last_activity || lead.last_contacted_at);
    if (daysSince >= 14 && currentStage !== 'WON' && currentStage !== 'LOST') {
        newStage = 'LOST';
        confidence = 60;
        reason = `No activity for ${daysSince} days`;
    }

    // Only return change if stage actually changed
    if (newStage !== currentStage) {
        return {
            shouldChange: true,
            newStage,
            confidence,
            reason,
            fromStage: currentStage
        };
    }

    return { shouldChange: false, reason: 'No stage change needed' };
}

/**
 * Get warning for leads going cold
 */
function getLeadWarning(lead) {
    const daysSince = daysSinceActivity(lead.last_activity || lead.last_contacted_at);
    const currentStage = lead.funnel_stage || 'LEAD';

    if (currentStage === 'WON' || currentStage === 'LOST') return null;

    if (daysSince >= 7 && daysSince < 14) {
        return {
            type: 'GOING_COLD',
            message: `No activity for ${daysSince} days - consider follow-up`,
            severity: 'WARNING'
        };
    }

    if (daysSince >= 14) {
        return {
            type: 'COLD',
            message: `Lead has been inactive for ${daysSince} days`,
            severity: 'CRITICAL'
        };
    }

    return null;
}

/**
 * Get funnel statistics
 */
function getFunnelStats(leads) {
    const stats = {};

    FUNNEL_STAGES.forEach(stage => {
        stats[stage] = {
            count: 0,
            leads: []
        };
    });

    leads.forEach(lead => {
        const stage = lead.funnel_stage || 'LEAD';
        if (stats[stage]) {
            stats[stage].count++;
            stats[stage].leads.push(lead.id);
        }
    });

    // Calculate conversion rates
    const totalLeads = leads.length;
    const wonLeads = stats['WON'].count;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    return {
        stages: stats,
        totalLeads,
        wonLeads,
        lostLeads: stats['LOST'].count,
        conversionRate,
        activeLeads: totalLeads - stats['WON'].count - stats['LOST'].count
    };
}

module.exports = {
    FUNNEL_STAGES,
    analyzeAndProgress,
    analyzeSentiment,
    getLeadWarning,
    getFunnelStats,
    hasProposalKeywords
};
