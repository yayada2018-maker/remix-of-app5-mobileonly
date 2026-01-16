import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { S3Client, PutObjectCommand, HeadObjectCommand } from 'npm:@aws-sdk/client-s3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  imageUrl: string;
  fileName: string;
  bucket: string;
}

const sanitizeEndpointHost = (value: string | undefined | null) =>
  value?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const debugEnv = {
    envEndpoint: Deno.env.get('IDRIVE_E2_STORAGE2_ENDPOINT') ?? null,
    envRegion: Deno.env.get('IDRIVE_E2_STORAGE2_REGION') ?? null,
  };

  try {
    const { imageUrl, fileName, bucket }: UploadRequest = await req.json();

    if (!imageUrl || !fileName || !bucket) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpointHost = sanitizeEndpointHost(Deno.env.get('IDRIVE_E2_STORAGE2_ENDPOINT'));
    const accessKeyId = Deno.env.get('IDRIVE_E2_STORAGE2_ACCESS_KEY');
    const secretAccessKey = Deno.env.get('IDRIVE_E2_STORAGE2_SECRET_KEY');

    // Hardcode region to avoid placeholder secret values breaking the AWS SDK.
    const region = 'ap-southeast-1';

    if (!endpointHost || !accessKeyId || !secretAccessKey) {
      throw new Error('Storage2 credentials not configured');
    }

    const s3Client = new S3Client({
      endpoint: `https://${endpointHost}`,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: fileName,
        })
      );

      const existingUrl = `https://${endpointHost}/${bucket}/${fileName}`;
      return new Response(
        JSON.stringify({ success: true, url: existingUrl, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (_headError) {
      // continue
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: new Uint8Array(imageBuffer),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      })
    );

    const publicUrl = `https://${endpointHost}/${bucket}/${fileName}`;

    return new Response(
      JSON.stringify({ success: true, url: publicUrl, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        debug: { ...debugEnv, usedRegion: 'ap-southeast-1', function: 'upload-tmdb-image-v2' },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
