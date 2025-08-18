import { NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';

const { getMetrics } = require('../../../../lib/webrtc-server');

export async function GET() {
  const currentMetrics = getMetrics();
  
  // Save to file
  try {
    writeFileSync(
      join(process.cwd(), 'metrics.json'),
      JSON.stringify(currentMetrics, null, 2)
    );
  } catch (e) {
    console.log("⚠️ Could not write metrics file");
  }
  
  return NextResponse.json(currentMetrics);
}
