import { Decoration, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view"
import type { DecorationSet } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state"

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>()
      const { doc } = view.state
      const cursorPos = view.state.selection.main.head
      const activeLine = doc.lineAt(cursorPos)
      const activeLineNumber = activeLine.number

      for (let { from, to } of view.visibleRanges) {
        let linePos = from

        while (linePos <= to) {
          const line = doc.lineAt(linePos)
          const lineText = line.text
          const isActiveLine = line.number === activeLineNumber

          const headingMatch = /^(#{1,6})\s+/.exec(lineText)
          if (headingMatch) {
            const level = headingMatch[1].length
            const headingContentStart = line.from + headingMatch[0].length

            builder.add(
              line.from,
              line.from,
              Decoration.line({
                attributes: { class: `cm-heading-${level}` }
              })
            )

            if (!isActiveLine && headingContentStart > line.from) {
              builder.add(
                line.from,
                headingContentStart,
                Decoration.mark({ class: "cm-heading-marker-hidden" })
              )
            }

            if (headingContentStart <= line.to) {
              builder.add(
                headingContentStart,
                line.to,
                Decoration.mark({ class: `cm-heading-content-${level}` })
              )
            }
          }

          const boldRegex = /\*\*([^\n*][^\n]*?)\*\*/g
          let match
          while ((match = boldRegex.exec(lineText)) !== null) {
            const matchStart = line.from + match.index
            const contentStart = matchStart + 2
            const contentEnd = matchStart + match[0].length - 2

            if (contentStart < contentEnd) {
              builder.add(
                contentStart,
                contentEnd,
                Decoration.mark({ class: "cm-bold" })
              )

              if (!isActiveLine) {
                builder.add(
                  matchStart,
                  contentStart,
                  Decoration.mark({ class: "cm-bold-marker-hidden" })
                )
                const markerEndEnd = Math.min(line.to, contentEnd + 2)
                if (contentEnd < markerEndEnd) {
                  builder.add(
                    contentEnd,
                    markerEndEnd,
                    Decoration.mark({ class: "cm-bold-marker-hidden" })
                  )
                }
              }
            }
          }

          if (line.to >= to) break
          linePos = line.to + 1
        }
      }

      return builder.finish()
    }
  },
  {
    decorations: v => v.decorations
  }
)