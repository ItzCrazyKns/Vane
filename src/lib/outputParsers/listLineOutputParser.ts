import { BaseOutputParser } from '@langchain/core/output_parsers';

interface LineListOutputParserArgs {
  key?: string;
}

class LineListOutputParser extends BaseOutputParser<string[]> {
  private key = 'questions';

  constructor(args?: LineListOutputParserArgs) {
    super();
    this.key = args.key ?? this.key;
  }

  static lc_name() {
    return 'LineListOutputParser';
  }

  lc_namespace = ['langchain', 'output_parsers', 'line_list_output_parser'];

  async parse(text: string): Promise<string[]> {
    const regex = /^(\s*(-|\*|\d+\.\s|\d+\)\s|\u2022)\s*)+/;
    const startKeyIndex = text.indexOf(`<${this.key}>`);
    const endKeyIndex = text.indexOf(`</${this.key}>`);
    const questionsStartIndex =
      startKeyIndex === -1 ? 0 : startKeyIndex + `<${this.key}>`.length;
    const questionsEndIndex = endKeyIndex === -1 ? text.length : endKeyIndex;
    const lines = text
      .slice(questionsStartIndex, questionsEndIndex)
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(regex, ''));

    return lines;
  }

  getFormatInstructions(): string {
    throw new Error('Not implemented.');
  }
}

export default LineListOutputParser;
