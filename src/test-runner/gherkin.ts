import * as Gherkin from '@cucumber/gherkin';
import * as Messages from '@cucumber/messages';

export interface Scenario {
  name: string;
  steps: string[];
}

export interface ParsedFeature {
  feature: string;
  scenarios: Scenario[];
}

export function parseFeature(text: string): ParsedFeature {
  const uuid = Messages.IdGenerator.uuid();
  const parser = new Gherkin.Parser(
    new Gherkin.AstBuilder(uuid),
    new Gherkin.GherkinClassicTokenMatcher(),
  );
  const doc = parser.parse(text);
  const pickles = Gherkin.compile(doc, 'input.feature', uuid);

  return {
    feature: doc.feature?.name ?? 'Unnamed feature',
    scenarios: pickles.map((p) => ({
      name: p.name,
      steps: p.steps.map((s) => s.text),
    })),
  };
}
