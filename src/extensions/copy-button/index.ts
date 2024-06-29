import { useEffect } from "react"
import { PrismEditor } from "../../types"
import { createTemplate } from "../../utils/local"

const template = createTemplate(
	'<div style=display:flex;align-items:flex-start;justify-content:flex-end><button type=button dir=ltr style=display:none class=pce-copy aria-label=Copy><svg width=1.2em viewbox="0 0 48 48" overflow=visible stroke-width=4 stroke-linecap=round fill=none stroke=currentColor><rect x=16 y=16 width=30 height=30 rx=3 /><path d="M32 9V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v24a3 3 0 0 0 3 3h4"/>',
)
const clipboard = navigator.clipboard

/**
 * Hook that adds a copy button to the editor. Probably best used with a read-only editor.
 * Requires styles from `react-prism-editor/copy-button.css` to work.
 */
const useCopyButton = (editor: PrismEditor) => {
	useEffect(() => {
		const container = template()
		const btn = container.firstChild as HTMLButtonElement

		btn.addEventListener("click", () => {
			btn.setAttribute("aria-label", "Copied!")
			if (clipboard) clipboard.writeText(editor.extensions.folding?.fullCode ?? editor.value)
			else {
				editor.textarea!.select()
				document.execCommand("copy")
				editor.setSelection(0)
			}
		})

		btn.addEventListener("pointerenter", () => btn.setAttribute("aria-label", "Copy"))

		editor.lines![0].append(container)
		return () => container.remove()
	}, [])
}

export { useCopyButton }
