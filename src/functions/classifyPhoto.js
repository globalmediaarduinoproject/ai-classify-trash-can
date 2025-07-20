const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Netlify function entry
exports.handler = async function (event, context) {
  try {
    const { imageUrl } = JSON.parse(event.body);

    // Google Gemini SDK 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // base64 이미지를 Gemini SDK용 파트로 변환
    function base64ToGenerativePart(base64, mimeType) {
      return {
        inlineData: {
          data: base64.replace(/^data:image\/\w+;base64,/, ""),
          mimeType
        }
      };
    }

    const prompt = "다음 사진이 일반쓰레기, 플라스틱 쓰레기, 캔쓰레기 중 어떤 것이야? 답만 보내줘";
    const imagePart = base64ToGenerativePart(imageUrl, "image/png");

    // 모델 준비 (gemini-1.5-flash 또는 gemini-1.5-pro)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Gemini API 호출
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = await response.text();

    // Supabase에 결과 저장
    const { data, error } = await supabase
      .from('garbage_classification')
      .insert([{ garbage_type: text.trim() }]);

    if (error) throw new Error('Supabase insert error: ' + error?.message);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result: text.trim() }),
    };

  } catch (error) {
    console.error('[classifyPhoto] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
