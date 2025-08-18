import { NextResponse } from 'next/server';

const { phoneConnections, browserConnections, activeSessions } = require('../../../../lib/webrtc-server');

export async function GET() {
  // Check if TensorFlow is available
  let tf = null;
  try {
    tf = require("@tensorflow/tfjs-node");
  } catch (e) {
    // TensorFlow not available
  }

  return NextResponse.json({
    status: "ok",
    model: tf ? "tensorflow" : "mock",
    connections: {
      phones: phoneConnections.size,
      browsers: browserConnections.size,
      sessions: activeSessions.size,
    },
  });
}
