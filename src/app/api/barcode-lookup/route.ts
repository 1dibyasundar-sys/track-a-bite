import { NextRequest, NextResponse } from 'next/server';
import { fetchProductFromOpenFoodFacts, normalizeBarcode } from '../../../lib/server/openFoodFactsService';
import { BarcodeLookupResult } from '../../../lib/types/barcode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawBarcode = searchParams.get('barcode');

  if (!rawBarcode) {
    return NextResponse.json<BarcodeLookupResult>(
      {
        status: 'error',
        barcode: '',
        errorMessage: 'Missing required "barcode" query parameter.',
      },
      { status: 400 }
    );
  }

  const normalized = normalizeBarcode(rawBarcode);
  if (!normalized || normalized.length < 4) {
    return NextResponse.json<BarcodeLookupResult>(
      {
        status: 'error',
        barcode: rawBarcode,
        errorMessage: 'Invalid barcode format. Expected at least 4 digits.',
      },
      { status: 400 }
    );
  }

  const result = await fetchProductFromOpenFoodFacts(normalized);

  if (result.status === 'not_found') {
    return NextResponse.json<BarcodeLookupResult>(result, { status: 404 });
  }

  if (result.status === 'rate_limited') {
    return NextResponse.json<BarcodeLookupResult>(result, { status: 429 });
  }

  if (result.status === 'error') {
    return NextResponse.json<BarcodeLookupResult>(result, { status: 502 });
  }

  return NextResponse.json<BarcodeLookupResult>(result, { status: 200 });
}
