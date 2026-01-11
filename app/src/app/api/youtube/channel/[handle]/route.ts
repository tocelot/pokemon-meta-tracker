import { NextResponse } from 'next/server'

export const revalidate = 3600 // Cache for 1 hour

interface VideoInfo {
  videoId: string
  title: string
  url: string
  thumbnail: string
  publishedText: string
  description: string
  viewCount: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params

    // Fetch the YouTube channel videos page
    const channelUrl = `https://www.youtube.com/@${handle}/videos`

    const response = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`YouTube returned ${response.status}`)
    }

    const html = await response.text()

    // YouTube embeds video data in a script tag as JSON
    // Look for ytInitialData which contains the video list
    const ytDataMatch = html.match(/var ytInitialData = ({.+?});/)

    if (!ytDataMatch) {
      // Fallback: return empty array if we can't parse
      return NextResponse.json({ videos: [], channelName: handle })
    }

    const ytData = JSON.parse(ytDataMatch[1])

    // Navigate the YouTube data structure to find videos
    const videos: VideoInfo[] = []

    try {
      const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
      const videosTab = tabs.find((t: { tabRenderer?: { title?: string; selected?: boolean } }) =>
        t?.tabRenderer?.title === 'Videos' || t?.tabRenderer?.selected
      )

      const contents = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || []

      for (const item of contents.slice(0, 20)) {
        const videoRenderer = item?.richItemRenderer?.content?.videoRenderer
        if (!videoRenderer) continue

        const videoId = videoRenderer.videoId
        const title = videoRenderer.title?.runs?.[0]?.text || ''
        const thumbnail = videoRenderer.thumbnail?.thumbnails?.pop()?.url || ''
        const publishedText = videoRenderer.publishedTimeText?.simpleText || ''
        const description = videoRenderer.descriptionSnippet?.runs?.map((r: { text?: string }) => r.text).join('') || ''
        const viewCount = videoRenderer.viewCountText?.simpleText || videoRenderer.viewCountText?.runs?.[0]?.text || ''

        if (videoId && title) {
          videos.push({
            videoId,
            title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail,
            publishedText,
            description,
            viewCount,
          })
        }
      }
    } catch (parseError) {
      console.error('Error parsing YouTube data:', parseError)
    }

    // Get channel name
    const channelName = ytData?.metadata?.channelMetadataRenderer?.title || handle

    return NextResponse.json({ videos, channelName })
  } catch (error) {
    console.error('Error fetching YouTube channel:', error)
    return NextResponse.json({ videos: [], channelName: '', error: 'Failed to fetch channel data' })
  }
}
