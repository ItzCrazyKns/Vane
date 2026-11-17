import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import { NextRequest, NextResponse } from 'next/server';
import { ConfigModelProvider } from '@/lib/config/types';
import { MASKED_SECRET } from '@/lib/config/masked';

// Optional secrets: sent to the browser masked, and an empty value clears them.
const SECRET_KEYS = ['search.keirolabsAPIKey'];

type SaveConfigBody = {
  key: string;
  value: string;
};

export const GET = async (req: NextRequest) => {
  try {
    const values = configManager.getCurrentConfig();
    const fields = configManager.getUIConfigSections();

    const modelRegistry = new ModelRegistry();
    const modelProviders = await modelRegistry.getActiveProviders();

    values.modelProviders = values.modelProviders.map(
      (mp: ConfigModelProvider) => {
        const activeProvider = modelProviders.find((p) => p.id === mp.id);

        return {
          ...mp,
          chatModels: activeProvider?.chatModels ?? mp.chatModels,
          embeddingModels:
            activeProvider?.embeddingModels ?? mp.embeddingModels,
        };
      },
    );

    const keirolabsAPIKey = values.search?.keirolabsAPIKey;

    return NextResponse.json({
      values: {
        ...values,
        search: {
          ...values.search,
          keirolabsAPIKey: keirolabsAPIKey ? MASKED_SECRET : '',
        },
      },
      fields,
    });
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body: SaveConfigBody = await req.json();

    const isSecret = SECRET_KEYS.includes(body.key);

    // A secret is stored as given, so anything but a string (an array, an object) is refused before it is read.
    if (isSecret && typeof body.value !== 'string') {
      return Response.json(
        { message: 'The value must be a string.' },
        { status: 400 },
      );
    }

    if (!body.key || (!body.value && !(isSecret && body.value === ''))) {
      return Response.json(
        {
          message: 'Key and value are required.',
        },
        {
          status: 400,
        },
      );
    }

    // The input saves on blur, so an untouched secret comes back as the mask: keep the stored one.
    if (isSecret && body.value === MASKED_SECRET) {
      return Response.json(
        { message: 'Config updated successfully.' },
        { status: 200 },
      );
    }

    // An edit that kept part of the mask would store it as the key; API keys never contain '*'.
    if (isSecret && body.value.includes('*')) {
      return Response.json(
        { message: 'Replace the whole masked key, or delete it to clear it.' },
        { status: 400 },
      );
    }

    configManager.updateConfig(body.key, body.value);

    return Response.json(
      {
        message: 'Config updated successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
