import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { getOpenaiApiKey } from '../config'
import { ChatModelProvider, EmbeddingModelProvider } from '.'

const openaiChatModels: Record<string, string>[] = [
  {
    displayName: 'GPT-3.5 Turbo',
    key: 'gpt-3.5-turbo',
  },
  {
    displayName: 'GPT-4',
    key: 'gpt-4',
  },
  {
    displayName: 'GPT-4 turbo',
    key: 'gpt-4-turbo',
  },
  {
    displayName: 'GPT-4 omni',
    key: 'gpt-4o',
  },
  {
    displayName: 'GPT-4 omni mini',
    key: 'gpt-4o-mini',
  }
]

const openaiEmbeddingModels: Record<string, string>[] = [
    {
        displayName: 'Text Embedding 3 Small',
        key: 'text-embedding-3-small',
    }, 
    {
        displayName: 'Text Embedding 3 Large',
        key: 'text-embedding-3-large',
    }
]

export const loadOpenAIChatModels = async () => {
    const openaiApiKey = getOpenaiApiKey()

    if (!openaiApiKey) return {}

    try {
        const chatModels: Record<string, ChatModelProvider> = {}

        openaiChatModels.forEach(model => {
            chatModels[model.key] = {
                displayName: model.displayName,
                model: new ChatOpenAI({
                    openAIApiKey: openaiApiKey,
                    modelName: model.key,
                    temperature: 0.7
                })
            }
        })

        return chatModels
    } catch(err) {
        console.error(`Error loading OpenAI models: ${err}`)
        return {}
    }
}

export const loadOpenAIEmbeddingModels = async () => {
    const openaiApiKey = getOpenaiApiKey()

    if (!openaiApiKey) return {}

    try {
        const embeddingModels: Record<string, EmbeddingModelProvider> = {}

        openaiEmbeddingModels.forEach(model => {
            embeddingModels[model.key] = {
                displayName: model.displayName,
                model: new OpenAIEmbeddings({
                    openAIApiKey: openaiApiKey,
                    modelName: model.key,
                })
            }
        })

        return embeddingModels
    } catch(err) {
        console.error(`Error loading OpenAI embeddings models: ${err}`)
        return {}
    }
}