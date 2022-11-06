import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    'Insert Code Suggestion',
  )

  function displayError(error: any) {
    console.error(error)
    outputChannel.clear()
    outputChannel.appendLine(String(error?.stack || error))
    outputChannel.appendLine(JSON.stringify(error?.response?.data, null, 2))
  }
  function displayApiResponse(data: any) {
    outputChannel.clear()
    outputChannel.appendLine(JSON.stringify(data, null, 2))
  }

  type GoInput = {
    settings: vscode.WorkspaceConfiguration
    apiKey: string
    editor: vscode.TextEditor
    selection: vscode.Selection
  }

  async function go(f: (input: GoInput) => Promise<any>) {
    // Load the API key from the user's settings
    const settings = vscode.workspace.getConfiguration('insertCodeSuggestion')
    const apiKey = settings.get('apiKey', '')
    if (!apiKey) {
      vscode.window.showErrorMessage(
        'Please set the "insertCodeSuggestion.apiKey" setting to your OpenAI API key.',
      )
      return
    }

    // Get the active text editor
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showErrorMessage('No editor is active')
      return
    }

    // Get the active selection
    const selections = editor.selections
    if (selections.length !== 1) {
      vscode.window.showErrorMessage('Multiple selections are not supported')
      return
    }
    const selection = selections[0]

    return f({
      settings,
      apiKey,
      editor,
      selection,
    })
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'insert-code-suggestion.insert',
      async () => {
        await go(async ({ settings, apiKey, editor, selection }) => {
          const beforeLength = settings.get('beforeLength', 1024)
          const afterLength = settings.get('afterLength', 1024)
          const override = settings.get<Record<string, any>>(
            'completionOverride',
            {},
          )
          await vscode.window.withProgress(
            {
              title: 'Generating code suggestion',
              location: vscode.ProgressLocation.Notification,
              cancellable: false,
            },
            async (progress, cancellationToken) => {
              const config = new Configuration({ apiKey })
              const openai = new OpenAIApi(config)

              const before = editor.document.getText(
                new vscode.Range(new vscode.Position(0, 0), selection.start),
              )
              const after = editor.document.getText(
                new vscode.Range(
                  selection.end,
                  new vscode.Position(editor.document.lineCount, 0),
                ),
              )

              // Generate the code suggestion
              try {
                const completion = await openai.createCompletion({
                  model: 'code-davinci-002',
                  prompt: before.slice(-beforeLength),
                  suffix: after.slice(0, afterLength),
                  temperature: 0.5,
                  max_tokens: 256,
                  ...override,
                })
                const data = completion.data
                displayApiResponse(data)

                // Replace the selection with the code suggestion
                const text = data.choices[0]?.text
                if (!text) {
                  vscode.window.showErrorMessage(
                    'No code suggestion was generated',
                  )
                  return
                }
                await editor.edit((editBuilder) => {
                  editBuilder.replace(selection, text)
                })
              } catch (error: any) {
                displayError(error)
                vscode.window.showErrorMessage(
                  'Failed to generate code suggestion',
                )
              }
            },
          )
        })
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('insert-code-suggestion.edit', async () => {
      await go(async ({ settings, apiKey, editor, selection }) => {
        // Ask for an edit instruction (prompt).
        const editInstructions = settings.get<string[]>('editInstructions', [])
        const editInstruction = await vscode.window.showQuickPick(
          editInstructions,
          { placeHolder: 'Select an edit instruction' },
        )
        if (!editInstruction) {
          return
        }

        const override = settings.get<Record<string, any>>('editOverride', {})
        await vscode.window.withProgress(
          {
            title: 'Generating code suggestion',
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
          },
          async (progress, cancellationToken) => {
            const config = new Configuration({ apiKey })
            const openai = new OpenAIApi(config)

            const selectedText = editor.document.getText(selection)

            // Generate the code suggestion
            try {
              const editData = await openai.createEdit({
                model: 'code-davinci-edit-001',
                input: selectedText,
                instruction: editInstruction,
                temperature: 0.1,
                ...override,
              })
              const data = editData.data
              displayApiResponse(data)

              // Replace the selection with the code suggestion
              const text = data.choices[0]?.text
              if (!text) {
                vscode.window.showErrorMessage(
                  'No code suggestion was generated',
                )
                return
              }
              await editor.edit((editBuilder) => {
                editBuilder.replace(selection, text)
              })
            } catch (error: any) {
              displayError(error)
              vscode.window.showErrorMessage(
                'Failed to generate code suggestion',
              )
            }
          },
        )
      })
    }),
  )
}

export function deactivate() {}
