import { NextRequest, NextResponse } from 'next/server';

const ASSEMBLYAI_API_KEY = '2c397e767ef4496291e59dbf640080ce';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    const songId = formData.get('songId') as string;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('[Extract Lyrics] Uploading audio to AssemblyAI...');

    // Étape 1 : Upload du fichier audio vers AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
      },
      body: await audioFile.arrayBuffer(),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const { upload_url } = await uploadResponse.json();
    console.log('[Extract Lyrics] Audio uploaded:', upload_url);

    // Étape 2 : Créer la transcription avec word-level timestamps
    console.log('[Extract Lyrics] Starting transcription...');
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_detection: true, // Détection automatique de la langue
        format_text: false, // Garder le texte brut
      }),
    });

    if (!transcriptResponse.ok) {
      throw new Error(`Transcription request failed: ${transcriptResponse.statusText}`);
    }

    const { id: transcriptId } = await transcriptResponse.json();
    console.log('[Extract Lyrics] Transcription ID:', transcriptId);

    // Étape 3 : Polling pour attendre la fin de la transcription
    let transcript: any = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts × 2s = 2 minutes max

    while (attempts < maxAttempts) {
      const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
        },
      });

      if (!pollingResponse.ok) {
        throw new Error(`Polling failed: ${pollingResponse.statusText}`);
      }

      transcript = await pollingResponse.json();

      if (transcript.status === 'completed') {
        console.log('[Extract Lyrics] Transcription completed!');
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription error: ${transcript.error}`);
      }

      // Attendre 2 secondes avant le prochain polling
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      console.log(`[Extract Lyrics] Polling... attempt ${attempts}/${maxAttempts}`);
    }

    if (!transcript || transcript.status !== 'completed') {
      throw new Error('Transcription timeout');
    }

    // Étape 4 : Formater les résultats avec timestamps
    const words = transcript.words || [];
    const lyrics = transcript.text || '';

    // Créer un tableau de paroles avec timestamps
    const timedLyrics = words.map((word: any) => ({
      text: word.text,
      start: word.start / 1000, // Convertir ms en secondes
      end: word.end / 1000,
      confidence: word.confidence,
    }));

    // Grouper les mots en phrases (par ponctuation ou pauses)
    const sentences: Array<{ text: string; start: number; end: number }> = [];
    let currentSentence = { text: '', start: 0, end: 0 };

    timedLyrics.forEach((word: any, index: number) => {
      if (index === 0) {
        currentSentence.start = word.start;
      }

      currentSentence.text += (currentSentence.text ? ' ' : '') + word.text;
      currentSentence.end = word.end;

      // Fin de phrase si ponctuation ou pause > 0.5s
      const nextWord = timedLyrics[index + 1];
      const isPause = nextWord && (nextWord.start - word.end > 0.5);
      const isPunctuation = word.text.match(/[.!?,;]$/);

      if (isPause || isPunctuation || index === timedLyrics.length - 1) {
        sentences.push({ ...currentSentence });
        currentSentence = { text: '', start: nextWord?.start || 0, end: nextWord?.end || 0 };
      }
    });

    console.log('[Extract Lyrics] Extracted:', sentences.length, 'sentences');

    // Sauvegarder les lyrics dans la base de données si songId est fourni
    if (songId) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const lyricsData = {
          lyrics: lyrics,
          words: timedLyrics,
          sentences: sentences,
          duration: transcript.audio_duration,
        };

        const { error } = await supabase
          .from('songs')
          .update({ lyrics: lyricsData })
          .eq('id', songId);

        if (error) {
          console.error('[Extract Lyrics] Error saving lyrics:', error);
        } else {
          console.log('[Extract Lyrics] Lyrics saved to database for song:', songId);
        }
      } catch (dbError) {
        console.error('[Extract Lyrics] Database error:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      lyrics: lyrics,
      words: timedLyrics,
      sentences: sentences,
      duration: transcript.audio_duration,
    });

  } catch (error: any) {
    console.error('[Extract Lyrics] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract lyrics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
