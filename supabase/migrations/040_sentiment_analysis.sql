-- Add sentiment column to messages
ALTER TABLE public.messages 
ADD COLUMN sentiment text;

-- Restrict values to 'positive', 'neutral', 'negative'
ALTER TABLE public.messages 
ADD CONSTRAINT messages_sentiment_check 
CHECK (sentiment IN ('positive', 'neutral', 'negative'));
