import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"
import type { DecorationSet } from "@codemirror/view"
import katex from "katex"

type InlineRule = {
  delimiter: string
  contentClass: string
  markerHiddenClass: string
}

type CompiledInlineRule = InlineRule & {
  matcher: RegExp
  delimiterLength: number
}

type LivePreviewOptions = {
  inlineRules: InlineRule[]
}

type MathMatch = {
  start: number
  end: number
  expression: string
  displayMode: boolean
}

const getIndentDepth = (indentation: string) => {
  const normalizedLength = indentation.replace(/\t/g, "  ").length
  return Math.floor(normalizedLength / 2)
}

class UnorderedListBulletWidget extends WidgetType {
  private readonly depth: number

  constructor(depth: number) {
    super()
    this.depth = depth
  }

  eq(other: UnorderedListBulletWidget) {
    return other.depth === this.depth
  }

  toDOM() {
    const element = document.createElement("span")
    const symbols = ["•", "◦", "▪"]
    const symbol = symbols[this.depth % symbols.length]
    element.className = `cm-list-bullet cm-list-bullet-depth-${this.depth % 3}`
    element.textContent = `${symbol} `
    return element
  }

  ignoreEvent() {
    return true
  }
}

class CheckboxWidget extends WidgetType {
  private readonly checked: boolean
  private readonly from: number
  private readonly to: number

  constructor(checked: boolean, from: number, to: number) {
    super()
    this.checked = checked
    this.from = from
    this.to = to
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.from === this.from && other.to === this.to
  }

  toDOM(view: EditorView) {
    const element = document.createElement("input")
    element.type = "checkbox"
    element.checked = this.checked
    element.className = "cm-checkbox-widget"
    element.setAttribute("aria-label", "Toggle markdown checkbox")

    element.addEventListener("mousedown", (event) => {
      event.preventDefault()
    })

    element.addEventListener("click", (event) => {
      event.preventDefault()
      const current = view.state.doc.sliceString(this.from, this.to)
      if (!/^\[(?: |x|X)\]$/.test(current)) {
        return
      }

      const next = this.checked ? "[ ]" : "[x]"
      view.dispatch({
        changes: {
          from: this.from,
          to: this.to,
          insert: next
        }
      })
    })

    return element
  }

  ignoreEvent() {
    return true
  }
}

class KatexWidget extends WidgetType {
  private readonly expression: string
  private readonly displayMode: boolean

  constructor(expression: string, displayMode: boolean) {
    super()
    this.expression = expression
    this.displayMode = displayMode
  }

  eq(other: KatexWidget) {
    return other.expression === this.expression && other.displayMode === this.displayMode
  }

  toDOM() {
    const container = document.createElement(this.displayMode ? "div" : "span")
    container.className = this.displayMode ? "cm-katex-block" : "cm-katex-inline"
    container.innerHTML = katex.renderToString(this.expression, {
      throwOnError: false,
      strict: "ignore",
      displayMode: this.displayMode
    })
    return container
  }

  ignoreEvent() {
    return true
  }
}

const hiddenMarkerDecoration = Decoration.replace({})

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) => {
  return startA < endB && startB < endA
}

const findMathMatches = (lineText: string): MathMatch[] => {
  const matches: MathMatch[] = []
  let position = 0

  while (position < lineText.length) {
    const current = lineText[position]

    if (current === "\\") {
      position += 2
      continue
    }

    if (current !== "$") {
      position += 1
      continue
    }

    if (position > 0 && lineText[position - 1] === "\\") {
      position += 1
      continue
    }

    const displayMode = lineText[position + 1] === "$"
    const delimiterLength = displayMode ? 2 : 1
    let end = position + delimiterLength

    while (end < lineText.length) {
      if (lineText[end] === "\\") {
        end += 2
        continue
      }

      if (displayMode) {
        if (lineText[end] === "$" && lineText[end + 1] === "$") {
          break
        }
      } else if (lineText[end] === "$") {
        break
      }

      end += 1
    }

    if (end >= lineText.length) {
      position += delimiterLength
      continue
    }

    const rawExpression = lineText.slice(position + delimiterLength, end)
    const expression = rawExpression.trim()
    const matchEnd = end + delimiterLength

    if (expression.length > 0) {
      matches.push({
        start: position,
        end: matchEnd,
        expression,
        displayMode
      })
    }

    position = matchEnd
  }

  return matches
}

const compileInlineRules = (rules: InlineRule[]): CompiledInlineRule[] => {
  return rules.map((rule) => {
    const escaped = escapeRegex(rule.delimiter)
    return {
      ...rule,
      delimiterLength: rule.delimiter.length,
      matcher: new RegExp(`${escaped}(\\S(?:[^\\n]*?\\S)?)${escaped}`, "g")
    }
  })
}

const defaultOptions: LivePreviewOptions = {
  inlineRules: [
    {
      delimiter: "**",
      contentClass: "cm-bold",
      markerHiddenClass: "cm-inline-marker-hidden"
    },
    {
      delimiter: "_",
      contentClass: "cm-italic",
      markerHiddenClass: "cm-inline-marker-hidden"
    },
    {
      delimiter: "--",
      contentClass: "cm-strikethrough",
      markerHiddenClass: "cm-inline-marker-hidden"
    }
  ]
}

