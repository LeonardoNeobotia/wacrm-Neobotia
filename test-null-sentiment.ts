import { dispatchSentimentAnalysis } from './src/lib/ai/sentiment'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

async function run() {
  console.log('Testing sentiment analysis with null message...')
  try {
    const db = require('./src/lib/supabase/server')
    // Wait, let's just use admin client directly
    const { supabaseAdmin } = require('./src/lib/ai/admin-client')
    const dbAdmin = supabaseAdmin()
    
    const { data: messages } = await dbAdmin
      .from('messages')
      .select('id, content_text, conversations(account_id)')
      .is('sentiment', null)
      .not('content_text', 'is', null)
      .limit(1)

    if (!messages || messages.length === 0) {
      console.log('No null sentiment messages found')
      return
    }

    const msg = messages[0]
    const accountId = msg.conversations.account_id
    
    console.log(`Analyzing message ${msg.id} for account ${accountId}: "${msg.content_text}"`)
    
    await dispatchSentimentAnalysis({
      accountId,
      messageId: msg.id,
      text: msg.content_text
    })
    
    console.log('Dispatch finished!')
    
    const { data: updated } = await dbAdmin
      .from('messages')
      .select('sentiment')
      .eq('id', msg.id)
      .single()
      
    console.log('Updated sentiment:', updated?.sentiment)
  } catch (err) {
    console.error('Error in test script:', err)
  }
}

run()
