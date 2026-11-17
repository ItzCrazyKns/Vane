import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';

type RouterTarget = {
  provider: string;
  model: string;
};

type RouterLLMConfig = {
  routeKey: string;
  targets: RouterTarget[];
  loader: (target: RouterTarget) => Promise<BaseLLM<any>>;
};

const targetLabel = (target: RouterTarget) =>
  `${target.provider}/${target.model}`;

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

class RouterLLM extends BaseLLM<RouterLLMConfig> {
  constructor(config: RouterLLMConfig) {
    super(config);
  }

  private logFailure(target: RouterTarget, err: unknown, willRetry: boolean) {
    console.warn(
      `[Model Router] Route "${this.config.routeKey}" failed on ${targetLabel(
        target,
      )}${willRetry ? ', trying next target' : ''}.`,
      err,
    );
  }

  private buildAggregateError(errors: string[]): Error {
    return new Error(
      `Model Router route "${this.config.routeKey}" failed for all targets:\n${errors
        .map((e) => `- ${e}`)
        .join('\n')}`,
    );
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const errors: string[] = [];

    for (const target of this.config.targets) {
      try {
        const llm = await this.config.loader(target);
        return await llm.generateText(input);
      } catch (err) {
        errors.push(`${targetLabel(target)}: ${errorMessage(err)}`);
        this.logFailure(
          target,
          err,
          errors.length < this.config.targets.length,
        );
      }
    }

    throw this.buildAggregateError(errors);
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const errors: string[] = [];

    for (const target of this.config.targets) {
      let stream: AsyncGenerator<StreamTextOutput>;

      try {
        const llm = await this.config.loader(target);
        stream = llm.streamText(input);
      } catch (err) {
        errors.push(`${targetLabel(target)}: ${errorMessage(err)}`);
        this.logFailure(
          target,
          err,
          errors.length < this.config.targets.length,
        );
        continue;
      }

      let committed = false;

      try {
        while (true) {
          const next = await stream.next();

          if (next.done) return;

          const chunk = next.value;
          if (
            (chunk.contentChunk && chunk.contentChunk.length > 0) ||
            (chunk.toolCallChunk && chunk.toolCallChunk.length > 0)
          ) {
            committed = true;
          }

          yield chunk;
        }
      } catch (err) {
        errors.push(`${targetLabel(target)}: ${errorMessage(err)}`);

        if (committed) {
          throw new Error(
            `Model Router route "${this.config.routeKey}" failed mid-stream on ${targetLabel(
              target,
            )}: ${errorMessage(err)}`,
          );
        }

        this.logFailure(
          target,
          err,
          errors.length < this.config.targets.length,
        );
      }
    }

    throw this.buildAggregateError(errors);
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const errors: string[] = [];

    for (const target of this.config.targets) {
      try {
        const llm = await this.config.loader(target);
        return (await llm.generateObject<T>(input)) as T;
      } catch (err) {
        errors.push(`${targetLabel(target)}: ${errorMessage(err)}`);
        this.logFailure(
          target,
          err,
          errors.length < this.config.targets.length,
        );
      }
    }

    throw this.buildAggregateError(errors);
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    const errors: string[] = [];

    for (const target of this.config.targets) {
      let stream: AsyncGenerator<T>;

      try {
        const llm = await this.config.loader(target);
        stream = llm.streamObject<T>(input) as AsyncGenerator<T>;
      } catch (err) {
        errors.push(`${targetLabel(target)}: ${errorMessage(err)}`);
        this.logFailure(
          target,
          err,
          errors.length < this.config.targets.length,
        );
        continue;
      }

      let committed = false;

      try {
        while (true) {
          const next = await stream.next();

          if (next.done) return;

          const chunk = next.value;
          if (
            chunk &&
            typeof chunk === 'object' &&
            Object.keys(chunk as Record<string, unknown>).length > 0
          ) {
            committed = true;
          }

          yield chunk;
        }
      } catch (err) {
        errors.push(`${targetLabel(target)}: ${errorMessage(err)}`);

        if (committed) {
          throw new Error(
            `Model Router route "${this.config.routeKey}" failed mid-stream on ${targetLabel(
              target,
            )}: ${errorMessage(err)}`,
          );
        }

        this.logFailure(
          target,
          err,
          errors.length < this.config.targets.length,
        );
      }
    }

    throw this.buildAggregateError(errors);
  }
}

export type { RouterLLMConfig, RouterTarget };
export default RouterLLM;
