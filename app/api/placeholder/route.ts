import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get("prompt") || "웹툰 패널";
  const seed = searchParams.get("seed") || Math.random().toString(36).substring(7);
  
  // 동적 플레이스홀더 이미지 생성
  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          fontSize: 24,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          padding: "40px",
        }
      },
      React.createElement(
        'div',
        {
          style: {
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "20px",
            padding: "40px",
            backdropFilter: "blur(10px)",
            maxWidth: "80%",
            textAlign: "center",
          }
        },
        React.createElement('h1', { style: { fontSize: 48, marginBottom: 20 } }, '🎨 GenToon'),
        React.createElement('p', { style: { fontSize: 28, marginBottom: 10 } }, 'AI 생성 이미지'),
        React.createElement('p', { style: { fontSize: 18, opacity: 0.8, wordBreak: "break-word" } }, 
          prompt.slice(0, 100) + '...'
        ),
        React.createElement('p', { style: { fontSize: 14, opacity: 0.6, marginTop: 20 } }, 
          `Seed: ${seed}`
        )
      )
    ),
    {
      width: 1024,
      height: 1024,
    }
  );
}