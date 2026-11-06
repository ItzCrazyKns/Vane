/* Follow-up suggestions are optional: any failure (HTTP error, bad body,
   network) yields an empty list instead of breaking the chat. */
export const getSuggestions = async (
  chatHistory: [string, string][],
): Promise<string[]> => {
  const chatModel = localStorage.getItem('chatModelKey');
  const chatModelProvider = localStorage.getItem('chatModelProviderId');

  try {
    const res = await fetch(`/api/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatHistory,
        chatModel: {
          providerId: chatModelProvider,
          key: chatModel,
        },
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { suggestions?: unknown };

    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch (err) {
    console.error('Failed to fetch suggestions:', err);
    return [];
  }
};
