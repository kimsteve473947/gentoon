import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // GoogleGenAI 초기화 테스트
    const { GoogleGenAI } = await import('@google/genai');

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.replace(/[\r\n]/g, '').trim();
    const location = (process.env.GOOGLE_CLOUD_LOCATION || 'global')?.replace(/[\r\n]/g, '').trim();

    console.log('🔍 Environment Check:');
    console.log('- GOOGLE_CLOUD_PROJECT_ID:', projectId ? `${projectId.substring(0, 10)}...` : 'MISSING');
    console.log('- GOOGLE_CLOUD_LOCATION:', location);
    console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'MISSING');
    console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? `SET (${process.env.GOOGLE_PRIVATE_KEY.length} chars)` : 'MISSING');

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_CLOUD_PROJECT_ID is missing'
      }, { status: 500 });
    }

    // Credentials 설정
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
      let processedPrivateKey = rawPrivateKey;

      if (rawPrivateKey.includes('\\n')) {
        processedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
      }

      const credentials = {
        type: "service_account" as const,
        project_id: projectId,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: processedPrivateKey,
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
        universe_domain: "googleapis.com"
      };

      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(credentials);
      console.log('✅ Credentials set in process.env');
    }

    // GoogleGenAI 초기화
    const genAI = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: location
    });

    console.log('✅ GoogleGenAI initialized successfully');

    return NextResponse.json({
      success: true,
      message: 'Vertex AI credentials configured successfully',
      details: {
        project: projectId,
        location: location,
        hasServiceAccountEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
        privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ Vertex AI Test Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
