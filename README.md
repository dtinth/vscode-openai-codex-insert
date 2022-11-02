# insert-code-suggestion

Use OpenAI Codex to insert code suggestion at the cursor position.

## Features

This extension adds a command **"Insert Code Suggestion"** to insert code suggestion at the cursor position. It makes uses of [GPT-3’s Insert](https://openai.com/blog/gpt-3-edit-insert/) capability, which sometimes provides better results than GitHub Copilot, especially when writing documentation comments, as it can utilize the text after the cursor position in addition to the text before the cursor position.

## Requirements

You need to have an OpenAI API key. You can get one [here](https://beta.openai.com/).

You also need to be in a private beta for the [Codex model](https://beta.openai.com/docs/models/codex-series-private-beta) ([join the waitlist](https://beta.openai.com/codex-waitlist)).

## Extension Settings

This extension contributes the following settings:

- `insertCodeSuggestion.apiKey`: OpenAI API key
