import { IAIProvider, IAIProviderParams, IAIProviderResult } from './ai-assistant.types';
import { MockAIProvider } from './mock-ai.provider';

export class GeminiAIProvider implements IAIProvider {
  private apiKey: string;
  private mockFallback: MockAIProvider;
  private primaryModel: string;

  constructor(apiKey?: string, primaryModel: string = 'gemini-3.8-flash') {
    this.apiKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    this.mockFallback = new MockAIProvider();
    this.primaryModel = primaryModel;
  }

  /**
   * Generates intelligent, role-aware responses using the Google Gemini API
   * with strict database grounding and anti-fabrication instructions.
   */
  public async generateResponse(params: IAIProviderParams): Promise<IAIProviderResult> {
    const {
      prompt,
      role,
      roleNormalized,
      userName,
      projectId,
      projectName,
      conversationHistory = [],
      groundedContext,
    } = params;

    // 1. Enforce strict role & module permission guardrails first
    const cleanRole = (roleNormalized || role || 'USER').toUpperCase();
    const lowerPrompt = prompt.toLowerCase();

    if (['SALES_PERSON', 'SALES', 'SALES_EXECUTIVE'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('petty cash') ||
        lowerPrompt.includes('salary') ||
        lowerPrompt.includes('payroll') ||
        lowerPrompt.includes('disbursement') ||
        lowerPrompt.includes('vendor invoice') ||
        lowerPrompt.includes('bar bending') ||
        lowerPrompt.includes('bbs') ||
        lowerPrompt.includes('offcut') ||
        lowerPrompt.includes('cutting stock')
      ) {
        return this.mockFallback.generateResponse(params);
      }
    }

    if (['STORE_KEEPER', 'STOREKEEPER'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('lead') ||
        lowerPrompt.includes('customer') ||
        lowerPrompt.includes('booking') ||
        lowerPrompt.includes('token') ||
        lowerPrompt.includes('crm') ||
        lowerPrompt.includes('profit margin') ||
        lowerPrompt.includes('salary')
      ) {
        return this.mockFallback.generateResponse(params);
      }
    }

    if (['HR', 'HUMAN_RESOURCES'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('rebar cutting') ||
        lowerPrompt.includes('structural drawing') ||
        lowerPrompt.includes('1d cutting') ||
        lowerPrompt.includes('bar bending schedule') ||
        lowerPrompt.includes('slump test')
      ) {
        return this.mockFallback.generateResponse(params);
      }
    }

    if (['SITE_ENGINEER', 'SUPERVISOR'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('profit margin') ||
        lowerPrompt.includes('bank account') ||
        lowerPrompt.includes('company ledger') ||
        lowerPrompt.includes('user permissions') ||
        lowerPrompt.includes('delete project')
      ) {
        return this.mockFallback.generateResponse(params);
      }
    }

    // 2. If no API key configured, use MockAIProvider
    if (!this.apiKey) {
      console.warn('⚠️ GeminiAIProvider: No GEMINI_API_KEY found. Falling back to MockAIProvider.');
      return this.mockFallback.generateResponse(params);
    }

    const currentServerDate = groundedContext?.currentServerDate || new Date().toISOString().split('T')[0];

    // 3. Strict Database Grounding System Instructions for Gemini
    const systemInstruction = `You are CraveToBuild AI, an enterprise civil engineering and construction co-pilot embedded inside CraveToBuild.

CONTEXT:
- User Name: ${userName}
- User Role: ${role} (${cleanRole})
- Target Project: "${projectName}" (ID: ${projectId})
- Current Server Date: ${currentServerDate}
- Database Status: Connected to live MongoDB collections.

CRITICAL DATABASE GROUNDING & ANTI-FABRICATION RULES:
1. Base all project facts, quantities, dates, progress, material metrics, and financial figures EXCLUSIVELY on the GROUND-TRUTH DATABASE AUDIT provided below.
2. ABSOLUTELY NEVER INVENT, FABRICATE, OR ESTIMATE:
   - Project completion percentages
   - Rebar consumption or yard stock
   - Concrete volume or pour dates
   - Labour headcounts or muster roll numbers
   - Budget utilization or financial disbursements
3. IF DATA IS MARKED AS "DATA UNAVAILABLE IN DATABASE" OR HAS 0 RECORDS:
   You MUST explicitly state: "Information is not available in the connected project records."
   Clearly explain what is missing (e.g. "No task progress entries exist in pm_tasks for this project").
4. If records are incomplete or conflict, report the discrepancy rather than choosing an arbitrary value.
5. Distinguish past events from future planned events using the Current Server Date (${currentServerDate}).
6. Format your answer in professional GitHub-flavored Markdown with tables and bullet points. Include references to the verified database collections (e.g., [Source: pm_tasks], [Source: stockitems]).

=== GROUND-TRUTH DATABASE AUDIT ===
${groundedContext ? groundedContext.groundedFactsText : 'No database records available.'}
===================================`;

    // 4. Build contents payload from history + current prompt
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Include recent history (last 4 messages max)
    const recentHistory = conversationHistory.slice(-4);
    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.1, // Low temperature for factual precision
        topP: 0.9,
        maxOutputTokens: 1200,
      },
    };

    // 5. Call Gemini REST API with candidate models fallback
    const candidateModels = [
      this.primaryModel,
      'gemini-3.5-flash-lite',
      'gemini-3-flash-preview',
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000), // 15-second timeout
        });

        if (res.ok) {
          const data = await res.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (generatedText && generatedText.trim()) {
            return {
              content: generatedText.trim(),
              category: 'Grounded Project Insights',
              metadata: {
                provider: 'Google Gemini',
                model,
                asOf: groundedContext?.asOf || new Date().toISOString(),
                projectId: groundedContext?.projectId || projectId,
                projectName: groundedContext?.projectName || projectName,
                sources: groundedContext?.sources || [],
                warnings: groundedContext?.warnings || [],
                groundingStatus: 'verified_database',
                tokensUsed: data.usageMetadata?.totalTokenCount,
              },
            };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn(`Gemini model ${model} status ${res.status}:`, errData?.error?.message || res.statusText);
        }
      } catch (err: any) {
        console.warn(`Gemini model ${model} error:`, err?.message || err);
      }
    }

    // 6. Graceful fallback to grounded MockAIProvider on transient API error
    console.warn('⚠️ GeminiAIProvider: Candidate models unavailable. Falling back to Grounded Mock Engine.');
    return this.mockFallback.generateResponse(params);
  }
}
