// Model availability varies by project and changes over time. Only use an alternate
// advertised by Google's authenticated models.list endpoint as supporting generateContent.
async function selectAlternateModel(apiKey, primaryModel, preferred, { request, timeout }) {
    try {
        const response = await request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
            method: 'GET', headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(timeout)
        });
        if (!response.ok) throw new Error('Model discovery unavailable');
        const body = await response.json();
        const available = (Array.isArray(body.models) ? body.models : [])
            .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
            .map(model => model.name?.replace(/^models\//, ''))
            .filter(name => typeof name === 'string' && /^gemini-\d+(?:\.\d+)*-flash(?:-lite)?$/.test(name) && name !== primaryModel);
        available.sort((a, b) => Number(b.endsWith('-lite')) - Number(a.endsWith('-lite')) || b.localeCompare(a, 'en', { numeric: true }));
        const selected = available.includes(preferred) ? preferred : available[0];
        if (!selected) throw new Error('No alternate text model available');
        console.info(`[resume-verification] FALLBACK_MODEL=${selected}`);
        return selected;
    } catch {
        // Discovery errors never justify accepting a document or logging provider bodies.
        console.warn('[resume-verification] MODEL_DISCOVERY_UNAVAILABLE');
        return preferred;
    }
}

module.exports = { selectAlternateModel };
