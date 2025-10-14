import { NextResponse } from 'next/server';
import { PostBridgeScheduler } from '@/lib/post-bridge-scheduler';
import { createClient } from '@/lib/supabase-server';
import { getCollectionWithMedia } from '@/lib/media-collections';

interface BulkScheduleRequest {
  collectionId: string;
  selectedAccounts: number[];
  postsPerDay: number;
  durationDays: number;
  startDate: string;
  isDraft: boolean;
  content: string;
  tiktokSettings?: {
    privacy: string;
    allowComments: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
  };
}

interface ScheduleSlot {
  accountId: number;
  mediaId: string;
  scheduledFor: Date;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BulkScheduleRequest = await request.json();
    const {
      collectionId,
      selectedAccounts,
      postsPerDay,
      durationDays,
      startDate,
      isDraft,
      content,
      tiktokSettings
    } = body;

    // Validation
    if (!collectionId || !selectedAccounts.length || !postsPerDay || !durationDays) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate total posts needed
    const totalPosts = selectedAccounts.length * postsPerDay * durationDays;
    console.log(`Planning ${totalPosts} posts over ${durationDays} days for ${selectedAccounts.length} accounts`);

    // Rate limit check (Post-bridge has different limits than PostFast)
    const dailyPosts = selectedAccounts.length * postsPerDay;
    if (dailyPosts > 100) { // Conservative limit for Post-bridge
      return NextResponse.json({
        error: `Daily limit exceeded: ${dailyPosts} posts per day. Max recommended: 100`
      }, { status: 400 });
    }

    // Get user's Post-bridge API key
    const { data: apiKeyData } = await supabase
      .from('post_bridge_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!apiKeyData?.api_key) {
      return NextResponse.json({ error: 'No active Post-bridge API key found' }, { status: 400 });
    }

    // Get collection media
    const collectionData = await getCollectionWithMedia(collectionId);
    if (!collectionData) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Combine all media (videos + slideshows)
    const allMedia = [
      ...(collectionData.videos || []).map(v => ({ ...v, type: 'video' })),
      ...(collectionData.slideshows || []).map(s => ({ ...s, type: 'slideshow' }))
    ];

    if (allMedia.length === 0) {
      return NextResponse.json({ error: 'No media found in collection' }, { status: 400 });
    }

    console.log(`Found ${allMedia.length} media items in collection`);

    // Create schedule slots
    const scheduleSlots: ScheduleSlot[] = [];
    const startDateTime = new Date(startDate);

    for (let day = 0; day < durationDays; day++) {
      for (let postIndex = 0; postIndex < postsPerDay; postIndex++) {
        for (const accountId of selectedAccounts) {
          // Calculate time for this post (spread throughout the day)
          const currentDate = new Date(startDateTime);
          currentDate.setDate(currentDate.getDate() + day);

          // Spread posts throughout the day (8AM to 8PM)
          const hourOffset = (postIndex * (12 / postsPerDay)) + 8;
          currentDate.setHours(Math.floor(hourOffset), (hourOffset % 1) * 60);

          // Add some randomization (±30 minutes)
          const randomMinutes = Math.random() * 60 - 30;
          currentDate.setMinutes(currentDate.getMinutes() + randomMinutes);

          // Select media (cycle through available media)
          const mediaIndex = scheduleSlots.length % allMedia.length;
          const selectedMedia = allMedia[mediaIndex];

          scheduleSlots.push({
            accountId,
            mediaId: selectedMedia.id,
            scheduledFor: currentDate
          });
        }
      }
    }

    console.log(`Created ${scheduleSlots.length} schedule slots`);

    // Initialize Post-bridge Scheduler
    const scheduler = new PostBridgeScheduler(apiKeyData.api_key);

    // Get social accounts info
    const accounts = await scheduler.getSocialAccounts();

    // Create posts in batches to respect rate limits
    const batchSize = 5; // More conservative for Post-bridge
    const results = [];
    const errors = [];

    for (let i = 0; i < scheduleSlots.length; i += batchSize) {
      const batch = scheduleSlots.slice(i, i + batchSize);

      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(scheduleSlots.length/batchSize)}`);

      const batchPromises = batch.map(async (slot) => {
        try {
          const account = accounts.find(acc => acc.id === slot.accountId);
          if (!account) {
            throw new Error(`Account not found: ${slot.accountId}`);
          }

          const media = allMedia.find(m => m.id === slot.mediaId);
          if (!media) {
            throw new Error(`Media not found: ${slot.mediaId}`);
          }

          // Prepare media files
          let mediaFiles: File[] = [];

          if (media.type === 'slideshow') {
            // Handle slideshow - download all images
            const imageCount = media.metadata?.imageCount || 5;
            for (let i = 1; i <= imageCount; i++) {
              const imageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/generated-slideshows/${media.file_url.split('/').pop()}/part_${i}.png`;
              const response = await fetch(imageUrl);
              if (response.ok) {
                const blob = await response.blob();
                const file = new File([blob], `slide_${i}.png`, { type: 'image/png' });
                mediaFiles.push(file);
              }
            }
          } else {
            // Handle single video/image
            const mediaUrl = media.file_url.startsWith('/')
              ? `${process.env.NEXT_PUBLIC_BASE_URL}${media.file_url}`
              : media.file_url;

            const response = await fetch(mediaUrl);
            if (response.ok) {
              const blob = await response.blob();
              const extension = media.type === 'video' ? 'mp4' : 'png';
              const mimeType = media.type === 'video' ? 'video/mp4' : 'image/png';
              const file = new File([blob], `media.${extension}`, { type: mimeType });
              mediaFiles.push(file);
            }
          }

          if (mediaFiles.length === 0) {
            throw new Error('No media files could be prepared');
          }

          // Create controls for platform-specific settings
          const controls: any = {};
          if (account.platform.toLowerCase() === 'tiktok' && tiktokSettings) {
            controls.tiktokPrivacy = tiktokSettings.privacy;
            controls.tiktokAllowComments = tiktokSettings.allowComments;
            controls.tiktokAllowDuet = tiktokSettings.allowDuet;
            controls.tiktokAllowStitch = tiktokSettings.allowStitch;
            controls.tiktokIsDraft = isDraft;
          }

          // Create draft post
          const draftPost = await scheduler.createDraftPost(
            user.id,
            content,
            slot.scheduledFor,
            account.platform,
            account.id,
            account.username || 'Unknown',
            mediaFiles,
            controls
          );

          // Schedule the post
          await scheduler.schedulePost(draftPost.id);

          return {
            success: true,
            postId: draftPost.id,
            accountId: slot.accountId,
            scheduledFor: slot.scheduledFor
          };
        } catch (error: any) {
          console.error('Error creating post:', error);
          return {
            success: false,
            error: error.message,
            accountId: slot.accountId,
            scheduledFor: slot.scheduledFor
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r.success));
      errors.push(...batchResults.filter(r => !r.success));

      // Add delay between batches to respect rate limits
      if (i + batchSize < scheduleSlots.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay for Post-bridge
      }
    }

    console.log(`Bulk scheduling completed: ${results.length} successful, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      scheduled: results.length,
      errors: errors.length,
      details: {
        successful: results,
        failed: errors
      }
    });

  } catch (error: any) {
    console.error('Bulk schedule error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}