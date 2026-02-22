import { useEffect, useRef } from "react"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { editorExtensions } from "./extensions"

interface EditorProps {
	value: string
	onChange: (value: string) => void
}

const Editor = ({ value, onChange }: EditorProps) => {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const editorViewRef = useRef<EditorView | null>(null)

	useEffect(() => {
		if (!containerRef.current) return

		const state = EditorState.create({
			doc: value,
			extensions: [
				...editorExtensions,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChange(update.state.doc.toString())
					}
				}),
			],
		})

		editorViewRef.current = new EditorView({
			state,
			parent: containerRef.current,
		})

		return () => {
			editorViewRef.current?.destroy()
			editorViewRef.current = null
		}
	}, [])

	useEffect(() => {
		const editorView = editorViewRef.current
		if (!editorView) return

		const currentValue = editorView.state.doc.toString()
		if (value === currentValue) return

		editorView.dispatch({
			changes: {
				from: 0,
				to: currentValue.length,
				insert: value,
			},
		})
	}, [value])

	return <div ref={containerRef} className="editor-surface h-full w-full rounded border border-gray-700 bg-gray-800" />
}

export default Editor


