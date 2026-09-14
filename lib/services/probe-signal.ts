// What a failed probe actually tells us about the provider.
//
// For six days the Claude page said "having issues — not yet acknowledged"
// because OUR Anthropic account had no credit (HTTP 400), and the Le Chat
// page said the same because OUR Mistral key was rate-limited (HTTP 429).
// Neither is evidence about the provider. Only failures the provider is
// responsible for may open a gap, colour a verdict, or paint a red tick.

const OUTAGE_PATTERNS = [/^http-5\d\d$/, /^timeout/, /^network/, /^dns/, /^connection/, /^semantic_mismatch$/];
const OUR_PROBLEM_PATTERNS = [/^http-4\d\d$/, /^missing_/, /^config/];

// A bot challenge or similar: the request was answered by an edge that
// refused to show us the app. Says nothing either way — not a sample at all.
export function isUnverifiable(errorCode?: string | null): boolean {
    return errorCode === 'bot_wall';
}

export function isOutageEvidence(errorCode?: string | null): boolean {
    if (!errorCode) return false;
    return OUTAGE_PATTERNS.some((re) => re.test(errorCode));
}

// A failure caused by our side of the request: billing, auth, quota, a
// malformed call. These must never reach the public — but they must reach us.
export function isProbeMisconfiguration(errorCode?: string | null): boolean {
    if (!errorCode) return false;
    return OUR_PROBLEM_PATTERNS.some((re) => re.test(errorCode));
}
