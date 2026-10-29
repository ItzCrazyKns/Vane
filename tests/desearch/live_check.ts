import { searchDesearch } from '../../src/lib/desearch';

async function main() {
  try {
    const { results } = await searchDesearch('bittensor');
    console.log(
      JSON.stringify({
        count: results.length,
        firstTitle: results[0]?.title ?? '',
      }),
    );
  } catch {
    process.exitCode = 1;
  }
}

void main();
