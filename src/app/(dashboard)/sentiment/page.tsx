import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import SentimentDashboard from '@/components/sentiment/sentiment-dashboard'

export default async function SentimentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all messages that have a sentiment score
  // Join with conversations and contacts to get the client info
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, 
      sentiment, 
      content_text, 
      created_at,
      sender_type,
      conversation_id,
      conversations:conversation_id (
        id,
        contacts:contact_id (
          id, 
          name, 
          phone
        )
      )
    `)
    .eq('sender_type', 'customer')
    .not('sentiment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)
  
  const messages = data || []
  
  if (error) {
    return (
      <div className="flex flex-col flex-1 p-6 text-destructive">
        <h1 className="text-2xl font-bold">Error loading sentiment data</h1>
        <pre className="mt-4 p-4 bg-muted text-foreground rounded overflow-auto whitespace-pre-wrap">{JSON.stringify(error, null, 2)}</pre>
      </div>
    )
  }

  // Aggregate sentiment counts
  let positive = 0
  let neutral = 0
  let negative = 0

  // Words for the word cloud
  const wordCounts: Record<string, number> = {}
  
  // Stop words to filter out
  const stopWords = new Set([
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus', 'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas',
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'hola', 'gracias', 'buenas', 'tardes', 'dias', 'noches', 'saludos', 'favor', 'porfavor', 'bien'
  ])

  // Group by client
  // clientMap: contact_id -> { contact, stats: { pos, neu, neg }, messages: [] }
  const clientsMap: Record<string, any> = {}

  for (const msg of messages) {
    if (msg.sentiment === 'positive') positive++
    if (msg.sentiment === 'neutral') neutral++
    if (msg.sentiment === 'negative') negative++

    // Process words
    if (msg.content_text) {
      // Basic tokenization
      const words = msg.content_text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/\b[a-z]{4,}\b/g) || []
      for (const w of words) {
        if (!stopWords.has(w) && isNaN(Number(w))) {
          wordCounts[w] = (wordCounts[w] || 0) + 1
        }
      }
    }

    // Process client grouping
    const conv = Array.isArray(msg.conversations) ? msg.conversations[0] : msg.conversations
    if (conv && conv.contacts) {
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts
      if (contact && contact.id) {
        if (!clientsMap[contact.id]) {
          clientsMap[contact.id] = {
            contact,
            conversation_id: conv.id,
            stats: { positive: 0, neutral: 0, negative: 0 },
            recent_messages: []
          }
        }
        
        clientsMap[contact.id].stats[msg.sentiment as 'positive' | 'neutral' | 'negative']++
        
        // Keep up to 20 recent messages per client for the expand view
        if (clientsMap[contact.id].recent_messages.length < 20) {
          clientsMap[contact.id].recent_messages.push({
            id: msg.id,
            text: msg.content_text,
            sentiment: msg.sentiment,
            created_at: msg.created_at,
            sender_type: msg.sender_type,
          })
        }
      }
    }
  }

  // Sort words and take top 20
  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([text, value]) => ({ text, value }))

  // Convert clientsMap to array and sort by total messages (most active first)
  const clientsList = Object.values(clientsMap).sort((a, b) => {
    const totalA = a.stats.positive + a.stats.neutral + a.stats.negative
    const totalB = b.stats.positive + b.stats.neutral + b.stats.negative
    return totalB - totalA
  })

  return (
    <div className="flex h-full w-full flex-col p-6 space-y-6 overflow-y-auto bg-background">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Análisis de Sentimientos</h1>
        <p className="text-muted-foreground mt-2">
          Monitorea cómo se sienten tus clientes a partir de las interacciones con tu equipo y el agente IA.
        </p>
      </div>

      <SentimentDashboard 
        stats={{ positive, neutral, negative }} 
        wordCloud={sortedWords}
        clients={clientsList}
      />
    </div>
  )
}
