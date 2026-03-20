import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ message: 'Missing image' }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type;

    const ollamaBaseURL = process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434/v1';
    const model = process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:latest';

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'ollama',
      baseURL: ollamaBaseURL,
    });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析这张图片，并输出一句适合联网搜索的中文搜索词。只输出搜索词本身，不要解释，不要加引号。'
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` }
            }
          ]
        }
      ]
    });

    const query = response.choices?.[0]?.message?.content?.toString().trim() || '请描述这张图片的主体内容';
    return NextResponse.json({ query });
  } catch (error) {
    console.error('Vision Error:', error);
    return NextResponse.json({ message: 'Error processing image' }, { status: 500 });
  }
}
