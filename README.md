# BDD Playwirght Agent (NestJS + Gemini + Playwright MCP)

## Setup
    npm install
    cp .env.example .env     # add GEMINI_API_KEY
    npx playwright install chromium
    npm run start:dev

## Run
    curl -X POST http://localhost:3000/execute-test -F "file=@examples/search.feature"

or JSON:

    curl -X POST http://localhost:3000/execute-test \
      -H "Content-Type: application/json" \
      -d '{"feature": "Feature: X\n  Scenario: Y\n    Given I open \"https://example.com\"\n    Then the heading should be \"Example Domain\""}'
