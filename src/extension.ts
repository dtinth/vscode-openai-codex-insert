import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    'Insert Code Suggestion',
  )
  let disposable = vscode.commands.registerCommand(
    'insert-code-suggestion.insert',
    () => {
      vscode.window.withProgress(
        {
          title: 'Generating code suggestion',
          location: vscode.ProgressLocation.Notification,
        },
        async (progress, cancellationToken) => {
          // Load the API key from the user's settings
          const settings = vscode.workspace.getConfiguration(
            'insertCodeSuggestion',
          )
          const apiKey = settings.get('apiKey', '')
          const beforeLength = settings.get('beforeLength', 1024)
          const afterLength = settings.get('afterLength', 1024)
          const override = settings.get<Record<string, any>>('override', {})

          if (!apiKey) {
            vscode.window.showErrorMessage(
              'Please set the "insertCodeSuggestion.apiKey" setting to your OpenAI API key.',
            )
            return
          }

          const config = new Configuration({ apiKey })
          const openai = new OpenAIApi(config)

          // Get the text before and after the selection
          const editor = vscode.window.activeTextEditor
          if (!editor) {
            vscode.window.showErrorMessage('No editor is active')
            return
          }

          const selections = editor.selections
          if (selections.length !== 1) {
            vscode.window.showErrorMessage(
              'Multiple selections are not supported',
            )
            return
          }

          const selection = selections[0]
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
            outputChannel.clear()
            outputChannel.appendLine(JSON.stringify(data, null, 2))

            // Replace the selection with the code suggestion
            const text = data.choices[0]?.text
            if (!text) {
              vscode.window.showErrorMessage('No code suggestion was generated')
              return
            }
            await editor.edit((editBuilder) => {
              editBuilder.replace(selection, text)
            })
          } catch (error: any) {
            console.error(error)
            outputChannel.clear()
            outputChannel.appendLine(String(error?.stack || error))
            outputChannel.appendLine(
              JSON.stringify(error?.response?.data, null, 2),
            )
            vscode.window.showErrorMessage('Failed to generate code suggestion')
          }
        },
      )
    },
  )
  context.subscriptions.push(disposable)
}

export function deactivate() {}
