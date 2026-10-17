Feature: Search on Wikipedia

  Background:
    Given I open "https://en.wikipedia.org"

  Scenario: Search for Playwright
    When I type "Playwright (software)" into the search box and submit
    Then the page heading should be "Playwright (software)"

  Scenario: Search for a nonsense term
    When I type "zzqxjkvv123" into the search box and submit
    Then I should see a message saying there were no results
