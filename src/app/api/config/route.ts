import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (req: NextRequest) => {
  try {
    const values = configManager.currentConfig;
    const fields = configManager.getUIConfigSections();

    const modelRegistry = new ModelRegistry();
    const modelProviders = await modelRegistry.getActiveProviders();

    values.modelProviders = values.modelProviders.map((mp) => {
      const activeProvider = modelProviders.find((p) => p.id === mp.id)

      return {
        ...mp,
        chatModels: activeProvider?.chatModels ?? mp.chatModels,
        embeddingModels: activeProvider?.embeddingModels ?? mp.embeddingModels
      }
    })

    return NextResponse.json({
      values,
      fields,
    })
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
