import { auth } from "@/app/(auth)/auth";
import { getModelSettings } from "@/lib/ai/model-settings";
import { getModelCatalogue, getModelProviders } from "@/lib/ai/providers";

/**
 * The picker and the settings dialog both read this: every model every enabled
 * provider can serve, plus which providers exist so the UI can group by them.
 */
export async function GET() {
  const session = await auth();
  const [models, settings] = await Promise.all([
    getModelCatalogue(),
    getModelSettings(session?.user?.id),
  ]);

  // Only providers that actually contributed something: a provider with no
  // models has nothing to head a group with.
  const contributing = new Set(models.map((model) => model.providerId));
  const providers = getModelProviders()
    .filter((provider) => contributing.has(provider.id))
    .map(({ id, label }) => ({ id, label }));

  return Response.json(
    {
      capabilities: Object.fromEntries(
        models.map((model) => [model.id, model.capabilities])
      ),
      models,
      providers,
      settings,
    },
    {
      headers: {
        // Not cacheable: this carries the signed-in user's own settings, and a
        // newly pulled Ollama model should appear without waiting out a TTL.
        "Cache-Control": "no-store",
      },
    }
  );
}
