import axios from 'axios'
import { config } from '../../config'
import { costTracker } from './metrics'

export async function parseQueryWithGemini(userPrompt: string): Promise<{ searchArtist?: string; songTitle?: string; normalizedQuery: string }> {
  if (!config.gemini.apiKey) {
    return { normalizedQuery: userPrompt }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.gemini.apiKey}`

  try {
    const response = await axios.post(
      endpoint,
      {
        contents: [
          {
            parts: [
              {
                text: `Extract the song title and artist from this music search query. Return only a compact JSON object with "songTitle", "artist", and "normalizedQuery".\nInput: "${userPrompt}"`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      },
      { timeout: 5000 }
    )

    costTracker.recordRequest('gemini_ai', false)

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (text) {
      const parsed = JSON.parse(text)
      return {
        songTitle: parsed.songTitle,
        searchArtist: parsed.artist,
        normalizedQuery: parsed.normalizedQuery || `${parsed.songTitle || ''} ${parsed.artist || ''}`.trim() || userPrompt,
      }
    }
  } catch (err: any) {
    console.warn('[Gemini] Query parsing error:', err.message)
  }

  return { normalizedQuery: userPrompt }
}
