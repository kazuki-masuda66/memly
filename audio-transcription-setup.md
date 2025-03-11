# Audio Transcription Setup Guide

Memly now supports audio transcription for flashcard generation! This feature allows you to upload audio files (lectures, podcasts, etc.) and automatically convert them to text for flashcard creation.

## Setup Requirements

To use the audio transcription feature, you'll need a Google API key with access to Gemini 1.5 Pro:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey) and create an account if you don't have one
2. Create a new API key for Gemini models
3. Make sure your API key has access to the Gemini 1.5 Pro model

## Environment Configuration

Add your Google API key to your environment variables:

### Local Development

Create or update a `.env.local` file in the root of your project with:

```
GOOGLE_API_KEY=your_api_key_here
```

### Vercel Deployment

Add the following environment variable in your Vercel project settings:

- Name: `GOOGLE_API_KEY`
- Value: your Google API key

## Supported Audio Formats

The audio transcription feature supports the following formats:
- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- MP4 (.mp4, audio track)
- AAC (.aac)
- OGG (.ogg)
- WebM (.webm)
- FLAC (.flac)

## Using the Feature

1. On the Flashcards page, go to the file upload section
2. Select an audio file from your device
3. Click "Upload" and wait for the transcription to complete
4. The transcribed text will appear in the input area
5. Adjust the settings as needed and generate flashcards from the transcription

## Transcription Quality

Google's Gemini 1.5 Pro model provides high-quality audio transcription with the following benefits:
- Accurate punctuation and formatting
- Better handling of domain-specific terminology
- Support for multiple languages
- Improved handling of background noise

## Troubleshooting

If you encounter any issues with audio transcription:

- Verify your Google API key is correctly set in your environment variables
- Check that your audio file is in one of the supported formats
- Ensure your audio file is not too large (max 25MB)
- Make sure your Google API key has access to the Gemini 1.5 Pro model

For larger files, consider splitting them into smaller segments or using a different audio format.
