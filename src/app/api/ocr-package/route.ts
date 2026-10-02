import { NextRequest, NextResponse } from 'next/server';
import { extractPackageDetailsWithGemini } from '../../../lib/server/geminiPackageOcr';
import { calculateExpiryStatus } from '../../../lib/services/expiryCalculationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (!body.image) {
        return NextResponse.json(
          {
            success: false,
            errorMessage: 'No image data provided for package details OCR.',
          },
          { status: 400 }
        );
      }
      const rawImage = body.image as string;
      if (rawImage.startsWith('data:')) {
        const matches = rawImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = rawImage.replace(/^data:[^;]+;base64,/, '');
        }
      } else {
        base64Data = rawImage;
        if (body.mimeType) mimeType = body.mimeType;
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          errorMessage: 'Unsupported Content-Type. Please use application/json.',
        },
        { status: 400 }
      );
    }

    if (!base64Data || base64Data.length < 20) {
      return NextResponse.json(
        {
          success: false,
          errorMessage: 'Invalid image data.',
        },
        { status: 400 }
      );
    }

    const ocrResult = await extractPackageDetailsWithGemini(base64Data, mimeType);
    const { status, daysRemaining, statusLabel } = calculateExpiryStatus(ocrResult.expiryDate);

    return NextResponse.json({
      success: true,
      ocrResult,
      expiryStatus: status,
      daysRemaining,
      statusLabel,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      {
        success: false,
        errorMessage: err.message || 'Error occurred during package OCR extraction.',
      },
      { status: 500 }
    );
  }
}
