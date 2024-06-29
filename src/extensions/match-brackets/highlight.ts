import { useLayoutEffect } from "react"
import { PrismEditor } from "../../types"
import { Bracket, useBracketMatcher } from "."
import { getClosestToken } from "../../utils"
import { addTextareaListener } from "../../core"

/**
 * Hook adding a `selectionChange` handler to highlight the closest bracket pair.
 *
 * The {@link useBracketMatcher} hook is required by this hook.
 *
 * The `.active-bracket` CSS selector can be used to style the highlighted pair.
 */
export const useHightlightBracketPairs = (editor: PrismEditor) => {
	useLayoutEffect(() => {
		let prev: Bracket
		let els: HTMLSpanElement[] = []
		const toggleActive = (add?: boolean) =>
			els.forEach(el => el.classList.toggle("active-bracket", !!add))

		const selectionChange = ([start, end] = editor.getSelection()) => {
			let newId = -1
			let matcher = editor.extensions.matchBrackets

			if (matcher) {
				let { brackets, pairs } = matcher
				if (editor.focused && start == end)
					for (let i = 0, bracket: Bracket; (bracket = brackets[++i]); ) {
						if (!bracket[4] && bracket[5] >= end && brackets[pairs[i]!]?.[1] <= end) {
							newId = i
							break
						}
					}

				let opening = brackets[pairs[newId]!]
				let closing = brackets[newId]
				if (closing != prev) {
					toggleActive()
					if (closing) {
						els[0] = getClosestToken(editor, ".punctuation", 0, -1, opening[1])!
						els[1] = getClosestToken(editor, ".punctuation", 0, -1, closing[1])!

						if (els[0] != els[1] && opening[1] + opening[3].length == closing[1]) {
							els[0].textContent += els[1].textContent!
							els[1].textContent = ""
							els[1] = els[0]
						}
						toggleActive(true)
					} else els = []
				}
				prev = brackets[newId]
			}
		}

		const cleanups = [
			toggleActive,
			editor.on("selectionChange", selectionChange),
			addTextareaListener(editor, "focus", () => selectionChange()),
			addTextareaListener(editor, "blur", () => selectionChange()),
		]

		return () => cleanups.forEach(c => c())
	}, [])
}
