import { NextResponse } from 'next/server'

export const revalidate = 86400 // Cache for 24 hours

// YouTube Data API key - set this in your .env.local file as YOUTUBE_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params

    // Method 1: Try using a public transcript service
    // This uses youtubetranscript.com's public endpoint
    try {
      const transcriptServiceUrl = `https://youtubetranscript.com/?server_vid2=${videoId}`
      const serviceResponse = await fetch(transcriptServiceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (serviceResponse.ok) {
        const html = await serviceResponse.text()
        // Extract transcript text from the page
        const transcriptMatch = html.match(/<text[^>]*>([\s\S]*?)<\/text>/g)
        if (transcriptMatch) {
          const segments: string[] = []
          for (const match of transcriptMatch) {
            const textContent = match.replace(/<\/?text[^>]*>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .trim()
            if (textContent) segments.push(textContent)
          }

          if (segments.length > 0) {
            return NextResponse.json({
              transcript: segments.join(' '),
              segments: [],
            })
          }
        }
      }
    } catch {
      // Continue to next method
    }

    // Method 2: Try YouTube's video page with consent bypass
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=YES+; PREF=hl=en',
      },
    })

    if (!videoPageResponse.ok) {
      return NextResponse.json({ transcript: null, segments: [], error: 'Could not fetch video page' })
    }

    const html = await videoPageResponse.text()

    // Extract caption tracks from ytInitialPlayerResponse
    const playerResponseStart = html.indexOf('ytInitialPlayerResponse')
    if (playerResponseStart !== -1) {
      const jsonStart = html.indexOf('{', playerResponseStart)
      if (jsonStart !== -1) {
        let braceCount = 0
        let jsonEnd = jsonStart

        for (let i = jsonStart; i < Math.min(jsonStart + 500000, html.length); i++) {
          if (html[i] === '{') braceCount++
          else if (html[i] === '}') braceCount--
          if (braceCount === 0) {
            jsonEnd = i + 1
            break
          }
        }

        try {
          const playerResponse = JSON.parse(html.slice(jsonStart, jsonEnd))
          const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

          if (captionTracks && captionTracks.length > 0) {
            // Find English or auto-generated track
            const englishTrack = captionTracks.find((t: { languageCode: string; kind?: string }) =>
              t.languageCode === 'en' || t.languageCode?.startsWith('en')
            ) || captionTracks.find((t: { kind?: string }) =>
              t.kind === 'asr' // Auto-generated
            ) || captionTracks[0]

            if (englishTrack?.baseUrl) {
              // Try multiple formats
              const formats = ['', '&fmt=json3', '&fmt=srv3', '&fmt=vtt']

              for (const fmt of formats) {
                try {
                  const captionResponse = await fetch(englishTrack.baseUrl + fmt, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Accept-Language': 'en-US,en;q=0.9',
                      'Cookie': 'CONSENT=YES+;',
                    },
                  })

                  if (captionResponse.ok) {
                    const captionText = await captionResponse.text()
                    if (captionText.length > 100) {
                      // Try to parse as JSON (fmt=json3)
                      try {
                        const jsonData = JSON.parse(captionText)
                        const events = jsonData?.events || []
                        const textParts: string[] = []

                        for (const event of events) {
                          if (event.segs) {
                            for (const seg of event.segs) {
                              if (seg.utf8 && seg.utf8.trim()) {
                                textParts.push(seg.utf8.trim())
                              }
                            }
                          }
                        }

                        if (textParts.length > 0) {
                          return NextResponse.json({
                            transcript: textParts.join(' '),
                            segments: [],
                          })
                        }
                      } catch {
                        // Not JSON, try XML/other formats
                      }

                      // Parse XML format
                      const textMatches = captionText.matchAll(/<text[^>]*>([^<]*)<\/text>/g)
                      const segments: string[] = []
                      for (const match of textMatches) {
                        const text = match[1]
                          .replace(/&amp;/g, '&')
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>')
                          .replace(/&#39;/g, "'")
                          .replace(/&quot;/g, '"')
                          .replace(/\n/g, ' ')
                          .trim()
                        if (text) segments.push(text)
                      }

                      if (segments.length > 0) {
                        return NextResponse.json({
                          transcript: segments.join(' '),
                          segments: [],
                        })
                      }

                      // Try VTT format
                      const vttLines = captionText.split('\n')
                      const vttSegments: string[] = []
                      for (const line of vttLines) {
                        // Skip timing lines and headers
                        if (!line.includes('-->') && !line.startsWith('WEBVTT') && !line.match(/^\d+$/) && line.trim()) {
                          vttSegments.push(line.trim())
                        }
                      }
                      if (vttSegments.length > 5) {
                        return NextResponse.json({
                          transcript: vttSegments.join(' '),
                          segments: [],
                        })
                      }
                    }
                  }
                } catch {
                  // Try next format
                }
              }
            }
          }
        } catch {
          // Parsing failed
        }
      }
    }

    // If we have a YouTube API key, try the official API
    if (YOUTUBE_API_KEY) {
      try {
        // Get caption list
        const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
        const captionsListResponse = await fetch(captionsListUrl)

        if (captionsListResponse.ok) {
          const captionsData = await captionsListResponse.json()
          // Note: Downloading captions requires OAuth, but we can at least confirm they exist
          if (captionsData.items && captionsData.items.length > 0) {
            return NextResponse.json({
              transcript: null,
              segments: [],
              error: 'Captions exist but require OAuth to download. Try enabling auto-captions on the video.',
              hasCaptions: true,
            })
          }
        }
      } catch {
        // API call failed
      }
    }

    return NextResponse.json({
      transcript: null,
      segments: [],
      error: 'Could not extract transcript. Video may not have captions enabled.',
    })
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return NextResponse.json({ transcript: null, segments: [], error: 'Failed to fetch transcript' })
  }
}
