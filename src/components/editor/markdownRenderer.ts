import MarkdownIt from "markdown-it"
import katex from "katex"

const renderKatex = (expression: string, displayMode: boolean) => {
  return katex.renderToString(expression, {
    throwOnError: false,
    strict: "ignore",
    displayMode
  })
}

const markdownItKatex = (md: MarkdownIt) => {
  md.inline.ruler.after("escape", "math_inline", (state, silent) => {
    const start = state.pos
    const max = state.posMax
    const src = state.src

    if (src[start] !== "$" || src[start + 1] === "$") {
      return false
    }

    let match = start + 1
    while (match < max) {
      if (src[match] === "$" && src[match - 1] !== "\\") {
        break
      }
      match += 1
    }

    if (match >= max) {
      return false
    }

    const expression = src.slice(start + 1, match).trim()
    if (!expression) {
      return false
    }

    if (!silent) {
      const token = state.push("math_inline", "math", 0)
      token.markup = "$"
      token.content = expression
    }

    state.pos = match + 1
    return true
  })

  md.block.ruler.after("blockquote", "math_block", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const firstLine = state.src.slice(start, max).trim()

    if (!firstLine.startsWith("$$")) {
      return false
    }

    let expression = ""
    let nextLine = startLine

    if (firstLine !== "$$" && firstLine.endsWith("$$") && firstLine.length > 4) {
      expression = firstLine.slice(2, -2).trim()
      nextLine = startLine + 1
    } else {
      nextLine = startLine + 1
      const contentLines: string[] = []

      while (nextLine < endLine) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
        const lineMax = state.eMarks[nextLine]
        const line = state.src.slice(lineStart, lineMax)
        const trimmed = line.trim()

        if (trimmed.endsWith("$$")) {
          contentLines.push(trimmed.slice(0, -2))
          break
        }

        contentLines.push(line)
        nextLine += 1
      }

      if (nextLine >= endLine) {
        return false
      }

      expression = contentLines.join("\n").trim()
      nextLine += 1
    }

    if (!expression) {
      return false
    }

    if (silent) {
      return true
    }

    const token = state.push("math_block", "math", 0)
    token.block = true
    token.content = expression
    token.map = [startLine, nextLine]
    token.markup = "$$"
    state.line = nextLine

    return true
  })

  md.renderer.rules.math_inline = (tokens, idx) => {
    return renderKatex(tokens[idx].content, false)
  }

  md.renderer.rules.math_block = (tokens, idx) => {
    return `${renderKatex(tokens[idx].content, true)}\n`
  }
}

export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

md.use(markdownItKatex)

export const renderMarkdown = (source: string) => md.render(source)