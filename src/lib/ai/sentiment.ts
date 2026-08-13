import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { generateReply } from './generate'

interface DispatchSentimentArgs {
  accountId: string
  messageId: string
  text: string
}

export async function dispatchSentimentAnalysis(args: DispatchSentimentArgs): Promise<void> {
  const { accountId, messageId, text } = args

  if (!text || text.trim().length === 0) return

  try {
    const db = supabaseAdmin()
    
    const config = await loadAiConfig(db, accountId, { requireActive: false })
    if (!config || !config.apiKey) return

    const textToAnalyze = text.slice(0, 1000)

    const systemPrompt = `You are a sentiment analysis agent. Classify the sentiment of the user message.
Respond ONLY with one of these three exact words: 'positive', 'neutral', or 'negative'.
Do not include any other text, punctuation, or explanation.`

    let result = ''
    try {
      const resp = await generateReply({
        config,
        systemPrompt,
        messages: [{ role: 'user', content: textToAnalyze }],
      })
      result = resp.text || ''
    } catch (err: any) {
      if (err?.status === 429 || err?.code === 'rate_limit') {
        await new Promise(r => setTimeout(r, 2000))
        const resp = await generateReply({
          config,
          systemPrompt,
          messages: [{ role: 'user', content: textToAnalyze }],
        })
        result = resp.text || ''
      } else {
        throw err
      }
    }

    const parsed = result.toLowerCase().trim()
    
    // Fallback to neutral if it hallucinates
    let sentiment = 'neutral'
    if (parsed.includes('positive')) sentiment = 'positive'
    else if (parsed.includes('negative')) sentiment = 'negative'

    const { error } = await db
      .from('messages')
      .update({ sentiment })
      .eq('id', messageId)

    if (error) {
      console.error('[sentiment analysis] db update failed:', error)
    }
  } catch (err: any) {
    console.error('[sentiment analysis] dispatch failed:', err)
    try {
      const db = supabaseAdmin()
      await db.from('messages').update({ sentiment: 'neutral' }).eq('id', messageId)
    } catch (e: any) {
      console.error('[sentiment analysis] db fallback failed:', e)
    }
  }
}
