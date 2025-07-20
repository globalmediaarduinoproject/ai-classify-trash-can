// /src/functions/classifyPhoto.js
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,   // .env 파일에서 환경 변수로 설정한 Supabase URL
  process.env.SUPABASE_KEY    // .env 파일에서 환경 변수로 설정한 Supabase API Key
);

// 대기 함수 (밀리초 단위로 대기)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Gemini API 호출 함수
async function classifyImage(imageUrl) {
  const url = 'https://geminiapi.com/classify';  // Gemini API 엔드포인트
  let retryCount = 0;  // 재시도 횟수

  while (retryCount < 3) {  // 최대 3번 재시도
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
        },
        body: JSON.stringify({ imageUrl })
      });

      if (response.status === 429) {
        // 429 Too Many Requests (API 호출 제한 초과)
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const waitTime = resetTime ? (resetTime * 1000 - Date.now()) : 60000; // 리셋 시간을 계산하여 대기

        console.log(`API 호출 제한 초과, ${waitTime / 1000}초 후 재시도`);
        await sleep(waitTime);  // 제한이 리셋될 때까지 대기
        retryCount++;
      } else if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.statusText}`);
      } else {
        // 성공적인 응답 처리
        const data = await response.json();
        console.log('API 응답:', data);
        return data.classification; // 예: "Plastic", "Trash"
      }
    } catch (error) {
      console.error('API 호출 중 오류:', error);
      throw error;  // 재시도 실패 시 에러 처리
    }
  }

  throw new Error('최대 재시도 횟수를 초과했습니다.');
}

// Netlify Function
exports.handler = async function(event, context) {
  const { body } = event;
  const { imageUrl } = JSON.parse(body); // 클라이언트에서 전송한 이미지 URL

  try {
    // Gemini API 호출
    const garbage_type = await classifyImage(imageUrl);

    // Supabase에 저장 (garbage_classification 테이블에)
    const { error } = await supabase
      .from('garbage_classification')  // 'garbage_classification' 테이블에 데이터를 저장
      .insert([{ garbage_type }]);  // garbage_type만 저장

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error saving data', error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ garbage_type }), // 분류된 결과 반환
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error classifying photo', error: err.message }),
    };
  }
};