export const createLivePreview = (options: Partial<LivePreviewOptions> = {}) => {
  const mergedOptions: LivePreviewOptions = {
    ...defaultOptions,
    ...options,
    inlineRules: options.inlineRules ?? defaultOptions.inlineRules
  }
  const inlineRules = compileInlineRules(mergedOptions.inlineRules)

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view)
      }

      update(update: ViewUpdate) {
        const previousLine = update.startState.doc.lineAt(update.startState.selection.main.head).number
        const nextLine = update.state.doc.lineAt(update.state.selection.main.head).number
        const activeLineChanged = previousLine !== nextLine

        if (update.docChanged || update.viewportChanged || activeLineChanged) {
          this.decorations = this.buildDecorations(update.view)
        }
      }

      buildDecorations(view: EditorView) {
        const pendingDecorations: Array<{ from: number; to: number; decoration: Decoration }> = []
        const { doc } = view.state
        const cursorPos = view.state.selection.main.head
        const activeLineNumber = doc.lineAt(cursorPos).number
        let inFencedCodeBlock = false

        for (const { from, to } of view.visibleRanges) {
          let linePos = from

          while (linePos <= to) {
            const line = doc.lineAt(linePos)
            const lineText = line.text
            const isActiveLine = line.number === activeLineNumber
            const mathMatches = findMathMatches(lineText)

            const fenceMatch = /^\s*```/.exec(lineText)
            if (fenceMatch) {
              pendingDecorations.push({
                from: line.from,
                to: line.to,
                decoration: Decoration.mark({ class: "cm-code-block-line" })
              })

              if (!isActiveLine) {
                pendingDecorations.push({
                  from: line.from + fenceMatch.index,
                  to: line.from + fenceMatch.index + 3,
                  decoration: hiddenMarkerDecoration
                })
              }

              inFencedCodeBlock = !inFencedCodeBlock
              if (line.to >= to) break
              linePos = line.to + 1
              continue
            }

            if (inFencedCodeBlock) {
              pendingDecorations.push({
                from: line.from,
                to: line.to,
                decoration: Decoration.mark({ class: "cm-code-block-line" })
              })

              if (line.to >= to) break
              linePos = line.to + 1
              continue
            }

            const unorderedListMatch = /^(\s*)([-*+])\s+/.exec(lineText)
            if (unorderedListMatch) {
              const indentDepth = getIndentDepth(unorderedListMatch[1])
              const markerStart = line.from + unorderedListMatch[1].length
              const markerEnd = markerStart + unorderedListMatch[2].length + 1

              pendingDecorations.push({
                from: markerEnd,
                to: line.to,
                decoration: Decoration.mark({ class: "cm-list-content" })
              })

              if (!isActiveLine) {
                pendingDecorations.push({
                  from: markerStart,
                  to: markerEnd,
                  decoration: Decoration.replace({
                    widget: new UnorderedListBulletWidget(indentDepth)
                  })
                })
              }
            }

            const orderedListMatch = /^(\s*)(\d+)\.\s+/.exec(lineText)
            if (orderedListMatch) {
              const markerStart = line.from + orderedListMatch[1].length
              const markerEnd = markerStart + orderedListMatch[2].length + 2

              pendingDecorations.push({
                from: markerEnd,
                to: line.to,
                decoration: Decoration.mark({ class: "cm-list-content" })
              })
            }

            const checkboxMatch = /^(\s*)([-*+])\s+(\[(?: |x|X)\])\s+/.exec(lineText)
            if (checkboxMatch) {
              const markerStart = line.from + checkboxMatch[1].length
              const markerEnd = markerStart + checkboxMatch[2].length + 1 + checkboxMatch[3].length + 1
              const boxStart = markerStart + checkboxMatch[2].length + 1
              const boxEnd = boxStart + checkboxMatch[3].length

              pendingDecorations.push({
                from: markerEnd,
                to: line.to,
                decoration: Decoration.mark({ class: "cm-checkbox-content" })
              })

              pendingDecorations.push({
                from: boxStart,
                to: boxEnd,
                decoration: Decoration.mark({ class: "cm-checkbox-box" })
              })

              if (!isActiveLine) {
                pendingDecorations.push({
                  from: markerStart,
                  to: boxStart,
                  decoration: hiddenMarkerDecoration
                })
                pendingDecorations.push({
                  from: boxStart,
                  to: boxEnd,
                  decoration: Decoration.replace({
                    widget: new CheckboxWidget(
                      checkboxMatch[3].toLowerCase() === "[x]",
                      boxStart,
                      boxEnd
                    )
                  })
                })
                pendingDecorations.push({
                  from: boxEnd,
                  to: markerEnd,
                  decoration: hiddenMarkerDecoration
                })
              }
            }

            const blockquoteMatch = /^(\s*)>\s?/.exec(lineText)
            if (blockquoteMatch) {
              const markerStart = line.from + blockquoteMatch[1].length
              const markerEnd = markerStart + blockquoteMatch[0].trimStart().length

              pendingDecorations.push({
                from: markerEnd,
                to: line.to,
                decoration: Decoration.mark({ class: "cm-quote-content" })
              })

              if (!isActiveLine) {
                pendingDecorations.push({
                  from: markerStart,
                  to: markerEnd,
                  decoration: hiddenMarkerDecoration
                })
              }
            }

            const headingMatch = /^(#{1,6})\s+/.exec(lineText)
            if (headingMatch) {
              const level = headingMatch[1].length
              const headingContentStart = line.from + headingMatch[0].length

              pendingDecorations.push({
                from: line.from,
                to: line.from,
                decoration: Decoration.line({
                  attributes: { class: `cm-heading-${level}` }
                })
              })

              if (!isActiveLine && headingContentStart > line.from) {
                pendingDecorations.push({
                  from: line.from,
                  to: headingContentStart,
                  decoration: hiddenMarkerDecoration
                })
              }

              if (headingContentStart <= line.to) {
                pendingDecorations.push({
                  from: headingContentStart,
                  to: line.to,
                  decoration: Decoration.mark({ class: `cm-heading-content-${level}` })
                })
              }
            }

            if (!isActiveLine) {
              const escapedDollarRegex = /\\\$/g
              let escapedDollarMatch: RegExpExecArray | null = null

              while ((escapedDollarMatch = escapedDollarRegex.exec(lineText)) !== null) {
                const backslashStart = line.from + escapedDollarMatch.index
                const backslashEnd = backslashStart + 1

                pendingDecorations.push({
                  from: backslashStart,
                  to: backslashEnd,
                  decoration: hiddenMarkerDecoration
                })
              }

              for (const mathMatch of mathMatches) {
                pendingDecorations.push({
                  from: line.from + mathMatch.start,
                  to: line.from + mathMatch.end,
                  decoration: Decoration.replace({
                    widget: new KatexWidget(mathMatch.expression, mathMatch.displayMode)
                  })
                })
              }
            }

            for (const rule of inlineRules) {
              rule.matcher.lastIndex = 0
              let match: RegExpExecArray | null = null

              while ((match = rule.matcher.exec(lineText)) !== null) {
                const matchStart = line.from + match.index

                const overlapsMath = mathMatches.some((mathMatch) =>
                  rangesOverlap(
                    match!.index,
                    match!.index + match![0].length,
                    mathMatch.start,
                    mathMatch.end
                  )
                )

                if (overlapsMath) {
                  continue
                }

                const contentStart = matchStart + rule.delimiterLength
                const contentEnd = matchStart + match[0].length - rule.delimiterLength

                if (contentStart >= contentEnd) {
                  continue
                }

                pendingDecorations.push({
                  from: contentStart,
                  to: contentEnd,
                  decoration: Decoration.mark({ class: rule.contentClass })
                })

                if (!isActiveLine) {
                  pendingDecorations.push({
                    from: matchStart,
                    to: contentStart,
                    decoration: hiddenMarkerDecoration
                  })

                  const closingMarkerEnd = Math.min(line.to, contentEnd + rule.delimiterLength)
                  if (contentEnd < closingMarkerEnd) {
                    pendingDecorations.push({
                      from: contentEnd,
                      to: closingMarkerEnd,
                      decoration: hiddenMarkerDecoration
                    })
                  }
                }
              }
            }

            const inlineCodeRegex = /`([^`\n]+)`/g
            let inlineCodeMatch: RegExpExecArray | null = null
            while ((inlineCodeMatch = inlineCodeRegex.exec(lineText)) !== null) {
              const matchStart = line.from + inlineCodeMatch.index
              const contentStart = matchStart + 1
              const contentEnd = contentStart + inlineCodeMatch[1].length
              const matchEnd = contentEnd + 1

              const overlapsMath = mathMatches.some((mathMatch) =>
                rangesOverlap(
                  inlineCodeMatch!.index,
                  inlineCodeMatch!.index + inlineCodeMatch![0].length,
                  mathMatch.start,
                  mathMatch.end
                )
              )

              if (overlapsMath) {
                continue
              }

              pendingDecorations.push({
                from: contentStart,
                to: contentEnd,
                decoration: Decoration.mark({ class: "cm-inline-code" })
              })

              if (!isActiveLine) {
                pendingDecorations.push({
                  from: matchStart,
                  to: contentStart,
                  decoration: hiddenMarkerDecoration
                })
                pendingDecorations.push({
                  from: contentEnd,
                  to: matchEnd,
                  decoration: hiddenMarkerDecoration
                })
              }
            }

            if (line.to >= to) break
            linePos = line.to + 1
          }
        }

        const ranges = []

        for (const entry of pendingDecorations) {
          try {
            ranges.push(entry.decoration.range(entry.from, entry.to))
          } catch {
            continue
          }
        }

        return Decoration.set(ranges, true)
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )
}

export const livePreview = createLivePreview()