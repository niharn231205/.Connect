const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const { selectAlternateModel } = require('./geminiModels');

// At most two primary attempts and one alternate-model attempt, within 45 seconds.
// Every attempt still asks Gemini for a full structured verdict; no local acceptance fallback.
async function requestGemini(body, apiKey, primaryModel, {
    request = globalThis.fetch, wait = delay, random = Math.random, now = Date.now,
    selectAlternate = selectAlternateModel, perAttemptMs = 15000, totalBudgetMs = 45000
} = {}) {
    const alternate = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.5-flash-lite';
    const models = [primaryModel, primaryModel];
    if (alternate !== 'none') models.push(alternate);
    const deadline = now() + totalBudgetMs;
    for (let attempt = 0; attempt < models.length; attempt++) {
        if (attempt === 2) {
            const timeout = Math.min(5000, deadline - now());
            if (timeout <= 0) throw new DOMException('Verification timed out', 'TimeoutError');
            models[attempt] = await selectAlternate(apiKey, primaryModel, alternate, { request, timeout });
        }
        const remaining = deadline - now();
        if (remaining <= 0) throw new DOMException('Verification timed out', 'TimeoutError');
        let response;
        try {
            response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(models[attempt])}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: AbortSignal.timeout(Math.min(perAttemptMs, remaining)),
                body: JSON.stringify(body)
            });
        } catch (error) {
            const transient = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
            if (!transient || attempt === models.length - 1) throw error;
        }
        if (response && (!RETRYABLE_STATUS.has(response.status) || attempt === models.length - 1)) {
            return { response, model: models[attempt] };
        }
        const retryHeader = response?.headers?.get('retry-after');
        const retryAfter = Number.isFinite(Number(retryHeader)) ? Number(retryHeader)
            : (Date.parse(retryHeader) - now()) / 1000;
        // Respect a long server-requested delay rather than immediately retrying it.
        if (Number.isFinite(retryAfter) && retryAfter > 5) return { response, model: models[attempt] };
        const backoff = Math.max(1000 * 2 ** attempt + Math.floor(random() * 250),
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0);
        if (deadline - now() <= backoff + 1000) {
            if (response) return { response, model: models[attempt] };
            throw new DOMException('Verification timed out', 'TimeoutError');
        }
        if (response?.body) await response.body.cancel().catch(() => {});
        console.warn(`[resume-verification] RETRY_${attempt + 1}${response ? ` (HTTP ${response.status})` : ' (connection/timeout)'}${attempt === 1 ? '; MODEL_FALLBACK' : ''}`);
        await wait(backoff);
    }
}

module.exports = { requestGemini };
