import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/lib/s3';
// import { auth } from '@clerk/nextjs';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: { params: { key: string } }
) {
  try {
    // Verify authentication
    // const { userId } = auth();
    // if (!userId) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    const fileUrl = getFileUrl(context.params.key);
    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get file URL' },
      { status: 500 }
    );
  }
} 