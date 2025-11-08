import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GOOGLE_AI_API_KEY;

console.log('🔑 API Key:', apiKey ? 'Present' : 'Missing');

// Google AI Studio 초기화 - project/location 없이
const genAI = new GoogleGenAI({
  apiKey: apiKey
});

console.log('✅ GoogleGenAI initialized');

// 모델 가져오기
const model = genAI.models.get('gemini-2.5-flash-image');

console.log('✅ Model retrieved:', model.modelId);

// 간단한 이미지 생성 테스트
try {
  console.log('🎨 Generating image...');

  const result = await model.generateContentStream({
    contents: [
      {
        parts: [
          { text: 'A red apple' }
        ]
      }
    ]
  });

  console.log('✅ Generation started');

  for await (const chunk of result) {
    console.log('📦 Chunk received:', chunk);
  }

  console.log('✅ Generation complete');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('📋 Full error:', JSON.stringify(error, null, 2));
}
