import { markdown } from "@codemirror/lang-markdown"
import { keymap } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { livePreview } from "./livePreview"

export const editorExtensions = [
  markdown(),
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  livePreview
]